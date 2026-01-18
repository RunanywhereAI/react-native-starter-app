import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { RunAnywhere } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';

const SAMPLE_TEXTS = [
  'Hello! Welcome to RunAnywhere. Experience the power of on-device AI.',
  'The quick brown fox jumps over the lazy dog.',
  'Technology is best when it brings people together.',
  'Privacy is not something that I am merely entitled to, it is an absolute prerequisite.',
];

export const TextToSpeechScreen: React.FC = () => {
  const modelService = useModelService();
  const [text, setText] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Setup audio mode and cleanup on unmount
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const synthesizeAndPlay = async () => {
    if (!text.trim()) {
      return;
    }

    setIsSynthesizing(true);

    try {
      // Per docs: https://docs.runanywhere.ai/react-native/tts/synthesize
      // result.audio contains base64-encoded float32 PCM
      const result = await RunAnywhere.synthesize(text, { 
        rate: speechRate,
        pitch: 1.0,
        volume: 1.0,
      });

      console.log(`[TTS] Synthesized: duration=${result.duration}s, sampleRate=${result.sampleRate}Hz, numSamples=${result.numSamples}`);

      // Convert base64 float32 PCM to WAV
      const wavData = createWavFromBase64Float32(result.audio, result.sampleRate, result.numSamples);

      // Save to temporary file
      const tempPath = `${FileSystem.cacheDirectory}tts_output_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(tempPath, wavData, { encoding: FileSystem.EncodingType.Base64 });

      // Verify file was created
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      if (!fileInfo.exists) {
        throw new Error('Failed to create audio file');
      }

      console.log(`[TTS] WAV file created: ${tempPath}, size: ${fileInfo.size} bytes`);

      setCurrentAudioPath(tempPath);
      setIsSynthesizing(false);
      setIsPlaying(true);

      // Play using expo-av
      try {
        // Unload previous sound if any
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: tempPath },
          { shouldPlay: true }
        );
        soundRef.current = sound;

        console.log(`[TTS] Playback started with expo-av`);

        // Listen for playback status
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            setCurrentAudioPath(null);
            // Clean up
            sound.unloadAsync().catch(() => {});
            FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
          }
        });
      } catch (playError) {
        console.error('[TTS] Playback error:', playError);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('[TTS] Error:', error);
      setIsSynthesizing(false);
      setIsPlaying(false);
    }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (e) {
        // Ignore
      }
    }
    setIsPlaying(false);
    
    // Clean up file
    if (currentAudioPath) {
      FileSystem.deleteAsync(currentAudioPath, { idempotent: true }).catch(() => {});
      setCurrentAudioPath(null);
    }
  };

  // Convert base64-encoded float32 PCM to WAV format
  const createWavFromBase64Float32 = (base64Audio: string, sampleRate: number, numSamples: number): string => {
    // Decode base64 to get float32 samples
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const float32Samples = new Float32Array(bytes.buffer);

    // Use actual sample count from decoded data
    const actualNumSamples = float32Samples.length;
    console.log(`[TTS] Converting ${actualNumSamples} float32 samples to WAV (expected: ${numSamples})`);

    // Create WAV buffer (44 byte header + 16-bit PCM data)
    const wavBuffer = new ArrayBuffer(44 + actualNumSamples * 2);
    const view = new DataView(wavBuffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + actualNumSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // AudioFormat (PCM)
    view.setUint16(22, 1, true);  // NumChannels (mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true);  // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, actualNumSamples * 2, true);

    // Convert float32 samples to int16
    let offset = 44;
    for (let i = 0; i < float32Samples.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    // Convert to base64
    const uint8Array = new Uint8Array(wavBuffer);
    let result = '';
    for (let i = 0; i < uint8Array.length; i++) {
      result += String.fromCharCode(uint8Array[i]);
    }
    return btoa(result);
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  if (!modelService.isTTSLoaded) {
    return (
      <ModelLoaderWidget
        title="TTS Voice Required"
        subtitle="Download and load the voice synthesis model"
        icon="volume"
        accentColor={AppColors.accentPink}
        isDownloading={modelService.isTTSDownloading}
        isLoading={modelService.isTTSLoading}
        progress={modelService.ttsDownloadProgress}
        onLoad={modelService.downloadAndLoadTTS}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Input Section */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Enter text to synthesize..."
            placeholderTextColor={AppColors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={5}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.characterCount}>
              📝 {text.length} characters
            </Text>
            {text.length > 0 && (
              <TouchableOpacity onPress={() => setText('')}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsCard}>
          <Text style={styles.controlLabel}>Speech Rate</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderIcon}>🐌</Text>
            <Text style={styles.sliderValue}>{speechRate.toFixed(1)}x</Text>
            <Text style={styles.sliderIcon}>🚀</Text>
          </View>
          <View style={styles.rateButtons}>
            {[0.5, 0.75, 1.0, 1.5, 2.0].map((rate) => (
              <TouchableOpacity
                key={rate}
                onPress={() => setSpeechRate(rate)}
                style={[
                  styles.rateButton,
                  speechRate === rate && styles.rateButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.rateButtonText,
                    speechRate === rate && styles.rateButtonTextActive,
                  ]}
                >
                  {rate}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Playback Area */}
        <View style={[styles.playbackArea, isPlaying && styles.playbackActive]}>
          {isPlaying ? (
            <>
              <View style={styles.waveform}>
                {[...Array(7)].map((_, i) => (
                  <View key={i} style={styles.waveBar} />
                ))}
              </View>
              <Text style={styles.playbackStatus}>Playing...</Text>
            </>
          ) : isSynthesizing ? (
            <>
              <Text style={styles.loadingIcon}>⏳</Text>
              <Text style={styles.playbackStatus}>Synthesizing...</Text>
            </>
          ) : (
            <>
              <Text style={styles.playbackIcon}>🔊</Text>
              <Text style={styles.playbackStatus}>Tap to synthesize</Text>
            </>
          )}

          {/* Play Button */}
          <TouchableOpacity
            onPress={isPlaying ? stopPlayback : synthesizeAndPlay}
            disabled={isSynthesizing || !text.trim()}
            activeOpacity={0.8}
            style={styles.playButtonWrapper}
          >
            <LinearGradient
              colors={[AppColors.accentPink, '#DB2777']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playButton}
            >
              <Text style={styles.playButtonIcon}>
                {isSynthesizing ? '⏳' : isPlaying ? '⏹' : '▶️'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Sample Texts */}
        <View style={styles.samplesSection}>
          <Text style={styles.samplesTitle}>Sample Texts</Text>
          {SAMPLE_TEXTS.map((sample, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setText(sample)}
              style={styles.sampleItem}
            >
              <Text style={styles.sampleText} numberOfLines={2}>
                {sample}
              </Text>
              <Text style={styles.sampleIcon}>➕</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  inputCard: {
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.accentPink + '33',
    marginBottom: 24,
    overflow: 'hidden',
  },
  input: {
    padding: 20,
    fontSize: 15,
    color: AppColors.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: AppColors.primaryMid,
  },
  characterCount: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  clearText: {
    fontSize: 14,
    color: AppColors.accentPink,
    fontWeight: '600',
  },
  controlsCard: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    marginBottom: 24,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sliderIcon: {
    fontSize: 20,
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.accentPink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: AppColors.accentPink + '20',
    borderRadius: 12,
  },
  rateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rateButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: AppColors.surfaceElevated,
    borderRadius: 8,
    alignItems: 'center',
  },
  rateButtonActive: {
    backgroundColor: AppColors.accentPink + '40',
  },
  rateButtonText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  rateButtonTextActive: {
    color: AppColors.accentPink,
  },
  playbackArea: {
    padding: 24,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    alignItems: 'center',
    marginBottom: 32,
  },
  playbackActive: {
    borderColor: AppColors.accentPink + '80',
    borderWidth: 2,
    shadowColor: AppColors.accentPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  waveform: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  waveBar: {
    width: 6,
    height: 40,
    backgroundColor: AppColors.accentPink,
    borderRadius: 3,
  },
  playbackIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  playbackStatus: {
    fontSize: 14,
    color: AppColors.textSecondary,
    marginBottom: 24,
  },
  playButtonWrapper: {
    marginTop: 8,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: AppColors.accentPink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  playButtonIcon: {
    fontSize: 32,
  },
  samplesSection: {
    marginBottom: 24,
  },
  samplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textMuted,
    marginBottom: 12,
  },
  sampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: AppColors.surfaceCard + '80',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    marginBottom: 12,
  },
  sampleText: {
    flex: 1,
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  sampleIcon: {
    fontSize: 20,
    color: AppColors.accentPink + '99',
    marginLeft: 8,
  },
});
