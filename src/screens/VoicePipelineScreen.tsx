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
import { RunAnywhere } from '@runanywhere/core';
import type { AgentState, VoiceEvent, VoiceSession } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService, MODEL_IDS } from '../services/ModelService';
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

  // `RunAnywhere.voice.createSession` owns the whole pipeline: it loads the
  // STT/LLM/TTS models, ensures a VAD, opens the microphone, segments
  // utterances, runs each turn, and plays the synthesized reply. The screen
  // only renders the session's event stream.
  const sessionRef = useRef<VoiceSession | null>(null);
  const eventsRef = useRef<AsyncIterator<VoiceEvent> | null>(null);

  const cleanupVoiceSession = useCallback(async () => {
    // Detach first, then close: callers reach here from the event loop's own
    // failure path, so the iterator may already be in an errored state and
    // its return() may reject. Teardown must still reach session.close().
    const iterator = eventsRef.current;
    eventsRef.current = null;
    try {
      await iterator?.return?.(undefined);
    } catch (error) {
      console.error('[VoicePipeline] event stream close failed:', error);
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      try {
        await session.close();
      } catch (error) {
        console.error('[VoicePipeline] session.close failed:', error);
      }
    }
  }, []);

  // Tear down mic capture + the voice agent if the user navigates away while
  // a session is active.
  useEffect(() => {
    return () => {
      cleanupVoiceSession().catch(() => {});
    };
  }, [cleanupVoiceSession]);

  // Map the agent's coarse state to a human-readable status + a rough
  // audio-level value for the visualizer.
  const applyAgentState = useCallback((state: AgentState) => {
    switch (state) {
      case 'listening':
        setStatus('Listening...');
        setAudioLevel(0.3);
        break;
      case 'thinking':
        setStatus('Thinking...');
        setAudioLevel(0.5);
        break;
      case 'speaking':
        setStatus('Speaking...');
        setAudioLevel(0.8);
        break;
    }
  }, []);

  const appendMessage = useCallback(
    (role: ConversationMessage['role'], text: string) => {
      if (text.length === 0) return;
      setConversation((prev) => [...prev, { role, text, timestamp: new Date() }]);
    },
    []
  );

  // Drain the session event stream. Manual iteration — Hermes does not
  // support `for await...of` over NitroModules async iterables.
  const consumeEvents = useCallback(
    async (session: VoiceSession) => {
      const iterator = session.events[Symbol.asyncIterator]();
      eventsRef.current = iterator;
      try {
        for (;;) {
          const step = await iterator.next();
          if (step.done) break;
          const event = step.value;
          switch (event.type) {
            case 'userTranscribed':
              if (event.isFinal) appendMessage('user', event.text);
              break;
            case 'agentResponse':
              appendMessage('assistant', event.text);
              break;
            case 'agentStateChanged':
              applyAgentState(event.state);
              break;
            case 'error':
              console.error('[VoicePipeline] Voice turn error:', event.message);
              setStatus(`Error: ${event.message}`);
              setAudioLevel(0);
              break;
            default:
              break;
          }
        }
      } catch (error) {
        // The stream died mid-session. Without this the screen keeps showing a
        // live agent ("Listening...", stop button armed) over a dead pipeline.
        console.error('[VoicePipeline] Voice event stream failed:', error);
        setStatus(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        setAudioLevel(0);
        setIsActive(false);
        await cleanupVoiceSession();
      }
    },
    [appendMessage, applyAgentState, cleanupVoiceSession]
  );

  // Start voice session: the SDK composes the pipeline from the model ids and
  // owns capture -> turn -> playback for as long as the session stays open.
  const startVoiceAgent = async () => {
    if (!modelService.isVoiceAgentReady) return;

    setIsActive(true);
    setStatus('Starting...');

    try {
      const session = await RunAnywhere.voice.createSession({
        stt: { id: MODEL_IDS.stt },
        llm: { id: MODEL_IDS.llm },
        tts: { id: MODEL_IDS.tts },
      });
      sessionRef.current = session;
      consumeEvents(session).catch(() => {});
      await session.start();

      setStatus('Listening...');
      setAudioLevel(0.3);
    } catch (error) {
      console.error('[VoicePipeline] Voice agent error:', error);
      await cleanupVoiceSession();
      setIsActive(false);
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('permission')) {
        setStatus('Ready');
        Alert.alert(
          'Microphone needed',
          'Grant microphone permission to use the voice agent.'
        );
        return;
      }
      setStatus(`Error: ${message}`);
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
