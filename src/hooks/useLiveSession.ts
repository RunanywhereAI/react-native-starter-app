/**
 * 🔒 PRIVACY NOTICE
 * All session management runs locally on device.
 * No data leaves this device. Uses RunAnywhere SDK for on-device inference only.
 */

/**
 * useLiveSession — Unified hook for the live session lifecycle.
 *
 * Replaces both useLiveTranscription and useCounterStrategy with a single
 * useReducer + SessionEngine integration.
 *
 * WHY DEBOUNCE REDUCES FLICKER:
 * - Without debounce, tactic analysis runs on every transcript chunk (every few seconds).
 * - This causes rapid state changes → suggestion cards flash in/out.
 * - The 250ms debounce waits for a speech pause before triggering analysis,
 *   so suggestions only update after the user finishes a phrase.
 *
 * HOW isLiveRef PREVENTS UNMOUNTED UPDATES:
 * - Async inference (analyzeSession) can resolve AFTER stopSession() is called.
 * - isLiveRef.current is set to false immediately on stop/cancel.
 * - All async callbacks check isLiveRef.current before dispatching.
 * - This prevents "Can't perform state update on unmounted component" errors.
 */

import { useReducer, useRef, useCallback, useEffect } from 'react';
import { NegotiationMode, Session, AnalysisResult } from '../types/session';
import {
    sessionReducer,
    createInitialState,
    SessionState,
    SessionAction,
} from '../state/sessionReducer';
import { SessionEngine } from '../services/SessionEngine';
import { LocalStorageService } from '../services/LocalStorageService';
import { resetAllCooldowns } from '../services/CounterStrategyEngine';

// ─────────────────────────── Return Type ───────────────────────────

export interface UseLiveSessionReturn {
    /** Current session state (single source of truth) */
    state: SessionState;
    /** Whether the session is actively recording */
    isRecording: boolean;
    /** Start a new session in the given mode */
    startSession: (mode: NegotiationMode) => Promise<boolean>;
    /** Stop the session and save it */
    stopSession: () => Promise<Session | null>;
    /** Cancel the session without saving */
    cancelSession: () => Promise<void>;
    /** Most recent error message */
    error: string | null;
}

// ─────────────────────────── Constants ───────────────────────────

/**
 * WHY 250ms DEBOUNCE:
 * Tactic inference doesn't need to run for every single word.
 * We wait 250ms after the last transcript chunk before running analysis.
 * This ensures analysis only triggers during speech pauses.
 */
const ANALYSIS_DEBOUNCE_MS = 250;

// ─────────────────────────── Hook ───────────────────────────

export const useLiveSession = (): UseLiveSessionReturn => {
    const [state, dispatch] = useReducer(sessionReducer, createInitialState());

    /**
     * isLiveRef: Prevents async callbacks from dispatching after session ends.
     * Set to true on startSession, false on stopSession/cancelSession.
     * Every async callback checks this before calling dispatch.
     */
    const isLiveRef = useRef<boolean>(false);

    /** SessionEngine handles recording, transcription, and auto-save */
    const sessionEngineRef = useRef<SessionEngine | null>(null);

    /** Duration timer interval */
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Track the last dispatched transcript chunk ID to avoid duplicates.
     * The SessionEngine callback fires on every state update (audio level, duration, etc.),
     * not just new transcripts. Without this, we'd dispatch the same chunk multiple times.
     */
    const lastDispatchedChunkIdRef = useRef<string | null>(null);

    /**
     * Debounce timer for tactic analysis.
     * WHY: We don't want to run NegotiationAnalyzer on every transcript chunk.
     * Instead we wait 250ms after the last chunk, then run analysis once.
     * This dramatically reduces suggestion flicker.
     */
    const analysisDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // ─── Initialize SessionEngine ───
    useEffect(() => {
        sessionEngineRef.current = new SessionEngine();

        return () => {
            // Cleanup on unmount
            if (sessionEngineRef.current) {
                sessionEngineRef.current.cleanup();
            }
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (analysisDebounceRef.current) {
                clearTimeout(analysisDebounceRef.current);
            }
            isLiveRef.current = false;
        };
    }, []);

    // ─── Safe Dispatch (checks isLiveRef) ───
    const safeDispatch = useCallback((action: SessionAction) => {
        if (!isLiveRef.current && action.type !== 'RESET') {
            console.log(
                `[useLiveSession] ⚠️ Dispatch blocked (session ended): ${action.type}`,
            );
            return;
        }
        dispatch(action);
    }, []);

    // ─── Start Session ───
    const startSession = useCallback(
        async (mode: NegotiationMode): Promise<boolean> => {
            if (!sessionEngineRef.current) {
                dispatch({ type: 'SET_ERROR', message: 'Session engine not initialized' });
                return false;
            }

            // Reset cooldowns from previous session
            resetAllCooldowns();

            // Set live flag BEFORE starting anything
            isLiveRef.current = true;

            // Dispatch START to reducer
            dispatch({
                type: 'START_SESSION',
                mode,
                startTime: Date.now(),
            });

            try {
                // Start SessionEngine — it calls our callbacks for transcript + analysis
                const started = await sessionEngineRef.current.startSession(
                    mode,
                    (engineState) => {
                        // Guard: don't dispatch if session was stopped
                        if (!isLiveRef.current) {
                            console.log('[useLiveSession] ⚠️ SessionEngine callback blocked — session ended');
                            return;
                        }

                        // ─── Sync transcript chunks from engine to reducer ───
                        // Sync the entire array to handle mutative string concatenations (paragraph building)
                        if (engineState.transcript.length > 0) {
                            const latestChunk =
                                engineState.transcript[engineState.transcript.length - 1];

                            // Check if the actual text content changed, since IDs remain the same during concatenation
                            if (latestChunk.text !== lastDispatchedChunkIdRef.current) {
                                lastDispatchedChunkIdRef.current = latestChunk.text;

                                // Dispatch the synced transcript array
                                safeDispatch({
                                    type: 'SYNC_TRANSCRIPT',
                                    transcript: engineState.transcript,
                                });
                            }
                        }

                        // ─── Debounced tactic analysis ───
                        // ALWAYS evaluate the latest intent detection patterns, regardless of string change
                        // since intent resolution is purely asynchronous!
                        if (engineState.detectedPatterns.length > 0) {
                            if (analysisDebounceRef.current) {
                                clearTimeout(analysisDebounceRef.current);
                            }

                            analysisDebounceRef.current = setTimeout(() => {
                                if (!isLiveRef.current) return;
                                safeDispatch({
                                    type: 'TACTIC_DETECTED',
                                    patterns: engineState.detectedPatterns,
                                    focusScore: engineState.currentFocusScore,
                                    timestampMs: Date.now(),
                                });
                            }, ANALYSIS_DEBOUNCE_MS);
                        }

                        // ─── Sync audio level ───
                        safeDispatch({
                            type: 'UPDATE_AUDIO_LEVEL',
                            level: engineState.audioLevel,
                        });
                    },
                );

                if (!started) {
                    isLiveRef.current = false;
                    dispatch({
                        type: 'SET_ERROR',
                        message: 'Failed to start recording. Please check microphone permissions.',
                    });
                    return false;
                }

                // ─── Duration Timer ───
                durationIntervalRef.current = setInterval(() => {
                    if (!isLiveRef.current) return;
                    if (sessionEngineRef.current) {
                        sessionEngineRef.current.updateDuration();
                        const engineState = sessionEngineRef.current.getState();
                        safeDispatch({
                            type: 'UPDATE_DURATION',
                            duration: engineState.duration,
                        });

                        // Also check for new patterns from continuous analysis
                        if (engineState.detectedPatterns.length > 0) {
                            safeDispatch({
                                type: 'TACTIC_DETECTED',
                                patterns: engineState.detectedPatterns,
                                focusScore: engineState.currentFocusScore,
                                timestampMs: Date.now(),
                            });
                        }
                    }
                }, 1000);

                console.log('[useLiveSession] ✅ Session started');
                return true;
            } catch (err) {
                isLiveRef.current = false;
                const errorMessage =
                    err instanceof Error ? err.message : 'Unknown error';
                dispatch({
                    type: 'SET_ERROR',
                    message: `Failed to start session: ${errorMessage}`,
                });
                return false;
            }
        },
        [safeDispatch],
    );

    // ─── Stop Session ───
    const stopSession = useCallback(async (): Promise<Session | null> => {
        if (!sessionEngineRef.current) {
            return null;
        }

        // Immediately prevent further async dispatches
        isLiveRef.current = false;

        // Clear timers
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (analysisDebounceRef.current) {
            clearTimeout(analysisDebounceRef.current);
            analysisDebounceRef.current = null;
        }

        // Dispatch STOP to reducer
        dispatch({ type: 'STOP_SESSION' });

        try {
            const session = await sessionEngineRef.current.stopSession();

            // Reset state for next session
            dispatch({ type: 'RESET' });

            return session;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Unknown error';
            dispatch({
                type: 'SET_ERROR',
                message: `Failed to stop session: ${errorMessage}`,
            });
            return null;
        }
    }, []);

    // ─── Cancel Session ───
    const cancelSession = useCallback(async (): Promise<void> => {
        if (!sessionEngineRef.current) {
            return;
        }

        // Immediately prevent further async dispatches
        isLiveRef.current = false;

        // Clear timers
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
        if (analysisDebounceRef.current) {
            clearTimeout(analysisDebounceRef.current);
            analysisDebounceRef.current = null;
        }

        try {
            await sessionEngineRef.current.cancelSession();
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'Unknown error';
            dispatch({
                type: 'SET_ERROR',
                message: `Failed to cancel session: ${errorMessage}`,
            });
        }

        // Reset state
        dispatch({ type: 'RESET' });
    }, []);

    return {
        state,
        isRecording: state.status === 'RUNNING',
        startSession,
        stopSession,
        cancelSession,
        error: state.error,
    };
};
