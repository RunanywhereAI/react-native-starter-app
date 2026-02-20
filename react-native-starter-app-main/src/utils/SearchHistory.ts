import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLogger } from './AppLogger';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 30;

export interface SearchHistoryItem {
    query: string;
    timestamp: number; // epoch ms
    resultCount: number;
}

/** Load full search history (newest first) */
export const loadSearchHistory = async (): Promise<SearchHistoryItem[]> => {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        AppLogger.warn('SearchHistory', 'Failed to load history', e);
        return [];
    }
};

/** Save a search query to history (deduplicates + caps at MAX_HISTORY) */
export const saveSearch = async (query: string, resultCount: number): Promise<void> => {
    if (!query.trim()) return;
    try {
        const existing = await loadSearchHistory();
        // Remove any previous entry for same query (move to top)
        const filtered = existing.filter(
            h => h.query.toLowerCase() !== query.trim().toLowerCase()
        );
        const updated: SearchHistoryItem[] = [
            { query: query.trim(), timestamp: Date.now(), resultCount },
            ...filtered,
        ].slice(0, MAX_HISTORY);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        AppLogger.error('SearchHistory', 'Failed to save search', e);
    }
};

/** Delete a single history item */
export const deleteSearchItem = async (query: string): Promise<void> => {
    try {
        const existing = await loadSearchHistory();
        const updated = existing.filter(
            h => h.query.toLowerCase() !== query.toLowerCase()
        );
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
        AppLogger.error('SearchHistory', 'Failed to delete item', e);
    }
};

/** Clear all history */
export const clearSearchHistory = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {
        AppLogger.error('SearchHistory', 'Failed to clear history', e);
    }
};

/** Format timestamp as human-readable (e.g. "2h ago", "Yesterday") */
export const formatSearchTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
};
