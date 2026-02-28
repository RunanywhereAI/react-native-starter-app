/**
 * 🔒 PRIVACY NOTICE
 * All data is stored locally on device using AsyncStorage.
 * No cloud sync. No external storage. No data leaves this device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Session,
  AppSettings,
  SessionStats,
  NegotiationMode,
  NegotiationPattern,
} from '../types/session';

// Storage keys
const KEYS = {
  SESSIONS: '@latent:sessions',
  SESSION_PREFIX: '@latent:session:',
  SETTINGS: '@latent:settings',
  STATS: '@latent:stats',
};

/**
 * Default app settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  defaultMode: NegotiationMode.SALES,
  patternSensitivity: 1.0,
  enableAutoSave: true,
  autoSaveInterval: 45000, // 45 seconds as requested
  enableHapticFeedback: true,
  enableSuggestionNotifications: true,
};

/**
 * LocalStorageService - Handles all AsyncStorage operations
 */
export class LocalStorageService {
  /**
   * Save a session to storage
   */
  static async saveSession(session: Session): Promise<void> {
    try {
      const sessionKey = `${KEYS.SESSION_PREFIX}${session.id}`;
      await AsyncStorage.setItem(sessionKey, JSON.stringify(session));

      // Update session list
      const sessionIds = await this.getAllSessionIds();
      if (!sessionIds.includes(session.id)) {
        sessionIds.push(session.id);
        await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessionIds));
      }

      console.log('[LocalStorage] Session saved:', session.id);
    } catch (error) {
      console.error('[LocalStorage] Error saving session:', error);
      throw error;
    }
  }

  /**
   * Get a session by ID
   */
  static async getSession(sessionId: string): Promise<Session | null> {
    try {
      const sessionKey = `${KEYS.SESSION_PREFIX}${sessionId}`;
      const data = await AsyncStorage.getItem(sessionKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[LocalStorage] Error getting session:', error);
      return null;
    }
  }

  /**
   * Get all session IDs
   */
  static async getAllSessionIds(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LocalStorage] Error getting session IDs:', error);
      return [];
    }
  }

  /**
   * Get all sessions (sorted by timestamp, newest first)
   */
  static async getAllSessions(): Promise<Session[]> {
    try {
      const sessionIds = await this.getAllSessionIds();
      const sessions: Session[] = [];

      for (const id of sessionIds) {
        const session = await this.getSession(id);
        if (session) {
          sessions.push(session);
        }
      }

      // Sort by timestamp (newest first)
      return sessions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[LocalStorage] Error getting all sessions:', error);
      return [];
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = `${KEYS.SESSION_PREFIX}${sessionId}`;
      await AsyncStorage.removeItem(sessionKey);

      // Update session list
      const sessionIds = await this.getAllSessionIds();
      const updatedIds = sessionIds.filter((id) => id !== sessionId);
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(updatedIds));

      console.log('[LocalStorage] Session deleted:', sessionId);
    } catch (error) {
      console.error('[LocalStorage] Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Delete all sessions
   */
  static async deleteAllSessions(): Promise<void> {
    try {
      const sessionIds = await this.getAllSessionIds();

      // Delete each session
      for (const id of sessionIds) {
        const sessionKey = `${KEYS.SESSION_PREFIX}${id}`;
        await AsyncStorage.removeItem(sessionKey);
      }

      // Clear session list
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify([]));

      console.log('[LocalStorage] All sessions deleted');
    } catch (error) {
      console.error('[LocalStorage] Error deleting all sessions:', error);
      throw error;
    }
  }

  /**
   * Get app settings
   */
  static async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('[LocalStorage] Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save app settings
   */
  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
      console.log('[LocalStorage] Settings saved');
    } catch (error) {
      console.error('[LocalStorage] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Calculate and cache session statistics
   */
  static async calculateStats(): Promise<SessionStats> {
    try {
      const sessions = await this.getAllSessions();

      if (sessions.length === 0) {
        return {
          totalSessions: 0,
          avgFocusScore: 0,
          avgDuration: 0,
          mostCommonPattern: null,
          totalPatterns: 0,
          lastSessionDate: null,
        };
      }

      // Calculate averages
      const totalFocusScore = sessions.reduce((sum, s) => sum + s.cognitiveMetrics.focusScore, 0);
      const avgFocusScore = Math.round(totalFocusScore / sessions.length);

      const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
      const avgDuration = Math.round(totalDuration / sessions.length);

      // Count patterns
      const patternCounts: Record<string, number> = {};
      let totalPatterns = 0;

      sessions.forEach((session) => {
        session.detectedPatterns.forEach((pattern) => {
          patternCounts[pattern.pattern] = (patternCounts[pattern.pattern] || 0) + 1;
          totalPatterns++;
        });
      });

      // Find most common pattern
      let mostCommonPattern: NegotiationPattern | null = null;
      let maxCount = 0;

      Object.entries(patternCounts).forEach(([pattern, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPattern = pattern as NegotiationPattern;
        }
      });

      const stats: SessionStats = {
        totalSessions: sessions.length,
        avgFocusScore,
        avgDuration,
        mostCommonPattern,
        totalPatterns,
        lastSessionDate: sessions[0].timestamp,
      };

      // Cache stats
      await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));

      return stats;
    } catch (error) {
      console.error('[LocalStorage] Error calculating stats:', error);
      return {
        totalSessions: 0,
        avgFocusScore: 0,
        avgDuration: 0,
        mostCommonPattern: null,
        totalPatterns: 0,
        lastSessionDate: null,
      };
    }
  }

  /**
   * Get cached stats (faster, but may be slightly outdated)
   */
  static async getCachedStats(): Promise<SessionStats | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.STATS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[LocalStorage] Error getting cached stats:', error);
      return null;
    }
  }

  /**
   * Get stats (tries cache first, calculates if needed)
   */
  static async getStats(): Promise<SessionStats> {
    const cached = await this.getCachedStats();
    if (cached) {
      return cached;
    }
    return await this.calculateStats();
  }

  /**
   * Clear all data (for settings screen)
   */
  static async clearAllData(): Promise<void> {
    try {
      await this.deleteAllSessions();
      await AsyncStorage.removeItem(KEYS.STATS);
      console.log('[LocalStorage] All data cleared');
    } catch (error) {
      console.error('[LocalStorage] Error clearing all data:', error);
      throw error;
    }
  }

  /**
   * Get storage size estimate (for debugging)
   */
  static async getStorageInfo(): Promise<{ keys: number; estimatedSize: string }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const latentKeys = allKeys.filter((key) => key.startsWith('@latent:'));

      // Get approximate size
      let totalSize = 0;
      for (const key of latentKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      const sizeInKB = (totalSize / 1024).toFixed(2);

      return {
        keys: latentKeys.length,
        estimatedSize: `${sizeInKB} KB`,
      };
    } catch (error) {
      console.error('[LocalStorage] Error getting storage info:', error);
      return { keys: 0, estimatedSize: '0 KB' };
    }
  }
}
