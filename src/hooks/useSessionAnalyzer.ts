/**
 * Custom hook for session analysis and statistics
 */

import { useState, useEffect, useCallback } from 'react';
import { Session, SessionStats } from '../types/session';
import { LocalStorageService } from '../services/LocalStorageService';

export interface UseSessionAnalyzerReturn {
  sessions: Session[];
  stats: SessionStats | null;
  isLoading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  getSession: (sessionId: string) => Promise<Session | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteAllSessions: () => Promise<void>;
}

/**
 * Hook for analyzing and managing sessions
 */
export const useSessionAnalyzer = (): UseSessionAnalyzerReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load sessions and stats
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [loadedSessions, loadedStats] = await Promise.all([
        LocalStorageService.getAllSessions(),
        LocalStorageService.getStats(),
      ]);

      setSessions(loadedSessions);
      setStats(loadedStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load sessions: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh sessions
  const refreshSessions = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Get single session
  const getSession = useCallback(async (sessionId: string): Promise<Session | null> => {
    try {
      return await LocalStorageService.getSession(sessionId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to get session: ${errorMessage}`);
      return null;
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await LocalStorageService.deleteSession(sessionId);

      // Update local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // Recalculate stats
      const newStats = await LocalStorageService.calculateStats();
      setStats(newStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete session: ${errorMessage}`);
    }
  }, []);

  // Delete all sessions
  const deleteAllSessions = useCallback(async (): Promise<void> => {
    try {
      await LocalStorageService.deleteAllSessions();

      // Update local state
      setSessions([]);
      setStats({
        totalSessions: 0,
        avgFocusScore: 0,
        avgDuration: 0,
        mostCommonPattern: null,
        totalPatterns: 0,
        lastSessionDate: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to delete all sessions: ${errorMessage}`);
    }
  }, []);

  return {
    sessions,
    stats,
    isLoading,
    error,
    refreshSessions,
    getSession,
    deleteSession,
    deleteAllSessions,
  };
};
