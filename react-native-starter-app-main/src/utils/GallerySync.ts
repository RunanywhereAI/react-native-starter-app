import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { indexDocument, isFileIndexed } from '../Database';
import { buildIndexableContent } from './TextEnrichment';
import { analyzeImage } from './VisionPipeline';
import { AppLogger } from './AppLogger';

export const QUICK_SYNC_LIMIT = 50;  // Fast cap for UI loading mask
export const SILENT_BACKGROUND_LIMIT = 250; // Total 300
const DEEP_BATCH_SIZE = 10;          // Smaller batches for deep sync (memory safe)
const QUICK_BATCH_SIZE = 50;         // Larger batches for quick sync (no sleep needed)
const DEEP_SLEEP_MS = 200;           // Sleep between deep sync batches

const CURSOR_KEY = 'gallery_sync_cursor';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const saveCursor = async (cursor: string | undefined) => {
    try {
        if (cursor) await AsyncStorage.setItem(CURSOR_KEY, cursor);
        else await AsyncStorage.removeItem(CURSOR_KEY);
    } catch (e) {
        AppLogger.warn('GallerySync', 'Failed to save cursor', e);
    }
};

export const loadSavedCursor = async (): Promise<string | undefined> => {
    try {
        const val = await AsyncStorage.getItem(CURSOR_KEY);
        return val ?? undefined;
    } catch (e) {
        AppLogger.warn('GallerySync', 'Failed to load cursor', e);
        return undefined;
    }
};

export const clearSyncCursor = async () => {
    try {
        await AsyncStorage.removeItem(CURSOR_KEY);
    } catch (e) {
        AppLogger.warn('GallerySync', 'Failed to clear cursor', e);
    }
};

export const getGallerySyncLimit = async (): Promise<number> => -1;
export const getGalleryTotalCount = async (): Promise<number> => -1;

/**
 * QUICK SYNC — Lazy Approach.
 * Processes the most recent 50 photos while holding the UI.
 * Then silently spins off a background task to process the remaining 250 photos.
 */
export const performQuickSync = async (
    onProgress: (count: number) => void,
    cancelRef?: React.MutableRefObject<boolean>,
): Promise<{ processed: number; wasCancelled: boolean }> => {
    let hasNextPage = true;
    let after: string | undefined = undefined;
    let totalProcessed = 0;

    // Phase 1: Foreground loading (Block UI up to QUICK_SYNC_LIMIT)
    while (hasNextPage && totalProcessed < QUICK_SYNC_LIMIT) {
        if (cancelRef?.current) return { processed: totalProcessed, wasCancelled: true };

        const pageResult = await CameraRoll.getPhotos({
            first: QUICK_BATCH_SIZE,
            after,
            assetType: 'Photos',
        });

        if (pageResult.edges.length === 0) break;

        for (const edge of pageResult.edges) {
            if (totalProcessed >= QUICK_SYNC_LIMIT || cancelRef?.current) {
                break;
            }

            const uri = edge.node.image.uri;
            if (!isFileIndexed(uri)) {
                try {
                    const vision = await analyzeImage(uri);
                    const content = await buildIndexableContent(vision.content || 'image');
                    indexDocument(null, content || vision.content || 'image', uri, 'IMAGE', vision.detection_type as 'TEXT' | 'OBJECT');
                } catch (e) {
                    AppLogger.warn('QuickSync', `Failed to process ${uri}`, e);
                    indexDocument(null, 'image', uri, 'IMAGE', 'OBJECT');
                }
            }

            totalProcessed++;
            onProgress(totalProcessed);
        }

        hasNextPage = pageResult.page_info.has_next_page;
        after = pageResult.page_info.end_cursor;
    }

    // Phase 2: Silent Background processing
    if (hasNextPage && !cancelRef?.current) {
        // Fire and forget (do not await)
        (async () => {
            let bgProcessed = 0;
            while (hasNextPage && bgProcessed < SILENT_BACKGROUND_LIMIT) {
                if (cancelRef?.current) break;

                const bgPageResult = await CameraRoll.getPhotos({
                    first: DEEP_BATCH_SIZE, // smaller batches in background
                    after,
                    assetType: 'Photos',
                });

                if (bgPageResult.edges.length === 0) break;

                for (const edge of bgPageResult.edges) {
                    if (bgProcessed >= SILENT_BACKGROUND_LIMIT || cancelRef?.current) {
                        break;
                    }

                    const uri = edge.node.image.uri;
                    if (!isFileIndexed(uri)) {
                        try {
                            const vision = await analyzeImage(uri);
                            const content = await buildIndexableContent(vision.content || 'image');
                            indexDocument(null, content || vision.content || 'image', uri, 'IMAGE', vision.detection_type as 'TEXT' | 'OBJECT');
                        } catch (e) {
                            AppLogger.warn('QuickSync (BG)', `Failed to process ${uri}`, e);
                            indexDocument(null, 'image', uri, 'IMAGE', 'OBJECT');
                        }
                    }
                    bgProcessed++;
                    // intentionally not calling onProgress so the UI ignores it
                }

                hasNextPage = bgPageResult.page_info.has_next_page;
                after = bgPageResult.page_info.end_cursor;
                await sleep(500); // 500ms sleep between bg batches to keep UI fully responsive
            }
            AppLogger.info('QuickSync', `Finished silent background sync of ${bgProcessed} photos.`);
        })();
    }

    // Return immediately to release the UI
    return { processed: totalProcessed, wasCancelled: false };
};

/**
 * DEEP SYNC — processes ALL photos.
 * Batches of 10 with 200ms sleep between batches (memory safe for 10k+ galleries).
 * Crash-resumable via AsyncStorage cursor.
 */
export const performFullGallerySync = async (
    onProgress: (count: number, uri?: string) => void,
    cancelRef?: React.MutableRefObject<boolean>,
    resumeFrom?: string,
): Promise<{ processed: number; wasCancelled: boolean }> => {
    let hasNextPage = true;
    let after: string | undefined = resumeFrom ?? await loadSavedCursor();
    let totalProcessed = 0;

    try {
        while (hasNextPage) {
            if (cancelRef?.current) {
                await saveCursor(after);
                return { processed: totalProcessed, wasCancelled: true };
            }

            const pageResult = await CameraRoll.getPhotos({
                first: DEEP_BATCH_SIZE,
                after,
                assetType: 'Photos',
            });

            if (pageResult.edges.length === 0) break;

            for (const edge of pageResult.edges) {
                if (cancelRef?.current) {
                    await saveCursor(after);
                    return { processed: totalProcessed, wasCancelled: true };
                }

                const uri = edge.node.image.uri;
                if (!isFileIndexed(uri)) {
                    try {
                        const vision = await analyzeImage(uri);
                        const rawText = vision.content;

                        let content: string;
                        if (rawText.trim().length === 0) {
                            content = 'image';
                        } else {
                            content = await buildIndexableContent(rawText);
                        }
                        indexDocument(null, content, uri, 'IMAGE', vision.detection_type as 'TEXT' | 'OBJECT');
                    } catch (e) {
                        AppLogger.warn('DeepSync', `Failed to process ${uri}`, e);
                        indexDocument(null, 'image', uri, 'IMAGE', 'OBJECT');
                    }
                }

                totalProcessed++;
                onProgress(totalProcessed, uri);
            }

            hasNextPage = pageResult.page_info.has_next_page;
            after = pageResult.page_info.end_cursor;
            await saveCursor(after);
            await sleep(DEEP_SLEEP_MS);
        }

        await clearSyncCursor();
        return { processed: totalProcessed, wasCancelled: false };
    } catch (error) {
        await saveCursor(after);
        throw error;
    }
};