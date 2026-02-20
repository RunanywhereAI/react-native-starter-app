import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Share, Linking } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { indexDocument } from '../Database';
import { buildIndexableContent } from '../utils/TextEnrichment';
import { analyzeImage } from '../utils/VisionPipeline';
import { AppLogger } from '../utils/AppLogger';
import { useSearch } from './useSearch';
import { useGallerySync } from './useGallerySync';
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
        searchText, setSearchText,
        searchResults,
        isSearching, setIsSearching,
        searchHistory,
        handleSelectHistory, handleDeleteHistory, handleClearHistory,
    } = useSearch(true); // DB is initialized in App.tsx

    const {
        isSyncing, isPaused, isDeepSync, syncCount, totalImages,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,
        loadPersistedCount,
    } = useGallerySync();

    // Voice: deliver transcription into the search bar
    const onTranscription = useCallback((text: string) => {
        setSearchText(text);
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
        return () => {
            cleanupRecording();
        };
    }, [loadPersistedCount, cleanupRecording]);

    // --- Cross-cutting: Manual scan ---
    const handleScan = useCallback(async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
            if (result.assets && result.assets[0]?.uri) {
                const imageUri = result.assets[0].uri;

                const vision = await analyzeImage(imageUri);
                const rawText = vision.content;

                const indexableContent = await buildIndexableContent(
                    rawText || 'No readable text found'
                );

                indexDocument(indexableContent, imageUri, 'Manual Scan');

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
        if (selectedImage) Share.share({ url: selectedImage });
    }, [selectedImage]);

    const handleEdit = useCallback(() => {
        if (selectedImage) Linking.openURL(selectedImage);
    }, [selectedImage]);

    return {
        // Search
        searchText, setSearchText, searchResults, isSearching, setIsSearching,
        searchHistory, handleSelectHistory, handleDeleteHistory, handleClearHistory,

        // Image viewer
        selectedImage, setSelectedImage,

        // Voice
        isRecording, isTranscribing, isModelLoading, audioLevel, recordingDuration,
        startListening, stopListening,

        // Sync
        isSyncing, isPaused, isDeepSync, syncCount, totalImages,
        handleQuickSync, handleDeepSync, handlePauseSync, handleResumeSync,

        // Actions
        handleScan, handleShare, handleEdit,
    };
};