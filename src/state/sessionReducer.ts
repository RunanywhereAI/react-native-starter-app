/**
 * 🔒 PRIVACY NOTICE
 * All session state management runs locally on device.
 * No data leaves this device.
 */

/**
 * SESSION REDUCER
 *
 * Single source of truth for the entire live session lifecycle.
 *
 * WHY REDUCER PREVENTS STALE STATE:
 * - Each action produces a deterministic new state from the previous state.
 * - No stale closures: the reducer always gets the latest state as its first arg.
 * - Unlike multiple useState() hooks, there's one atomic update per action —
 *   no half-updated states where transcript is new but suggestions are old.
 *
 * WHY COOLDOWN AVOIDS UI SPAM:
 * - TACTIC_DETECTED checks lastTacticAtMs before updating suggestions.
 * - If the same tactic fires within 8000ms, the action is ignored.
 * - This prevents the suggestion card from flickering on/off rapidly.
 */

import {
    NegotiationMode,
    NegotiationPattern,
    TranscriptChunk,
    DetectedPattern,
    CounterStrategy,
} from '../types/session';
import { generateCounterStrategies } from '../services/CounterStrategyEngine';

// ─────────────────────────── Session Status ───────────────────────────

export type SessionStatus = 'IDLE' | 'RUNNING' | 'ENDED';

// ─────────────────────────── State ───────────────────────────

export interface SessionState {
    /** Current session lifecycle status */
    status: SessionStatus;
    /** Negotiation mode for pattern detection weights */
    mode: NegotiationMode;
    /** Live transcript chunks */
    transcript: TranscriptChunk[];
    /** Full transcript text (appended each chunk) */
    transcriptText: string;
    /** All detected patterns so far */
    detectedPatterns: DetectedPattern[];
    /** Currently detected tactic (highest confidence), or null */
    tactic: NegotiationPattern | null;
    /** Confidence of the current tactic (0-100) */
    confidence: number;
    /** Counter-strategy suggestions for the current tactic */
    suggestions: string[];
    /** Active counter-strategy card data, or null */
    activeStrategy: CounterStrategy | null;
    /** Timestamp (ms) when the last tactic was accepted (for cooldown) */
    lastTacticAtMs: number;
    /** Session start time */
    startTime: number;
    /** Session duration in ms */
    duration: number;
    /** Current cognitive focus score (0-100) */
    focusScore: number;
    /** Current audio level (0-1) */
    audioLevel: number;
    /** Last error message */
    error: string | null;
}

// ─────────────────────────── Initial State ───────────────────────────

export const createInitialState = (
    mode: NegotiationMode = NegotiationMode.SALES,
): SessionState => ({
    status: 'IDLE',
    mode,
    transcript: [],
    transcriptText: '',
    detectedPatterns: [],
    tactic: null,
    confidence: 0,
    suggestions: [],
    activeStrategy: null,
    lastTacticAtMs: 0,
    startTime: 0,
    duration: 0,
    focusScore: 100,
    audioLevel: 0,
    error: null,
});

// ─────────────────────────── Action Types ───────────────────────────

export type SessionAction =
    | { type: 'START_SESSION'; mode: NegotiationMode; startTime: number }
    | { type: 'STOP_SESSION' }
    | { type: 'TRANSCRIPT_CHUNK'; chunk: TranscriptChunk }
    | { type: 'SYNC_TRANSCRIPT'; transcript: TranscriptChunk[] }
    | {
        type: 'TACTIC_DETECTED';
        patterns: DetectedPattern[];
        focusScore: number;
        timestampMs: number;
    }
    | { type: 'UPDATE_DURATION'; duration: number }
    | { type: 'UPDATE_AUDIO_LEVEL'; level: number }
    | { type: 'SET_ERROR'; message: string }
    | { type: 'RESET' };

// ─────────────────────────── Constants ───────────────────────────

/** Minimum confidence to accept a tactic (45%) */
const CONFIDENCE_THRESHOLD = 45;

/** Cooldown period to prevent same-tactic spam (8 seconds) */
const TACTIC_COOLDOWN_MS = 8000;

// ─────────────────────────── Reducer ───────────────────────────

export const sessionReducer = (
    state: SessionState,
    action: SessionAction,
): SessionState => {
    switch (action.type) {
        // ─── Start Session ───
        case 'START_SESSION': {
            console.log('[sessionReducer] ▶️ START_SESSION mode:', action.mode);
            return {
                ...createInitialState(action.mode),
                status: 'RUNNING',
                startTime: action.startTime,
            };
        }

        // ─── Stop Session ───
        case 'STOP_SESSION': {
            console.log('[sessionReducer] ⏹️ STOP_SESSION');
            return {
                ...state,
                status: 'ENDED',
            };
        }

        // ─── Append Transcript Chunk ───
        case 'TRANSCRIPT_CHUNK': {
            // Guard: ignore if session not running
            if (state.status !== 'RUNNING') {
                console.log('[sessionReducer] ⚠️ TRANSCRIPT_CHUNK ignored — session not running');
                return state;
            }

            console.log('[sessionReducer] 📝 TRANSCRIPT_CHUNK:', action.chunk.text.substring(0, 40));

            return {
                ...state,
                transcript: [...state.transcript, action.chunk],
                transcriptText: state.transcriptText + ' ' + action.chunk.text,
            };
        }

        // ─── Sync Transcript Array ───
        case 'SYNC_TRANSCRIPT': {
            if (state.status !== 'RUNNING') return state;
            return {
                ...state,
                transcript: action.transcript,
                transcriptText: action.transcript.map(c => c.text).join(' '),
            };
        }

        // ─── Tactic Detected (from debounced analysis) ───
        case 'TACTIC_DETECTED': {
            // Guard 1: ignore if session not running (prevents unmounted updates)
            if (state.status !== 'RUNNING') {
                console.log('[sessionReducer] ⚠️ TACTIC_DETECTED ignored — session not running');
                return state;
            }

            const { patterns, focusScore, timestampMs } = action;

            // Merge new patterns (avoid duplicates)
            const existingIds = new Set(state.detectedPatterns.map((p) => p.id));
            const newPatterns = patterns.filter((p) => !existingIds.has(p.id));
            const allPatterns = [...state.detectedPatterns, ...newPatterns];

            // Mark transcript chunks that have patterns
            const updatedTranscript = state.transcript.map((chunk) => {
                const hasPattern = newPatterns.some((p) => p.transcript === chunk.text);
                return hasPattern ? { ...chunk, hasPattern: true } : chunk;
            });

            // If no NEW patterns were detected on this tick, do not reset or calculate strategies.
            // Just update the base focusScore.
            if (newPatterns.length === 0) {
                return {
                    ...state,
                    detectedPatterns: allPatterns,
                    transcript: updatedTranscript,
                    focusScore,
                };
            }

            // Get the strongest pattern from the CURRENT newly analyzed audio block!
            // We ignore allPatterns entirely here to prevent old history from overriding fresh intel.
            newPatterns.sort((a, b) => b.confidenceScore - a.confidenceScore);
            const topPattern = newPatterns[0] || null;

            if (!topPattern) {
                return {
                    ...state,
                    detectedPatterns: allPatterns,
                    transcript: updatedTranscript,
                    focusScore,
                };
            }

            console.log(
                '[sessionReducer] 🎯 NEW TACTIC_DETECTED:',
                topPattern.pattern,
                'confidence:', topPattern.confidenceScore,
            );

            // Guard 2: confidence threshold
            if (topPattern.confidenceScore < CONFIDENCE_THRESHOLD) {
                console.log(
                    `[sessionReducer] ❌ Confidence ${topPattern.confidenceScore}% below threshold ${CONFIDENCE_THRESHOLD}%`,
                );
                return {
                    ...state,
                    detectedPatterns: allPatterns,
                    transcript: updatedTranscript,
                    focusScore,
                };
            }

            // Guard 3: cooldown — don't repeat same tactic within 8s
            if (
                topPattern.pattern === state.tactic &&
                timestampMs - state.lastTacticAtMs < TACTIC_COOLDOWN_MS
            ) {
                const remaining = Math.round(
                    (TACTIC_COOLDOWN_MS - (timestampMs - state.lastTacticAtMs)) / 1000,
                );
                console.log(
                    `[sessionReducer] ⏳ Cooldown: "${topPattern.pattern}" — ${remaining}s remaining`,
                );
                return {
                    ...state,
                    detectedPatterns: allPatterns,
                    transcript: updatedTranscript,
                    focusScore,
                };
            }

            // All guards passed — generate counter-strategy suggestions
            console.log('[sessionReducer] ✅ Generating counter-strategy for:', topPattern.pattern);

            const strategy = generateCounterStrategies(
                topPattern.pattern,
                topPattern.confidenceScore,
                TACTIC_COOLDOWN_MS,
                CONFIDENCE_THRESHOLD,
            );

            return {
                ...state,
                detectedPatterns: allPatterns,
                transcript: updatedTranscript,
                tactic: topPattern.pattern,
                confidence: topPattern.confidenceScore,
                suggestions: strategy ? strategy.suggestions : state.suggestions,
                activeStrategy: strategy || state.activeStrategy,
                lastTacticAtMs: timestampMs,
                focusScore,
            };
        }

        // ─── Update Duration ───
        case 'UPDATE_DURATION': {
            return { ...state, duration: action.duration };
        }

        // ─── Update Audio Level ───
        case 'UPDATE_AUDIO_LEVEL': {
            return { ...state, audioLevel: action.level };
        }

        // ─── Set Error ───
        case 'SET_ERROR': {
            console.log('[sessionReducer] ❌ SET_ERROR:', action.message);
            return { ...state, error: action.message };
        }

        // ─── Reset ───
        case 'RESET': {
            console.log('[sessionReducer] 🔄 RESET');
            return createInitialState(state.mode);
        }

        default:
            return state;
    }
};
