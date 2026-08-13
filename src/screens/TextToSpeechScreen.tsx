import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RunAnywhere } from '@runanywhere/core';
import { AppColors } from '../theme';

// `SpeechHandle` (the return type of tts.speak) is not re-exported by name
// from '@runanywhere/core', so it is named structurally here.
type SpeechHandle = ReturnType<typeof RunAnywhere.tts.speak>;
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
  // The SDK's speak() synthesizes AND plays back through its own in-SDK
  // audio player in one awaited call — no host-app native module or manual
  // WAV file handling required.
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const speechRef = useRef<SpeechHandle | null>(null);

  const synthesizeAndPlay = async () => {
    if (!text.trim() || isSpeaking) {
      return;
    }

    setIsSpeaking(true);
    try {
      // RunAnywhere.tts.speak() synthesizes and plays through the SDK's own
      // AudioPlaybackManager, returning a handle immediately; awaiting
      // waitForPlayout() resolves once playback finishes or is interrupted.
      const handle = RunAnywhere.tts.speak(text, {
        speed: speechRate,
        pitch: 1.0,
      });
      speechRef.current = handle;
      await handle.waitForPlayout();
      if (handle.error) {
        console.error('[TTS] Error:', handle.error);
      }
    } catch (error) {
      console.error('[TTS] Error:', error);
    } finally {
      speechRef.current = null;
      setIsSpeaking(false);
    }
  };

  const stopPlayback = async () => {
    await speechRef.current?.interrupt();
    setIsSpeaking(false);
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
        <View style={[styles.playbackArea, isSpeaking && styles.playbackActive]}>
          {isSpeaking ? (
            <>
              <View style={styles.waveform}>
                {[...Array(7)].map((_, i) => (
                  <View key={i} style={styles.waveBar} />
                ))}
              </View>
              <Text style={styles.playbackStatus}>Speaking...</Text>
            </>
          ) : (
            <>
              <Text style={styles.playbackIcon}>🔊</Text>
              <Text style={styles.playbackStatus}>Tap to synthesize</Text>
            </>
          )}

          {/* Play Button */}
          <TouchableOpacity
            onPress={isSpeaking ? stopPlayback : synthesizeAndPlay}
            disabled={!text.trim()}
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
                {isSpeaking ? '⏹' : '▶️'}
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
