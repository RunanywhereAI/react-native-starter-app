import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { indexDocument, isFileIndexed } from '../Database';

const DEMO_LIMIT = 200;

export const getGalleryTotalCount = async (): Promise<number> => {
    try {
        console.log("[DEBUG] Starting getGalleryTotalCount...");
        const result = await CameraRoll.getPhotos({ first: DEMO_LIMIT, assetType: 'Photos' });
        console.log(`[DEBUG] getGalleryTotalCount found: ${result.edges.length} images.`);
        return result.edges.length;
    } catch (error) {
        console.warn("[DEBUG] Could not count photos:", error);
        return 0;
    }
};

export const performFullGallerySync = async (onProgress: (processedCount: number) => void) => {
    let hasNextPage = true;
    let after: string | undefined = undefined;
    let totalProcessed = 0;

    try {
        while (hasNextPage && totalProcessed < DEMO_LIMIT) {
            const result = await CameraRoll.getPhotos({
                first: 50,
                after: after,
                assetType: 'Photos',
            });

            if (result.edges.length === 0) break;

            for (const edge of result.edges) {
                if (totalProcessed >= DEMO_LIMIT) break;
                const uri = edge.node.image.uri;

                if (!isFileIndexed(uri)) {
                    indexDocument("Auto-indexed image", uri, 'Gallery Sync');
                }
                totalProcessed++;
                onProgress(totalProcessed);
            }
            hasNextPage = result.page_info.has_next_page;
            after = result.page_info.end_cursor;
        }
        return totalProcessed;
    } catch (error) {
        console.error("[DEBUG] Sync Failed:", error);
        throw error;
    }
};