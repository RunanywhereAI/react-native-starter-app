import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { performFullGallerySync, performQuickSync, loadSavedCursor } from '../utils/GallerySync';
import { getIndexedCount } from '../Database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLogger } from '../utils/AppLogger';

/**
 * useGallerySync — handles quick/deep sync, pause, resume, progress.
 */
export const useGallerySync = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isDeepSync, setIsDeepSync] = useState(false);
    const [syncCount, setSyncCount] = useState(0);
    const [totalImages, setTotalImages] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
    const cancelRef = useRef<boolean>(false);

    // Load persisted count on mount
    const loadPersistedCount = useCallback(async () => {
        try {
            const count = getIndexedCount();
            if (count > 0) setSyncCount(count);

            const timeStr = await AsyncStorage.getItem('gallery_last_sync_time');
            if (timeStr) setLastSyncTime(parseInt(timeStr, 10));
        } catch (e) {
            AppLogger.warn('GallerySync', 'Failed to load persisted state', e);
        }
    }, []);

    const requestPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'android') {
            const permission = Platform.Version >= 33
                ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
            const granted = await PermissionsAndroid.request(permission);
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true; // iOS permissions handled by Info.plist
    };

    const runSync = useCallback(async (fromCursor?: string) => {
        try {
            const hasPermission = await requestPermission();
            if (!hasPermission) return;

            cancelRef.current = false;
            setIsSyncing(true);
            setIsPaused(false);

            const { processed, wasCancelled } = await performFullGallerySync(
                (currentCount) => setSyncCount(currentCount),
                cancelRef,
                fromCursor,
            );

            setIsSyncing(false);
            if (wasCancelled) {
                setIsPaused(true);
            } else {
                setIsPaused(false);
                const now = Date.now();
                setLastSyncTime(now);
                await AsyncStorage.setItem('gallery_last_sync_time', now.toString());
                Alert.alert('Gallery Indexed', `Done! ${processed} photos indexed for AI search.`);
            }
        } catch (error) {
            AppLogger.error('GallerySync', 'Deep sync failed', error);
            setIsSyncing(false);
            setIsPaused(true); // treat error as pause — cursor was saved
            Alert.alert('Sync Paused', 'Progress saved. Tap Resume to continue.');
        }
    }, []);

    const handleQuickSync = useCallback(async () => {
        try {
            const hasPermission = await requestPermission();
            if (!hasPermission) return;

            cancelRef.current = false;
            setIsDeepSync(false);
            setIsSyncing(true);
            setIsPaused(false);

            const { processed } = await performQuickSync(
                (count) => setSyncCount(count),
                cancelRef,
            );

            setIsSyncing(false);
            const now = Date.now();
            setLastSyncTime(now);
            await AsyncStorage.setItem('gallery_last_sync_time', now.toString());
        } catch (e) {
            AppLogger.error('GallerySync', 'Quick sync failed', e);
            setIsSyncing(false);
            Alert.alert('Sync Error', 'Quick sync failed. Please try again.');
        }
    }, []);

    const handleDeepSync = useCallback(() => {
        setIsDeepSync(true);
        runSync(undefined);
    }, [runSync]);

    const handlePauseSync = useCallback(() => {
        cancelRef.current = true;
    }, []);

    const handleResumeSync = useCallback(async () => {
        const cursor = await loadSavedCursor();
        runSync(cursor);
    }, [runSync]);

    return {
        isSyncing, isPaused, isDeepSync, syncCount, totalImages, lastSyncTime,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        loadPersistedCount,
    };
};
