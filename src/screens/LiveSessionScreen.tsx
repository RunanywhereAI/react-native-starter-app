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
  const [modelError, setModelError] = useState(false);
  const { downloadAndLoadSTT, isSTTLoaded, isSTTLoading, isSTTDownloading, isSDKReady, sttDownloadProgress } = useModelService();

  const modeConfig = getModeConfig(mode);

  // Counter-strategy hook — processes detected patterns with cooldown & threshold
  const { activeStrategy } = useCounterStrategy(sessionState.detectedPatterns);

  // Kick off model download+load when SDK is ready
  useEffect(() => {
    if (!isSDKReady) {
      console.log('[LiveSessionScreen] ⏳ Waiting for SDK to initialize...');
      return;
    }

    const initModel = async () => {
      console.log('[LiveSessionScreen] 🔍 Checking STT model status...');

      // Check if debug mode is enabled
      const settings = await LocalStorageService.getSettings();
      const debugMode = settings.debugMode || false;

      if (debugMode) {
        console.log('[LiveSessionScreen] 🐛 Debug mode enabled, skipping STT model check');
        setModelReady(true);
        return;
      }

      // If already loaded, we're done
      if (isSTTLoaded) {
        console.log('[LiveSessionScreen] ✅ STT model already loaded');
        setModelReady(true);
        return;
      }

      // Kick off download+load (fire and forget — we'll watch isSTTLoaded state)
      console.log('[LiveSessionScreen] 🤖 Starting STT model download and load...');
      downloadAndLoadSTT().catch((err) => {
        console.error('[LiveSessionScreen] ❌ downloadAndLoadSTT error:', err);
        setModelError(true);
      });
    };

    initModel();
  }, [isSDKReady]); // Only run once when SDK becomes ready

  // Watch for model loading completion from ModelService state
  useEffect(() => {
    if (isSTTLoaded && !modelReady) {
      console.log('[LiveSessionScreen] ✅ STT model loaded (via ModelService state)');
      setModelReady(true);
      setModelError(false);
    }
  }, [isSTTLoaded, modelReady]);

  // Watch for errors — show failure only when download/load finishes with error 
  // (not while still downloading)
  useEffect(() => {
    if (modelError && !isSTTDownloading && !isSTTLoading && !isSTTLoaded) {
      Alert.alert(
        'Model Loading Failed',
        'The speech recognition model could not be loaded.\n\nOptions:\n• Enable Debug Mode in Settings to test without audio\n• Check your internet connection\n• Try again',
        [
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
          {
            text: 'Try Again',
            onPress: () => {
              setModelError(false);
              downloadAndLoadSTT().catch(() => setModelError(true));
            },
          },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
    }
  }, [modelError, isSTTDownloading, isSTTLoading, isSTTLoaded, navigation, downloadAndLoadSTT]);

  useEffect(() => {
    if (error) Alert.alert('Error', error, [{ text: 'OK' }]);
  }, [error]);

  useEffect(() => {
    if (!hasStarted && modelReady) {
      setHasStarted(true);
      startSession(mode).catch(() => navigation.goBack());
    }
  }, [hasStarted, modelReady, mode, startSession, navigation]);

  const handleStop = () => {
    Alert.alert('Stop Session', 'Your insights will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop', style: 'destructive', onPress: async () => {
          const session = await stopSession();
          session ? navigation.navigate('Insights', { sessionId: session.id }) : navigation.goBack();
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('Cancel Session', 'This session will not be saved.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          await cancelSession(); navigation.goBack();
        },
      },
    ]);
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const recentPatterns = sessionState.detectedPatterns.slice(-3).reverse();

  if (!modelReady) {
    const loadingTitle = !isSDKReady
      ? '🔧 Initializing AI Engine...'
      : isSTTDownloading
        ? `📥 Downloading Model... ${Math.round(sttDownloadProgress)}%`
        : isSTTLoading
          ? '🤖 Loading AI Model...'
          : '🤖 Preparing AI Model...';
    const loadingText = !isSDKReady
      ? 'Setting up on-device AI'
      : isSTTDownloading
        ? 'First-time setup (~75MB)'
        : isSTTLoading
          ? 'Almost ready...'
          : 'Preparing speech recognition';
    const loadingSubtext = !isSDKReady
      ? 'This only takes a moment'
      : isSTTDownloading
        ? 'This only happens once'
        : 'Please wait...';

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={AppColors.primaryLight} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>{loadingTitle}</Text>
          <Text style={styles.loadingText}>{loadingText}</Text>
          <Text style={styles.loadingText}>{loadingSubtext}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.primaryLight} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View style={styles.topBarLeft}>
            <View style={styles.modeTag}>
              <Text style={styles.modeIconText}>{modeConfig.icon}</Text>
              <Text style={styles.modeText}>{modeConfig.displayName}</Text>
            </View>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatDuration(sessionState.duration)}</Text>
            </View>
          </View>
          <View style={styles.topBarRight}>
            <CognitiveMeter focusScore={sessionState.currentFocusScore} size={60} showLabel={false} />
          </View>
        </View>
      </View>

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

      {sessionState.audioLevel > 0 && (
        <View style={styles.audioVisualizer}>
          <LinearGradient colors={['#7B61FF', '#9B82FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.audioBar, { width: `${Math.min(sessionState.audioLevel * 100, 100)}%` }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.primaryLight },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingIconCircle: { width: 80, height: 80, borderRadius: 28, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  loadingIcon: { fontSize: 36 },
  loadingTitle: { fontSize: 22, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 8, textAlign: 'center' },
  loadingText: { fontSize: 15, color: AppColors.textSecondary, marginBottom: 32, textAlign: 'center' },
  loadingBarBg: { width: '60%', height: 6, borderRadius: 3, backgroundColor: '#EDE9FE', overflow: 'hidden' },
  loadingBar: { width: '45%', height: '100%', borderRadius: 3 },

  topBar: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#FFFFFF', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  topBarContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarLeft: { flex: 1 },
  modeTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 },
  modeIconText: { fontSize: 16, marginRight: 6 },
  modeText: { fontSize: 13, fontWeight: '600', color: AppColors.accentPrimary },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center' },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: AppColors.error, marginRight: 8 },
  recordingText: { fontSize: 24, fontWeight: '700', color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  topBarRight: { marginLeft: 16 },

  transcriptContainer: { flex: 1, backgroundColor: AppColors.primaryLight },

  counterStrategyPanel: { backgroundColor: '#FFFFFF', paddingTop: 12, paddingBottom: 4, borderTopWidth: 1, borderTopColor: AppColors.accentViolet + '20' },

  suggestionsPanel: { backgroundColor: '#FFFFFF', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', maxHeight: 300 },
  suggestionsTitle: { fontSize: 16, fontWeight: '700', color: AppColors.textPrimary, marginHorizontal: 16, marginBottom: 12 },

  bottomActions: { flexDirection: 'row', padding: 16, paddingBottom: 28, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 12 },
  cancelButton: { flex: 1, padding: 16, backgroundColor: '#F3F4F6', borderRadius: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: AppColors.textSecondary },
  stopButton: { flex: 2, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: AppColors.error, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
  stopButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
  stopButtonIcon: { fontSize: 20, marginRight: 8 },
  stopButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  audioVisualizer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#EDE9FE' },
  audioBar: { height: '100%', borderRadius: 2 },
});
