import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert, NativeModules, Vibration } from 'react-native';
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

    // Watch for background STT loading completion to clear the hourglass UI state
    useEffect(() => {
        if (!isSTTDownloading && !isSTTLoading && isModelLoading) {
            setIsModelLoading(false);
        }
    }, [isSTTDownloading, isSTTLoading, isModelLoading]);

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
            Vibration.vibrate([0, 30, 50, 30]); // Error double buzz
            setIsRecording(false);
            setIsTranscribing(false);
        }
    }, [onTranscription, cleanupRecording]);

    const startListening = useCallback(async () => {
        // If model is actively being downloaded/loaded, show brief inline feedback
        if (isSTTDownloading || isSTTLoading) {
            setIsModelLoading(true);
            return;
        }
        // If model not loaded yet, load it first and then proceed to record
        if (!isSTTLoaded) {
            setIsModelLoading(true);
            try {
                await downloadAndLoadSTT();
            } catch (e) {
                AppLogger.warn('VoiceRecording', 'Model load attempt failed, proceeding anyway', e);
            }
            setIsModelLoading(false);
            // Fall through to recording below — don't return
        }

        try {
            Vibration.vibrate(40); // Solid thud when starting

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

            // Auto-stop after 10 seconds
            autoStopRef.current = setTimeout(() => {
                stopListening();
            }, 10000);

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
            Vibration.vibrate([0, 30, 50, 30]);
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
