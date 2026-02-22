import { useState } from 'react';
import { Platform, Alert, Linking, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { indexDocument, isFileIndexed } from '../Database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect } from 'react';

const { StorageModule } = NativeModules;

export const useDocumentSync = () => {
    const [isSyncingDocs, setIsSyncingDocs] = useState(false);
    const [docSyncCount, setDocSyncCount] = useState(0);
    const [totalDocs, setTotalDocs] = useState(0);
    const [lastDocSyncTime, setLastDocSyncTime] = useState<number | null>(null);

    const loadPersistedState = useCallback(async () => {
        try {
            const timeStr = await AsyncStorage.getItem('doc_last_sync_time');
            if (timeStr) setLastDocSyncTime(parseInt(timeStr, 10));
        } catch (e) {
            console.error('[DocumentSync] Failed to load persisted time', e);
        }
    }, []);

    useEffect(() => {
        loadPersistedState();
    }, [loadPersistedState]);

    const requestAccessAndOpenSettings = () => {
        Alert.alert(
            "Full Storage Access Required",
            "To automatically find and sync all your documents, Pinpoint needs 'All Files Access' permission on Android 11+.\n\nPlease tap 'Open Settings', find Pinpoint, and enable 'Allow management of all files'.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Open Settings",
                    onPress: () => {
                        if (StorageModule && StorageModule.openAllFilesAccessSettings) {
                            StorageModule.openAllFilesAccessSettings();
                        } else {
                            Linking.openSettings();
                        }
                    }
                }
            ]
        );
    };

    const scanForPDFs = async (): Promise<RNFS.ReadDirItem[] | null> => {
        let pdfFiles: RNFS.ReadDirItem[] = [];
        const MAX_DEPTH = 4;
        let permissionDenied = false;

        const scanRecursive = async (dirPath: string, currentDepth: number) => {
            if (currentDepth > MAX_DEPTH) return;
            try {
                const items = await RNFS.readDir(dirPath);
                for (const item of items) {
                    if (item.isDirectory()) {
                        if (item.name.startsWith('.')) continue; // Skip hidden folders
                        await scanRecursive(item.path, currentDepth + 1);
                    } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
                        pdfFiles.push(item);
                    }
                }
            } catch (e: any) {
                if (e.message && e.message.includes('EACCES')) {
                    permissionDenied = true;
                }
            }
        };

        // Target standard user-accessible directories
        const targetDirs = Platform.OS === 'android'
            ? [RNFS.DownloadDirectoryPath, `${RNFS.ExternalStorageDirectoryPath}/Documents`]
            : [RNFS.DocumentDirectoryPath];

        for (const dir of targetDirs) {
            try {
                const exists = await RNFS.exists(dir);
                if (exists) {
                    await scanRecursive(dir, 1);
                }
            } catch (err: any) {
                if (err.message && err.message.includes('EACCES')) {
                    permissionDenied = true;
                }
            }
        }

        // If Android Scoped Storage perfectly blocked everything or the user has no documents
        if (pdfFiles.length === 0) {
            return null;
        }

        return pdfFiles;
    };

    const handleDocumentSync = async () => {
        if (isSyncingDocs) return;

        try {
            setIsSyncingDocs(true);
            const results = await scanForPDFs();

            // Intercept permission block and redirect to Android Settings
            if (results === null) {
                setIsSyncingDocs(false);
                requestAccessAndOpenSettings();
                return;
            }

            setTotalDocs(results.length);
            setDocSyncCount(0);

            let processed = 0;

            for (const doc of results) {
                if (!doc.path) continue;

                // Construct a proper file URI for External Rendering
                const fileUri = `file://${doc.path}`;

                try {
                    // Skip if already in DB
                    if (isFileIndexed(fileUri)) {
                        processed++;
                        setDocSyncCount(processed);
                        continue;
                    }

                    const documentTitle = doc.name || 'Unknown Document';

                    indexDocument(
                        documentTitle,
                        `Document: ${documentTitle}`,
                        fileUri,
                        'DOCUMENT',
                        'TEXT'
                    );
                } catch (readError) {
                    console.error('[DocumentSync] Failed to index:', doc.name, readError);
                    indexDocument(
                        doc.name || 'Unknown Document',
                        'document',
                        fileUri,
                        'DOCUMENT',
                        'TEXT'
                    );
                } finally {
                    processed++;
                    setDocSyncCount(processed);
                }
            }
        } catch (err) {
            console.error('[DocumentSync] Background crawler failed:', err);
        } finally {
            setIsSyncingDocs(false);
            setDocSyncCount(0);
            setTotalDocs(0);

            const now = Date.now();
            setLastDocSyncTime(now);
            await AsyncStorage.setItem('doc_last_sync_time', now.toString());
        }
    };

    return {
        isSyncingDocs,
        docSyncCount,
        totalDocs,
        lastDocSyncTime,
        handleDocumentSync,
        loadPersistedState
    };
};
