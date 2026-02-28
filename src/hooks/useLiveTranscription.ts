/**
 * Custom hook for managing live session state
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { NegotiationMode, LiveSessionState, Session } from '../types/session';
import { SessionEngine } from '../services/SessionEngine';

export interface UseSessionReturn {
  sessionState: LiveSessionState;
  isRecording: boolean;
  startSession: (mode: NegotiationMode) => Promise<boolean>;
  stopSession: () => Promise<Session | null>;
  cancelSession: () => Promise<void>;
  error: string | null;
}

/**
 * Hook for managing live transcription and session
 */
export const useLiveTranscription = (): UseSessionReturn => {
  const [sessionState, setSessionState] = useState<LiveSessionState>({
    isRecording: false,
    startTime: 0,
    duration: 0,
    transcript: [],
    detectedPatterns: [],
    currentFocusScore: 100,
    audioLevel: 0,
    lastAutoSave: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const sessionEngineRef = useRef<SessionEngine | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session engine
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
    };
  }, []);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = setInterval(() => {
      if (sessionEngineRef.current) {
        sessionEngineRef.current.updateDuration();
      }
    }, 1000); // Update every second
  }, []);

  // Stop duration timer
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Start session
  const startSession = useCallback(
    async (mode: NegotiationMode): Promise<boolean> => {
      if (!sessionEngineRef.current) {
        setError('Session engine not initialized');
        return false;
      }

      setError(null);

      try {
        const started = await sessionEngineRef.current.startSession(mode, (state) => {
          setSessionState(state);
        });

        if (started) {
          startDurationTimer();
          return true;
        } else {
          setError('Failed to start recording. Please check microphone permissions.');
          return false;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to start session: ${errorMessage}`);
        return false;
      }
    },
    [startDurationTimer]
  );

  // Stop session
  const stopSession = useCallback(async (): Promise<Session | null> => {
    if (!sessionEngineRef.current) {
      return null;
    }

    stopDurationTimer();

    try {
      const session = await sessionEngineRef.current.stopSession();

      // Reset state
      setSessionState({
        isRecording: false,
        startTime: 0,
        duration: 0,
        transcript: [],
        detectedPatterns: [],
        currentFocusScore: 100,
        audioLevel: 0,
        lastAutoSave: 0,
      });

      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to stop session: ${errorMessage}`);
      return null;
    }
  }, [stopDurationTimer]);

  // Cancel session
  const cancelSession = useCallback(async (): Promise<void> => {
    if (!sessionEngineRef.current) {
      return;
    }

    stopDurationTimer();

    try {
      await sessionEngineRef.current.cancelSession();

      // Reset state
      setSessionState({
        isRecording: false,
        startTime: 0,
        duration: 0,
        transcript: [],
        detectedPatterns: [],
        currentFocusScore: 100,
        audioLevel: 0,
        lastAutoSave: 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to cancel session: ${errorMessage}`);
    }
  }, [stopDurationTimer]);

  return {
    sessionState,
    isRecording: sessionState.isRecording,
    startSession,
    stopSession,
    cancelSession,
    error,
  };
};
