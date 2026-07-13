import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RunAnywhere, VoiceAgentMicDriver } from '@runanywhere/core';
import type {
  VoiceAgentMicTurn,
  VoiceAgentMicPhase,
} from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget, AudioVisualizer } from '../components';

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export const VoicePipelineScreen: React.FC = () => {
  const modelService = useModelService();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  // The mic driver is the audio ingress: it captures mic frames, segments
  // utterances, runs each one through the full VAD -> STT -> LLM -> TTS
  // pipeline (processVoiceTurn), surfaces the turn, and plays the synthesized
  // reply — all internally. The screen only needs to react to turn/phase/error
  // callbacks; there is no manual WAV encoding or native audio module here.
  const micDriverRef = useRef<VoiceAgentMicDriver | null>(null);

  const cleanupVoiceSession = useCallback(async () => {
    if (micDriverRef.current) {
      micDriverRef.current.stop();
      micDriverRef.current = null;
    }
    try {
      await RunAnywhere.cleanupVoiceAgent();
    } catch (error) {
      console.error('[VoicePipeline] cleanupVoiceAgent failed:', error);
    }
  }, []);

  // Tear down mic capture + the voice agent if the user navigates away while
  // a session is active.
  useEffect(() => {
    return () => {
      void cleanupVoiceSession();
    };
  }, [cleanupVoiceSession]);

  // Map the mic driver's coarse phase to a human-readable status + a rough
  // audio-level value for the visualizer.
  const handlePhase = useCallback((phase: VoiceAgentMicPhase) => {
    switch (phase) {
      case 'listening':
        setStatus('Listening...');
        setAudioLevel(0.3);
        break;
      case 'processing':
        setStatus('Thinking...');
        setAudioLevel(0.5);
        break;
      case 'speaking':
        setStatus('Speaking...');
        setAudioLevel(0.8);
        break;
    }
  }, []);

  // Append a finished turn as distinct user + assistant conversation bubbles.
  const handleTurn = useCallback((turn: VoiceAgentMicTurn) => {
    setConversation((prev) => {
      const next = [...prev];
      if (turn.userText.length > 0) {
        next.push({ role: 'user', text: turn.userText, timestamp: new Date() });
      }
      if (turn.assistantText.length > 0) {
        next.push({ role: 'assistant', text: turn.assistantText, timestamp: new Date() });
      }
      return next;
    });
  }, []);

  const handleTurnError = useCallback((error: Error) => {
    console.error('[VoicePipeline] Voice turn error:', error);
    setStatus(`Error: ${error.message}`);
    setAudioLevel(0);
  }, []);

  // Start voice session: compose the pipeline against the already-loaded
  // LLM/STT/TTS models, then let the mic driver own capture -> turn ->
  // playback for as long as the session stays active.
  const startVoiceAgent = async () => {
    if (!modelService.isVoiceAgentReady) return;

    setIsActive(true);
    setStatus('Starting...');

    try {
      await RunAnywhere.initializeVoiceAgentWithLoadedModels();

      const driver = new VoiceAgentMicDriver();
      micDriverRef.current = driver;
      const started = await driver.start({
        onTurn: handleTurn,
        onPhase: handlePhase,
        onError: handleTurnError,
      });

      if (!started) {
        micDriverRef.current = null;
        await cleanupVoiceSession();
        setIsActive(false);
        setStatus('Ready');
        Alert.alert(
          'Microphone needed',
          'Grant microphone permission to use the voice agent.'
        );
        return;
      }

      setStatus('Listening...');
      setAudioLevel(0.3);
    } catch (error) {
      console.error('[VoicePipeline] Voice agent error:', error);
      setStatus(`Error: ${error}`);
      setIsActive(false);
      await cleanupVoiceSession();
    }
  };

  const stopVoiceAgent = async () => {
    try {
      await cleanupVoiceSession();
    } finally {
      setIsActive(false);
      setStatus('Ready');
      setAudioLevel(0);
    }
  };

  const clearConversation = () => {
    setConversation([]);
  };

  if (!modelService.isVoiceAgentReady) {
    return (
      <ModelLoaderWidget
        title="Voice Agent Setup Required"
        subtitle="Download and load all models (LLM, STT, TTS) to use the voice agent"
        icon="pipeline"
        accentColor={AppColors.accentGreen}
        isDownloading={
          modelService.isLLMDownloading ||
          modelService.isSTTDownloading ||
          modelService.isTTSDownloading
        }
        isLoading={
          modelService.isLLMLoading ||
          modelService.isSTTLoading ||
          modelService.isTTSLoading
        }
        progress={
          (modelService.llmDownloadProgress +
            modelService.sttDownloadProgress +
            modelService.ttsDownloadProgress) /
          3
        }
        onLoad={modelService.downloadAndLoadAllModels}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status Area */}
        <View style={[styles.statusArea, isActive && styles.statusActive]}>
          {isActive ? (
            <>
              <AudioVisualizer level={audioLevel} />
              <Text style={[styles.statusText, { color: AppColors.accentGreen }]}>
                {status}
              </Text>
              <Text style={styles.statusSubtitle}>
                Voice agent is running
              </Text>
            </>
          ) : (
            <>
              <View style={styles.agentIconContainer}>
                <Text style={styles.agentIcon}>✨</Text>
              </View>
              <Text style={styles.statusText}>Voice Agent</Text>
              <Text style={styles.statusSubtitle}>
                Full speech-to-speech AI conversation
              </Text>
            </>
          )}
        </View>

        {/* Conversation */}
        {conversation.length > 0 && (
          <View style={styles.conversationSection}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationTitle}>Conversation</Text>
              <TouchableOpacity onPress={clearConversation}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
            {conversation.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.messageCard,
                  message.role === 'user'
                    ? styles.userMessage
                    : styles.assistantMessage,
                ]}
              >
                <View style={styles.messageHeader}>
                  <Text style={styles.roleIcon}>
                    {message.role === 'user' ? '👤' : '🤖'}
                  </Text>
                  <Text style={styles.roleText}>
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </Text>
                </View>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pipeline Info */}
        {!isActive && conversation.length === 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>1️⃣</Text>
              <Text style={styles.stepText}>The mic listens continuously and detects speech automatically</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>2️⃣</Text>
              <Text style={styles.stepText}>Speech is transcribed (STT with Whisper)</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>3️⃣</Text>
              <Text style={styles.stepText}>AI generates a response (on-device LLM)</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>4️⃣</Text>
              <Text style={styles.stepText}>Response is spoken back (TTS with Piper)</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Control Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={isActive ? stopVoiceAgent : startVoiceAgent}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              isActive
                ? [AppColors.error, '#DC2626']
                : [AppColors.accentGreen, '#059669']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.controlButton}
          >
            <Text style={styles.controlIcon}>
              {isActive ? '⏹' : '✨'}
            </Text>
            <Text style={styles.controlButtonText}>
              {isActive ? 'Stop Agent' : 'Start Voice Agent'}
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
  statusArea: {
    padding: 32,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusActive: {
    borderColor: AppColors.accentGreen + '80',
    borderWidth: 2,
    shadowColor: AppColors.accentGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  agentIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: AppColors.accentGreen + '20',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  agentIcon: {
    fontSize: 48,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  conversationSection: {
    marginBottom: 24,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  conversationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  clearButton: {
    fontSize: 14,
    color: AppColors.accentGreen,
    fontWeight: '600',
  },
  messageCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: AppColors.accentCyan + '20',
    borderColor: AppColors.accentCyan + '40',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  assistantMessage: {
    backgroundColor: AppColors.surfaceCard,
    borderColor: AppColors.textMuted + '20',
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 14,
    color: AppColors.textPrimary,
    lineHeight: 20,
  },
  infoCard: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard + '80',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 16,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 20,
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    flex: 1,
  },
  buttonContainer: {
    padding: 24,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '1A',
  },
  controlButton: {
    flexDirection: 'row',
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: AppColors.accentGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  controlIcon: {
    fontSize: 28,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
