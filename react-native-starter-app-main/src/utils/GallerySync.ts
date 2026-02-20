import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { indexDocument, isFileIndexed } from '../Database';
import { buildIndexableContent } from './TextEnrichment';
import { analyzeImage } from './VisionPipeline';
import { AppLogger } from './AppLogger';

export const QUICK_SYNC_LIMIT = 300; // Fast cap — no sleep, no LLM
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
 * QUICK SYNC — blazing fast, no sleep, no LLM enrichment.
 * Processes the most recent QUICK_SYNC_LIMIT photos in large batches.
 */
export const performQuickSync = async (
    onProgress: (count: number) => void,
    cancelRef?: React.MutableRefObject<boolean>,
): Promise<{ processed: number; wasCancelled: boolean }> => {
    let hasNextPage = true;
    let after: string | undefined = undefined;
    let totalProcessed = 0;

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
                return { processed: totalProcessed, wasCancelled: !!cancelRef?.current };
            }

            const uri = edge.node.image.uri;
            if (!isFileIndexed(uri)) {
                try {
                    const vision = await analyzeImage(uri);
                    const content = await buildIndexableContent(vision.content || 'image');
                    indexDocument(content || vision.content || 'image', uri, 'Quick Sync', vision.detection_type);
                } catch (e) {
                    AppLogger.warn('QuickSync', `Failed to process ${uri}`, e);
                    indexDocument('image', uri, 'Quick Sync');
                }
            }

            totalProcessed++;
            onProgress(totalProcessed);
        }

        hasNextPage = pageResult.page_info.has_next_page;
        after = pageResult.page_info.end_cursor;
    }

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
                        indexDocument(content, uri, 'Deep Sync', vision.detection_type);
                    } catch (e) {
                        AppLogger.warn('DeepSync', `Failed to process ${uri}`, e);
                        indexDocument('image', uri, 'Deep Sync');
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