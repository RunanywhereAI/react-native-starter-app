import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Share, Linking, Platform, NativeModules } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { indexDocument } from '../Database';
import { buildIndexableContent } from '../utils/TextEnrichment';
import { analyzeImage } from '../utils/VisionPipeline';
import { AppLogger } from '../utils/AppLogger';
import { useSearch } from './useSearch';
import { useGallerySync } from './useGallerySync';
import { useDocumentSync } from './useDocumentSync';
import { useVoiceRecording } from './useVoiceRecording';

/**
 * usePinpointer — thin composition hook wiring search, sync, and voice.
 * Cross-cutting concerns (scan, share, edit) live here.
 */
export const usePinpointer = () => {
    // --- Image viewer state ---
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // --- Sub-hooks ---
    const {
        searchText, setSearchText, debouncedSearchText,
        searchResults,
        isSearching, setIsSearching, isSearchPending,
        searchHistory,
        handleSelectHistory, handleDeleteHistory, handleClearHistory,
    } = useSearch(true); // DB is initialized in App.tsx

    const {
        isSyncing, isPaused, isDeepSync, syncCount, totalImages, lastSyncTime,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        loadPersistedCount,
    } = useGallerySync();

    const {
        isSyncingDocs, docSyncCount, totalDocs, lastDocSyncTime,
        handleDocumentSync, loadPersistedState: loadPersistedDocs
    } = useDocumentSync();

    // Voice: deliver transcription into the search bar
    const onTranscription = useCallback((text: string) => {
        let cleanedText = text.toLowerCase().trim();

        // Strip common conversational voice prefixes
        const prefixes = [
            'search for my ', 'search for a ', 'search for ', 'search my ', 'search ',
            'find my ', 'find a ', 'find ',
            'look for my ', 'look for a ', 'look for ',
            'where is my ', 'where is the ', 'where is a ', 'where is ',
            'show me my ', 'show me the ', 'show me a ', 'show me ',
        ];

        for (const prefix of prefixes) {
            if (cleanedText.startsWith(prefix)) {
                cleanedText = cleanedText.substring(prefix.length).trim();
                break;
            }
        }

        // Remove trailing punctuation STT models often add (e.g. "Aadhar card.")
        cleanedText = cleanedText.replace(/[.!?]$/, '').trim();

        // If the user *just* said "search" and nothing else, fallback to raw text gracefully
        const finalText = cleanedText || text.trim();

        setSearchText(finalText);
        setIsSearching(true);
    }, [setSearchText, setIsSearching]);

    const {
        isRecording, isTranscribing, isModelLoading,
        audioLevel, recordingDuration,
        startListening, stopListening,
        cleanupRecording,
    } = useVoiceRecording(onTranscription);

    // --- Init: load persisted index count ---
    useEffect(() => {
        loadPersistedCount();
        loadPersistedDocs();
        return () => {
            cleanupRecording();
        };
    }, [loadPersistedCount, loadPersistedDocs, cleanupRecording]);

    // --- Cross-cutting: Manual scan ---
    const handleScan = useCallback(async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.5, maxWidth: 1024, maxHeight: 1024 });
            if (result.assets && result.assets[0]?.uri) {
                const imageUri = result.assets[0].uri;

                const vision = await analyzeImage(imageUri);
                const rawText = vision.content;

                const indexableContent = await buildIndexableContent(
                    rawText || 'No readable text found'
                );

                indexDocument(null, indexableContent, imageUri, 'IMAGE', 'TEXT');

                Alert.alert(
                    'Scan Success',
                    `Detected: "${rawText.substring(0, 50)}..."`
                );
            }
        } catch (e) {
            AppLogger.error('Pinpointer', 'OCR scan failed', e);
            Alert.alert('OCR Error', 'The AI could not read this image.');
        }
    }, []);

    // --- Cross-cutting: Share & Edit ---
    const handleShare = useCallback(() => {
        if (!selectedImage) return;

        if (Platform.OS === 'android' && NativeModules.StorageModule && NativeModules.StorageModule.shareImage) {
            NativeModules.StorageModule.shareImage(selectedImage.replace('file://', ''));
        } else {
            Share.share({ url: selectedImage });
        }
    }, [selectedImage]);

    const handleEdit = useCallback(() => {
        if (selectedImage) Linking.openURL(selectedImage);
    }, [selectedImage]);

    return {
        // Search
        searchText, setSearchText, searchResults, isSearching, setIsSearching, isSearchPending,
        searchHistory, handleSelectHistory, handleDeleteHistory, handleClearHistory,

        // Image viewer
        selectedImage, setSelectedImage,

        // Voice
        isRecording, isTranscribing, isModelLoading, audioLevel, recordingDuration,
        startListening, stopListening,

        // Sync
        isSyncing, isPaused, isDeepSync, syncCount, totalImages, lastSyncTime,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        isSyncingDocs, docSyncCount, totalDocs, lastDocSyncTime, handleDocumentSync,

        // Actions
        handleScan, handleShare, handleEdit,
    };
};