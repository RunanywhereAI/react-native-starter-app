import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { AppColors } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { useLiveTranscription } from '../hooks/useLiveTranscription';
import { LiveTranscript } from '../components/LiveTranscript';
import { SuggestionCard } from '../components/SuggestionCard';
import { CounterStrategyCard } from '../components/CounterStrategyCard';
import { CognitiveMeter } from '../components/CognitiveMeter';
import { getModeConfig } from '../ai/patternLibrary';
import { useCounterStrategy } from '../hooks/useCounterStrategy';
import { checkSTTModelReady } from '../services/SpeechService';
import { LocalStorageService } from '../services/LocalStorageService';
import { useModelService } from '../services/ModelService';

type LiveSessionScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'LiveSession'>;
  route: RouteProp<RootStackParamList, 'LiveSession'>;
};

export const LiveSessionScreen: React.FC<LiveSessionScreenProps> = ({ navigation, route }) => {
  const { mode } = route.params;
  const { sessionState, isRecording, startSession, stopSession, cancelSession, error } =
    useLiveTranscription();
  const [hasStarted, setHasStarted] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const { downloadAndLoadSTT, isSTTLoaded, isSTTLoading } = useModelService();

  const modeConfig = getModeConfig(mode);

  // Counter-strategy hook — processes detected patterns with cooldown & threshold
  const { activeStrategy } = useCounterStrategy(sessionState.detectedPatterns);

  // Check STT model status on mount
  useEffect(() => {
    const checkModelStatus = async () => {
      console.log('[LiveSessionScreen] 🔍 Checking STT model status...');

      // Check if debug mode is enabled
      const settings = await LocalStorageService.getSettings();
      const debugMode = settings.debugMode || false;

      if (debugMode) {
        console.log('[LiveSessionScreen] 🐛 Debug mode enabled, skipping STT model check');
        setModelReady(true);
        return;
      }

      // Check if model is already loaded
      if (isSTTLoaded) {
        console.log('[LiveSessionScreen] ✅ STT model already loaded');
        setModelReady(true);
        return;
      }

      // Check if model is currently loading
      if (isSTTLoading) {
        console.log('[LiveSessionScreen] ⏳ STT model loading, waiting...');
        // Model is being loaded, just wait
        return;
      }

      // Model not loaded, try to load it
      console.log('[LiveSessionScreen] 🤖 Starting STT model download and load...');
      try {
        await downloadAndLoadSTT();

        // Verify it loaded
        const ready = await checkSTTModelReady();
        if (ready) {
          console.log('[LiveSessionScreen] ✅ STT model loaded successfully');
          setModelReady(true);
        } else {
          console.error('[LiveSessionScreen] ❌ STT model failed to load');
          handleModelLoadFailure();
        }
      } catch (err) {
        console.error('[LiveSessionScreen] ❌ Failed to load STT model:', err);
        handleModelLoadFailure();
      }
    };

    const handleModelLoadFailure = () => {
      Alert.alert(
        'Model Loading Failed',
        'The speech recognition model could not be loaded.\n\nOptions:\n• Enable Debug Mode in Settings to test without audio\n• Check your internet connection\n• Try again',
        [
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
          {
            text: 'Try Again',
            onPress: () => {
              setModelReady(false);
              checkModelStatus();
            },
          },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
    };

    checkModelStatus();
  }, [navigation, downloadAndLoadSTT, isSTTLoaded, isSTTLoading]);

  // Watch for model loading completion
  useEffect(() => {
    if (isSTTLoaded && !modelReady) {
      console.log('[LiveSessionScreen] ✅ STT model loaded (via ModelService)');
      setModelReady(true);
    }
  }, [isSTTLoaded, modelReady]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK' }]);
    }
  }, [error]);

  useEffect(() => {
    // Auto-start session only when model is ready
    if (!hasStarted && modelReady) {
      console.log('[LiveSessionScreen] 🚀 Starting session (model ready)');
      setHasStarted(true);
      startSession(mode).catch((err) => {
        console.error('[LiveSessionScreen] ❌ Failed to start session:', err);
        navigation.goBack();
      });
    }
  }, [hasStarted, modelReady, mode, startSession, navigation]);

  const handleStop = () => {
    Alert.alert(
      'Stop Session',
      'Are you sure you want to stop this session? Your insights will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            const session = await stopSession();
            if (session) {
              navigation.navigate('Insights', { sessionId: session.id });
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel? This session will not be saved.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            await cancelSession();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get top 3 most recent patterns for suggestions
  const recentPatterns = sessionState.detectedPatterns.slice(-3).reverse();

  // Log when patterns change
  useEffect(() => {
    console.log('[LiveSessionScreen] 🎯 Detected patterns updated');
    console.log('[LiveSessionScreen] 📊 Total patterns:', sessionState.detectedPatterns.length);
    console.log('[LiveSessionScreen] 🔝 Recent patterns (top 3):', recentPatterns.length);

    if (recentPatterns.length > 0) {
      console.log('[LiveSessionScreen] 💡 Suggestions panel should be visible');
      recentPatterns.forEach((pattern, index) => {
        console.log(`[LiveSessionScreen] Pattern ${index + 1}:`, {
          id: pattern.id,
          pattern: pattern.pattern,
          confidence: pattern.confidenceScore,
          suggestion: pattern.suggestion,
        });
      });
    } else {
      console.log('[LiveSessionScreen] ⚠️ No patterns to display');
    }
  }, [sessionState.detectedPatterns.length]);

  // Log transcript updates
  useEffect(() => {
    console.log('[LiveSessionScreen] 📝 Transcript updated');
    console.log('[LiveSessionScreen] 📊 Total chunks:', sessionState.transcript.length);
    if (sessionState.transcript.length > 0) {
      const lastChunk = sessionState.transcript[sessionState.transcript.length - 1];
      console.log('[LiveSessionScreen] 📝 Last chunk:', lastChunk.text);
    }
  }, [sessionState.transcript.length]);

  // Show loading screen while model loads
  if (!modelReady) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={AppColors.primaryDark} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>
            {isSTTLoading ? '📥 Downloading Model...' : '🤖 Loading AI Model...'}
          </Text>
          <Text style={styles.loadingText}>
            {isSTTLoading ? 'First-time setup (~75MB)' : 'Preparing speech recognition'}
          </Text>
          <Text style={styles.loadingSubtext}>
            {isSTTLoading ? 'This only happens once' : 'Please wait...'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.primaryDark} />

      {/* Top Bar */}
      <LinearGradient colors={[AppColors.primaryDark, AppColors.primaryMid]} style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.topBarLeft}>
            <View style={styles.modeTag}>
              <Text style={styles.modeIcon}>{modeConfig.icon}</Text>
              <Text style={styles.modeText}>{modeConfig.displayName}</Text>
            </View>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatDuration(sessionState.duration)}</Text>
            </View>
          </View>

          <View style={styles.topBarRight}>
            <CognitiveMeter
              focusScore={sessionState.currentFocusScore}
              size={60}
              showLabel={false}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Transcript */}
      <View style={styles.transcriptContainer}>
        <LiveTranscript transcript={sessionState.transcript} highlightPatterns />
      </View>

      {/* Counter Strategy Card */}
      {activeStrategy && (
        <View style={styles.counterStrategyPanel}>
          <CounterStrategyCard strategy={activeStrategy} />
        </View>
      )}

      {/* Suggestions Panel */}
      {recentPatterns.length > 0 && (
        <View style={styles.suggestionsPanel}>
          <Text style={styles.suggestionsTitle}>💡 Live Suggestions</Text>
          {recentPatterns.map((pattern) => (
            <SuggestionCard key={pattern.id} pattern={pattern} />
          ))}
        </View>
      )}

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.8}>
          <LinearGradient colors={[AppColors.error, '#C53030']} style={styles.stopButtonGradient}>
            <Text style={styles.stopButtonIcon}>⏹️</Text>
            <Text style={styles.stopButtonText}>Stop Session</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Audio Level Visualizer (optional) */}
      {sessionState.audioLevel > 0 && (
        <View style={styles.audioVisualizer}>
          <View
            style={[
              styles.audioBar,
              {
                width: `${Math.min(sessionState.audioLevel * 100, 100)}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 13,
    color: AppColors.textMuted,
    textAlign: 'center',
  },
  topBar: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.textMuted + '20',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarLeft: {
    flex: 1,
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.accentCyan + '20',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  modeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.accentCyan,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: AppColors.error,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  topBarRight: {
    marginLeft: 16,
  },
  transcriptContainer: {
    flex: 1,
    backgroundColor: AppColors.primaryMid,
  },
  counterStrategyPanel: {
    backgroundColor: AppColors.primaryDark,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: AppColors.accentViolet + '30',
  },
  suggestionsPanel: {
    backgroundColor: AppColors.primaryDark,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '20',
    maxHeight: 300,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: AppColors.primaryDark,
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '20',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  stopButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: AppColors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  stopButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  stopButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  audioVisualizer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: AppColors.surfaceCard,
  },
  audioBar: {
    height: '100%',
    backgroundColor: AppColors.accentCyan,
  },
});
