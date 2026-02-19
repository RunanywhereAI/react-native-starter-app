import { useState, useEffect, useRef } from 'react';
import { Alert, Share, Linking, NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { RunAnywhere } from '@runanywhere/core'; 
import { indexDocument, searchDocuments, setupDatabase } from '../Database';
import { performFullGallerySync, getGalleryTotalCount } from '../utils/GallerySync'; 

const { NativeAudioModule } = NativeModules;

export const usePinpointer = () => {
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isDbReady, setIsDbReady] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncCount, setSyncCount] = useState(0);
    const [totalImages, setTotalImages] = useState(0);

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingDuration, setRecordingDuration] = useState(0);
    
    const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartRef = useRef<number>(0);

    useEffect(() => {
        const init = async () => {
            try {
                await setupDatabase();
                setIsDbReady(true);
            } catch (e) {
                console.error("DB Init Failed:", e);
            }
        };
        init();
        return () => {
            if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
            if (isRecording && NativeAudioModule) {
                NativeAudioModule.cancelRecording().catch(() => {});
            }
        };
    }, [isRecording]);

    useEffect(() => {
        if (!isDbReady) return;
        if (searchText.length > 0) {
            setSearchResults(searchDocuments(searchText));
        } else {
            setSearchResults([]);
        }
    }, [searchText, isDbReady]);

    const startListening = async () => {
        try {
            if (!NativeAudioModule) throw new Error('NativeAudioModule not found');
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
            }
            const result = await NativeAudioModule.startRecording();
            recordingStartRef.current = Date.now();
            setIsRecording(true);
            setSearchText('');
            audioLevelIntervalRef.current = setInterval(async () => {
                try {
                    const levelResult = await NativeAudioModule.getAudioLevel();
                    setAudioLevel(levelResult.level || 0);
                    setRecordingDuration(Date.now() - recordingStartRef.current);
                } catch (e) {}
            }, 100);
        } catch (error) {
            Alert.alert('Recording Error', `${error}`);
        }
    };

    const stopListening = async () => {
        try {
            if (audioLevelIntervalRef.current) {
                clearInterval(audioLevelIntervalRef.current);
                audioLevelIntervalRef.current = null;
            }
            const result = await NativeAudioModule.stopRecording();
            setIsRecording(false);
            setAudioLevel(0);
            setIsTranscribing(true);
            const audioBase64 = result.audioBase64;
            if (!audioBase64) throw new Error('No audio data');
            const transcribeResult = await RunAnywhere.transcribe(audioBase64, {
                sampleRate: 16000,
                language: 'en',
            });
            if (transcribeResult.text) {
                setSearchText(transcribeResult.text);
                setIsSearching(true);
            }
            setIsTranscribing(false);
        } catch (error) {
            console.error('[STT] Error:', error);
            setIsTranscribing(false);
        }
    };

    const handleScan = async () => {
        try {
            const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
            if (result.assets && result.assets[0].uri) {
                const imageUri = result.assets[0].uri;
                const simulatedText = "Invoice #12345 - Total $50.00 (Simulated Scan)";
                indexDocument(simulatedText, imageUri, 'Scanned Doc');
                Alert.alert("Saved!", "Image saved with simulated text.");
            }
        } catch (e) {
            Alert.alert("Error", "Gallery failed.");
        }
    };

    const handleFullSync = async () => {
        try {
            // --- ADDED: RUNTIME PERMISSION CHECK ---
            if (Platform.OS === 'android') {
                const permission = Platform.Version >= 33 
                    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES 
                    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
                
                const hasPermission = await PermissionsAndroid.request(permission);
                if (hasPermission !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert("Permission Denied", "We need access to your photos to sync.");
                    return;
                }
            }

            setIsSyncing(true);
            setSyncCount(0);
            const total = await getGalleryTotalCount();
            setTotalImages(total);

            const finalCount = await performFullGallerySync((currentCount) => {
                setSyncCount(currentCount);
            });

            setIsSyncing(false);
            Alert.alert("Sync Complete", `Indexed ${finalCount} images from your gallery.`);
        } catch (error) {
            setIsSyncing(false);
            Alert.alert("Sync Failed", "Check terminal for [DEBUG] logs.");
        }
    };

    return {
        searchText, setSearchText, searchResults, isSearching, setIsSearching,
        selectedImage, setSelectedImage,
        isRecording, isTranscribing, audioLevel, recordingDuration,
        startListening, stopListening, 
        handleScan, 
        handleFullSync, isSyncing, syncCount, totalImages,
        handleShare: () => selectedImage && Share.share({ url: selectedImage }),
        handleEdit: () => selectedImage && Linking.openURL(selectedImage)
    };
};        