import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { performFullGallerySync, performQuickSync, loadSavedCursor } from '../utils/GallerySync';
import { getIndexedCount } from '../Database';
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
    const cancelRef = useRef<boolean>(false);

    // Load persisted count on mount
    const loadPersistedCount = useCallback(() => {
        try {
            const count = getIndexedCount();
            if (count > 0) setSyncCount(count);
        } catch (e) {
            AppLogger.warn('GallerySync', 'Failed to load persisted count', e);
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
            Alert.alert('Quick Sync Done', `Indexed ${processed} recent photos. Run Deep Sync for full library.`);
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
        isSyncing, isPaused, isDeepSync, syncCount, totalImages,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        loadPersistedCount,
    };
};
