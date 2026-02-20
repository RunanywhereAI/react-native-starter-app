import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert, NativeModules } from 'react-native';
import { RunAnywhere } from '@runanywhere/core';
import { useModelService } from '../services/ModelService';
import { AppLogger } from '../utils/AppLogger';

const { NativeAudioModule } = NativeModules;

/**
 * useVoiceRecording — handles mic recording, STT model loading, and transcription.
 * Returns transcribed text via `onTranscription` callback.
 */
export const useVoiceRecording = (onTranscription: (text: string) => void) => {
    const { isSTTLoaded, isSTTLoading, isSTTDownloading, downloadAndLoadSTT } = useModelService();

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartRef = useRef<number>(0);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    const cleanupRecording = useCallback(() => {
        if (audioLevelIntervalRef.current) {
            clearInterval(audioLevelIntervalRef.current);
            audioLevelIntervalRef.current = null;
        }
        if (autoStopRef.current) {
            clearTimeout(autoStopRef.current);
            autoStopRef.current = null;
        }
    }, []);

    const stopListening = useCallback(async () => {
        if (!isRecordingRef.current) return;
        isRecordingRef.current = false;
        cleanupRecording();

        try {
            const result = await NativeAudioModule.stopRecording();
            setIsRecording(false);
            setAudioLevel(0);
            setIsTranscribing(true);

            if (!result.audioBase64) throw new Error('No audio data captured');

            const transcribeResult = await RunAnywhere.transcribe(result.audioBase64, {
                sampleRate: 16000,
                language: 'auto',
            });

            if (transcribeResult.text) {
                onTranscription(transcribeResult.text);
            }
            setIsTranscribing(false);
        } catch (error) {
            AppLogger.error('VoiceRecording', 'STT Error', error);
            setIsRecording(false);
            setIsTranscribing(false);
        }
    }, [onTranscription, cleanupRecording]);

    const startListening = useCallback(async () => {
        // If model is busy, show brief inline feedback
        if (isSTTDownloading || isSTTLoading) {
            setIsModelLoading(true);
            return;
        }
        if (!isSTTLoaded) {
            setIsModelLoading(true);
            downloadAndLoadSTT().finally(() => setIsModelLoading(false));
            return;
        }
        setIsModelLoading(false);

        try {
            if (!NativeAudioModule) {
                AppLogger.error('VoiceRecording', 'NativeAudioModule not found');
                Alert.alert('Error', 'Audio module not available on this device.');
                return;
            }

            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
            }

            await NativeAudioModule.startRecording();
            recordingStartRef.current = Date.now();
            isRecordingRef.current = true;
            setIsRecording(true);

            // Auto-stop after 15 seconds
            autoStopRef.current = setTimeout(() => {
                stopListening();
            }, 15000);

            audioLevelIntervalRef.current = setInterval(async () => {
                try {
                    const levelResult = await NativeAudioModule.getAudioLevel();
                    setAudioLevel(levelResult.level || 0);
                    setRecordingDuration(Date.now() - recordingStartRef.current);
                } catch (e) {
                    // Audio level polling failure is non-critical
                }
            }, 100);
        } catch (error) {
            AppLogger.error('VoiceRecording', 'Recording start failed', error);
            Alert.alert('Recording Error', `${error}`);
        }
    }, [isSTTDownloading, isSTTLoading, isSTTLoaded, downloadAndLoadSTT, stopListening]);

    return {
        isRecording, isTranscribing, isModelLoading,
        audioLevel, recordingDuration,
        startListening, stopListening,
        cleanupRecording,
    };
};
