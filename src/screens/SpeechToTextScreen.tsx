import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  NativeModules,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { RunAnywhere } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget, AudioVisualizer } from '../components';

// Native Audio Module - records in WAV format (16kHz mono) optimal for Whisper STT
// Available in RunAnywhere AI Studio app
const { NativeAudioModule } = NativeModules;

export const SpeechToTextScreen: React.FC = () => {
  const modelService = useModelService();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const useNativeRecording = useRef<boolean>(false); // Track if using native module

  // Setup audio mode and cleanup on unmount
  useEffect(() => {
    // Check if NativeAudioModule is available (in AI Studio app)
    useNativeRecording.current = !!NativeAudioModule;
    console.log('[STT] NativeAudioModule available:', useNativeRecording.current);
    
    return () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (useNativeRecording.current && NativeAudioModule) {
        NativeAudioModule.cancelRecording().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Check if NativeAudioModule is available (records WAV format)
      if (NativeAudioModule && Platform.OS === 'android') {
        console.warn('[STT] Using NativeAudioModule for WAV recording');
        
        // Request permission using expo-av (also grants for native)
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Denied', 'Microphone permission is required for speech recognition.');
          return;
        }
        
        const result = await NativeAudioModule.startRecording();
        console.warn('[STT] Native recording started at:', result.path);
        
        useNativeRecording.current = true;
        recordingStartRef.current = Date.now();
        setIsRecording(true);
        setTranscription('');
        setRecordingDuration(0);

        // Poll for audio levels from native module
        audioLevelIntervalRef.current = setInterval(async () => {
          try {
            const levelResult = await NativeAudioModule.getAudioLevel();
            setAudioLevel(levelResult.level || 0);
            setRecordingDuration(Date.now() - recordingStartRef.current);
          } catch (e) {
            // Ignore errors during polling
          }
        }, 100);
        
        return;
      }

      // Fallback to expo-av recording
      useNativeRecording.current = false;
      
      // Request permission using expo-av
      console.warn('[STT] Requesting microphone permission...');
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required for speech recognition.');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      console.warn('[STT] Starting expo-av recording...');
      
      // Create recording optimized for Whisper STT (16kHz mono PCM)
      const recording = new Audio.Recording();
      
      if (Platform.OS === 'ios') {
        // iOS: Record as WAV with Linear PCM - optimal for Whisper
        await recording.prepareToRecordAsync({
          isMeteringEnabled: true,
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });
      } else {
        // Android without NativeAudioModule: expo-av can only record compressed formats
        console.warn('[STT] Android: Recording m4a format (limited STT support without NativeAudioModule)');
        await recording.prepareToRecordAsync({
          isMeteringEnabled: true,
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });
      }
      
      await recording.startAsync();
      recordingRef.current = recording;
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setTranscription('');
      setRecordingDuration(0);

      // Poll for recording duration
      audioLevelIntervalRef.current = setInterval(async () => {
        try {
          setRecordingDuration(Date.now() - recordingStartRef.current);
          // Simulate audio level (expo-av doesn't have direct metering access)
          setAudioLevel(Math.random() * 0.5 + 0.3);
        } catch (e) {
          // Ignore errors during polling
        }
      }, 100);

      console.warn('[STT] Recording started');
    } catch (error) {
      console.error('[STT] Recording error:', error);
      Alert.alert('Recording Error', `Failed to start recording: ${error}`);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    try {
      // Clear audio level polling
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }

      setIsRecording(false);
      setAudioLevel(0);
      setIsTranscribing(true);

      let audioBase64: string;
      let filePath: string;

      // Handle NativeAudioModule recording (Android with AI Studio)
      if (useNativeRecording.current && NativeAudioModule) {
        console.warn('[STT] Stopping native recording...');
        const result = await NativeAudioModule.stopRecording();
        
        audioBase64 = result.audioBase64;
        filePath = result.path;
        
        console.warn('[STT] Native recording stopped, file:', filePath, 'size:', result.fileSize);

        if (result.fileSize < 1000) {
          throw new Error('Recording too short - please speak longer');
        }
      } else {
        // Handle expo-av recording
        if (!recordingRef.current) {
          throw new Error('No active recording');
        }

        console.warn('[STT] Stopping expo-av recording...');
        await recordingRef.current.stopAndUnloadAsync();
        
        // Reset audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        // Get the recorded file URI
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        
        if (!uri) {
          throw new Error('No audio file recorded');
        }

        filePath = uri;

        // Read the file info
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists || fileInfo.size < 1000) {
          throw new Error('Recording too short - please speak longer');
        }

        console.warn('[STT] Recording stopped, file:', uri, 'size:', fileInfo.size);
        
        // For expo-av, we'll use transcribeFile
        audioBase64 = '';
      }

      // Check if STT model is loaded
      const isModelLoaded = await RunAnywhere.isSTTModelLoaded();
      if (!isModelLoaded) {
        throw new Error('STT model not loaded. Please download and load the model first.');
      }

      let transcribeResult;
      
      if (useNativeRecording.current && audioBase64) {
        // Native recording: use base64 PCM data directly with transcribe()
        console.warn('[STT] Transcribing with native audio data, base64 length:', audioBase64.length);
        transcribeResult = await RunAnywhere.transcribe(audioBase64, {
          sampleRate: 16000,
          language: 'en',
        });
      } else if (Platform.OS === 'ios') {
        // iOS with expo-av: WAV file - use transcribeFile directly
        console.warn('[STT] iOS: Transcribing WAV file:', filePath);
        transcribeResult = await RunAnywhere.transcribeFile(filePath, {
          language: 'en',
        });
      } else {
        // Android without NativeAudioModule: m4a file - SDK doesn't support
        console.warn('[STT] Android: Attempting to transcribe m4a file (may have limited support):', filePath);
        
        // Strip file:// prefix for Android native code
        const nativePath = filePath.replace('file://', '');
        
        try {
          transcribeResult = await RunAnywhere.transcribeFile(nativePath, {
            language: 'en',
          });
        } catch (androidError) {
          console.error('[STT] Android transcription failed:', androidError);
          throw new Error(
            'Android STT requires WAV format audio. ' +
            'expo-av cannot record WAV on Android. ' +
            'For full Android STT support, use RunAnywhere AI Studio app.'
          );
        }
      }

      console.warn('[STT] Transcription result:', transcribeResult);

      if (transcribeResult.text) {
        setTranscription(transcribeResult.text);
        setTranscriptionHistory(prev => [transcribeResult.text, ...prev]);
      } else {
        setTranscription('(No speech detected)');
      }

      // Clean up the recorded file
      FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
      setIsTranscribing(false);
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTranscription(`Error: ${errorMessage}`);
      Alert.alert('Transcription Error', errorMessage);
      setIsTranscribing(false);
    }
  };

  const handleClearHistory = () => {
    setTranscriptionHistory([]);
    setTranscription('');
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!modelService.isSTTLoaded) {
    return (
      <ModelLoaderWidget
        title="STT Model Required"
        subtitle="Download and load the speech recognition model"
        icon="mic"
        accentColor={AppColors.accentViolet}
        isDownloading={modelService.isSTTDownloading}
        isLoading={modelService.isSTTLoading}
        progress={modelService.sttDownloadProgress}
        onLoad={modelService.downloadAndLoadSTT}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Recording Area */}
        <View style={[styles.recordingArea, isRecording && styles.recordingActive]}>
          {isRecording ? (
            <>
              <AudioVisualizer level={audioLevel} />
              <Text style={[styles.statusTitle, { color: AppColors.accentViolet }]}>
                Listening...
              </Text>
              <Text style={styles.statusSubtitle}>
                {formatDuration(recordingDuration)}
              </Text>
            </>
          ) : isTranscribing ? (
            <>
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingIcon}>⏳</Text>
              </View>
              <Text style={styles.statusTitle}>Transcribing...</Text>
            </>
          ) : (
            <>
              <View style={styles.micContainer}>
                <Text style={styles.micIcon}>🎤</Text>
              </View>
              <Text style={styles.statusTitle}>Tap to Record</Text>
              <Text style={styles.statusSubtitle}>On-device speech recognition (WAV 16kHz)</Text>
            </>
          )}
        </View>

        {/* Current Transcription */}
        {(transcription || isTranscribing) && (
          <View style={styles.transcriptionCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>LATEST</Text>
            </View>
            <Text style={styles.transcriptionText}>
              {isTranscribing ? 'Processing...' : transcription}
            </Text>
          </View>
        )}

        {/* History */}
        {transcriptionHistory.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>History</Text>
              <TouchableOpacity onPress={handleClearHistory}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            {transcriptionHistory.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Record Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={isRecording ? stopRecordingAndTranscribe : startRecording}
          disabled={isTranscribing}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isRecording ? [AppColors.error, '#DC2626'] : [AppColors.accentViolet, '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.recordButton}
          >
            <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎤'}</Text>
            <Text style={styles.recordButtonText}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  recordingArea: {
    padding: 32,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    alignItems: 'center',
    marginBottom: 24,
  },
  recordingActive: {
    borderColor: AppColors.accentViolet + '80',
    borderWidth: 2,
    shadowColor: AppColors.accentViolet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  micContainer: {
    width: 100,
    height: 100,
    backgroundColor: AppColors.accentViolet + '20',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  micIcon: {
    fontSize: 48,
  },
  loadingContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingIcon: {
    fontSize: 48,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  transcriptionCard: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.accentViolet + '40',
    marginBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: AppColors.accentViolet + '33',
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.accentViolet,
  },
  transcriptionText: {
    fontSize: 15,
    color: AppColors.textPrimary,
    lineHeight: 22,
  },
  historySection: {
    marginBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  clearButton: {
    fontSize: 14,
    color: AppColors.accentViolet,
  },
  historyItem: {
    padding: 16,
    backgroundColor: AppColors.surfaceCard + '80',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    marginBottom: 12,
  },
  historyText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 24,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '1A',
  },
  recordButton: {
    flexDirection: 'row',
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: AppColors.accentViolet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  recordIcon: {
    fontSize: 28,
  },
  recordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
