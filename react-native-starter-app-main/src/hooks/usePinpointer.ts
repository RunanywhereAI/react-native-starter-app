import { useState, useEffect, useRef } from 'react';
import { Alert, Share, Linking, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { RunAnywhere } from '@runanywhere/core';
import { indexDocument, searchDocuments, setupDatabase } from '../Database';
import { performFullGallerySync, performQuickSync, loadSavedCursor } from '../utils/GallerySync';
import { buildIndexableContent } from '../utils/TextEnrichment';
import { useModelService } from '../services/ModelService';
import { loadSearchHistory, saveSearch, deleteSearchItem, clearSearchHistory, SearchHistoryItem } from '../utils/SearchHistory';
// Modern ML Kit Import
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { analyzeImage } from '../utils/VisionPipeline';

const { NativeAudioModule } = NativeModules;

export const usePinpointer = () => {
    const { isSTTLoaded, isSTTLoading, isSTTDownloading, downloadAndLoadSTT } = useModelService();
    // UI & Search State
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isDbReady, setIsDbReady] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Search History
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

    // Sync State
    const [isSyncing, setIsSyncing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isDeepSync, setIsDeepSync] = useState(false);
    const [syncCount, setSyncCount] = useState(0);
    const [totalImages, setTotalImages] = useState(0);
    const cancelRef = useRef<boolean>(false);

    // Voice & AI State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartRef = useRef<number>(0);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRecordingRef = useRef<boolean>(false); // ref so setTimeout sees live value

    // --- 1. INITIALIZE DATABASE & AI MODELS ---
    useEffect(() => {
        const init = async () => {
            try {
                // Initialize Local Vector DB
                setupDatabase();
                setIsDbReady(true);
                // Load search history on init
                setSearchHistory(await loadSearchHistory());
                console.log("[AI] Warming up STT models...");
                setIsModelLoading(false);
            } catch (e) {
                console.error("Critical Init Failed:", e);
                setIsModelLoading(false);
            }
        };
        init();

        return () => {
            if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
            if (isRecording && NativeAudioModule) {
                NativeAudioModule.cancelRecording().catch(() => { });
            }
        };
    }, []);

    // --- 2. REAL-TIME SEARCH ENGINE + HISTORY SAVE ---
    useEffect(() => {
        if (!isDbReady) return;
        if (searchText.length > 0) {
            const results = searchDocuments(searchText);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [searchText, isDbReady]);

    // Save to history when user stops typing (debounced 800ms)
    useEffect(() => {
        if (!searchText.trim() || !isDbReady) return;
        const timer = setTimeout(async () => {
            const results = searchDocuments(searchText);
            await saveSearch(searchText, results.length);
            setSearchHistory(await loadSearchHistory());
        }, 800);
        return () => clearTimeout(timer);
    }, [searchText, isDbReady]);

    // --- 3. SPEECH-TO-TEXT (WHISPER) ---
    const startListening = async () => {
        // If model is busy, show brief inline feedback via isModelLoading state
        if (isSTTDownloading || isSTTLoading) {
            setIsModelLoading(true); // mic shows ⏳ spinner
            return;
        }
        if (!isSTTLoaded) {
            // Model isn't loaded — trigger silently in background, no popup
            setIsModelLoading(true);
            downloadAndLoadSTT().finally(() => setIsModelLoading(false));
            return;
        }
        setIsModelLoading(false);

        try {
            if (!NativeAudioModule) throw new Error('NativeAudioModule not found');
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
            }
            const result = await NativeAudioModule.startRecording();
            recordingStartRef.current = Date.now();
            isRecordingRef.current = true;  // sync ref immediately
            setIsRecording(true);
            setSearchText('');

            // Auto-stop after 15 seconds
            autoStopRef.current = setTimeout(() => {
                stopListening();
            }, 15000);

            audioLevelIntervalRef.current = setInterval(async () => {
                try {
                    const levelResult = await NativeAudioModule.getAudioLevel();
                    setAudioLevel(levelResult.level || 0);
                    setRecordingDuration(Date.now() - recordingStartRef.current);
                } catch (e) { }
            }, 100);
        } catch (error) {
            Alert.alert('Recording Error', `${error}`);
        }
    };

    const stopListening = async () => {
        // Use ref (not state) so setTimeout callback sees the live value
        if (!isRecordingRef.current) return;
        isRecordingRef.current = false; // mark stopped immediately
        // Clear auto-stop timer if user stops manually
        if (autoStopRef.current) {
            clearTimeout(autoStopRef.current);
            autoStopRef.current = null;
        }
        try {
            if (audioLevelIntervalRef.current) {
                clearInterval(audioLevelIntervalRef.current);
                audioLevelIntervalRef.current = null;
            }
            const result = await NativeAudioModule.stopRecording();
            setIsRecording(false);
            setAudioLevel(0);
            setIsTranscribing(true);

            if (!result.audioBase64) throw new Error('No audio data captured');

            // Transcribe using local on-device Whisper — 'auto' detects Hindi too
            const transcribeResult = await RunAnywhere.transcribe(result.audioBase64, {
                sampleRate: 16000,
                language: 'auto',
            });

            if (transcribeResult.text) {
                setSearchText(transcribeResult.text);
                setIsSearching(true);
            }
            setIsTranscribing(false);
        } catch (error) {
            console.error('[STT] Error:', error);
            setIsRecording(false);
            setIsTranscribing(false);
        }
    };

    // --- 4. ACTUAL ON-DEVICE OCR (ML KIT) ---
    const handleScan = async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
            if (result.assets && result.assets[0].uri) {
                const imageUri = result.assets[0].uri;

                // Sequential vision: OCR first (Latin+Devanagari), labels fallback
                const vision = await analyzeImage(imageUri);
                const rawText = vision.content;

                // Enrich: if Hindi detected, LLM adds Hinglish + English keywords
                const indexableContent = await buildIndexableContent(
                    rawText || "No readable text found"
                );

                // Save enriched content to local database
                indexDocument(indexableContent, imageUri, 'Manual Scan');

                Alert.alert(
                    "Scan Success",
                    `Detected: "${rawText.substring(0, 50)}..."`
                );
            }
        } catch (e) {
            Alert.alert("OCR Error", "The AI could not read this image.");
        }
    };

    // --- 5. FULL GALLERY AI SYNC (crash-safe, pauseable) ---
    const runSync = async (fromCursor?: string) => {
        try {
            if (Platform.OS === 'android') {
                const permission = Platform.Version >= 33
                    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
                const hasPermission = await PermissionsAndroid.request(permission);
                if (hasPermission !== PermissionsAndroid.RESULTS.GRANTED) return;
            }

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
            setIsSyncing(false);
            setIsPaused(true); // treat error as pause — cursor was saved
            Alert.alert('Sync Paused', 'Progress saved. Tap Resume to continue.');
        }
    };

    const handleFullSync = () => runSync(undefined);
    const handleDeepSync = () => {
        setIsDeepSync(true);
        runSync(undefined);
    };

    const handleQuickSync = async () => {
        try {
            if (Platform.OS === 'android') {
                const permission = Platform.Version >= 33
                    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
                    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
                const hasPermission = await PermissionsAndroid.request(permission);
                if (hasPermission !== PermissionsAndroid.RESULTS.GRANTED) return;
            }
            cancelRef.current = false;
            setIsDeepSync(false);
            setIsSyncing(true);
            setIsPaused(false);
            const { processed } = await performQuickSync(
                (count) => setSyncCount(count),
                cancelRef,
            );
            setIsSyncing(false);
            Alert.alert('Quick Sync Done', `Indexed ${processed} recent photos. Run Deep Sync to cover your full library.`);
        } catch (e) {
            setIsSyncing(false);
            Alert.alert('Sync Error', 'Quick sync failed. Please try again.');
        }
    };

    const handlePauseSync = () => {
        cancelRef.current = true; // signal the sync loop to stop
    };

    const handleResumeSync = async () => {
        const cursor = await loadSavedCursor();
        runSync(cursor);
    };

    // History handlers
    const handleSelectHistory = (query: string) => {
        setSearchText(query);
        setIsSearching(true);
    };
    const handleDeleteHistory = async (query: string) => {
        await deleteSearchItem(query);
        setSearchHistory(await loadSearchHistory());
    };
    const handleClearHistory = async () => {
        await clearSearchHistory();
        setSearchHistory([]);
    };

    return {
        searchText, setSearchText, searchResults, isSearching, setIsSearching,
        selectedImage, setSelectedImage,
        isRecording, isTranscribing, isModelLoading, audioLevel, recordingDuration,
        startListening, stopListening, handleScan,
        handleQuickSync, handleDeepSync, handleFullSync,
        handlePauseSync, handleResumeSync,
        isSyncing, isPaused, isDeepSync, syncCount, totalImages,
        searchHistory, handleSelectHistory, handleDeleteHistory, handleClearHistory,
        handleShare: () => selectedImage && Share.share({ url: selectedImage }),
        handleEdit: () => selectedImage && Linking.openURL(selectedImage)
    };
};