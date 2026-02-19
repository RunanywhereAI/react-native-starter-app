import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { RunAnywhere, VoiceSessionEvent, VoiceSessionHandle } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget, AudioVisualizer } from '../components';

// Conditionally import Sound - disabled on iOS via react-native.config.js
let Sound: any = null;
if (Platform.OS === 'android') {
  try {
    Sound = require('react-native-sound').default;
  } catch (e) {
    console.log('react-native-sound not available');
  }
}

// iOS uses NativeAudioModule
const { NativeAudioModule } = NativeModules;

interface ConversationMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// Model IDs - must match those registered in ModelService
const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0',
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
};

export const VoicePipelineScreen: React.FC = () => {
  const modelService = useModelService();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs for session and audio
  const sessionRef = useRef<VoiceSessionHandle | null>(null);
  const currentSoundRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Handle voice session events per docs:
  // https://docs.runanywhere.ai/react-native/voice-agent#voicesessionevent
  const handleVoiceEvent = useCallback((event: VoiceSessionEvent) => {
    switch (event.type) {
      case 'sessionStarted':
        setStatus('Listening...');
        setAudioLevel(0.2);
        break;
        
      case 'listeningStarted':
        setStatus('Listening...');
        setAudioLevel(0.3);
        break;
        
      case 'speechDetected':
        setStatus('Hearing you...');
        setAudioLevel(0.7);
        break;
        
      case 'speechEnded':
        setAudioLevel(0.1);
        break;
        
      case 'transcribing':
        setStatus('Processing speech...');
        setAudioLevel(0.4);
        break;
        
      case 'transcriptionComplete':
        if (event.data?.transcript) {
          const userMessage: ConversationMessage = {
            role: 'user',
            text: event.data.transcript,
            timestamp: new Date(),
          };
          setConversation(prev => [...prev, userMessage]);
        }
        setStatus('Thinking...');
        setAudioLevel(0.5);
        break;
        
      case 'generating':
        setStatus('Generating response...');
        setAudioLevel(0.5);
        break;
        
      case 'generationComplete':
        if (event.data?.response) {
          const assistantMessage: ConversationMessage = {
            role: 'assistant',
            text: event.data.response,
            timestamp: new Date(),
          };
          setConversation(prev => [...prev, assistantMessage]);
        }
        setStatus('Synthesizing...');
        setAudioLevel(0.6);
        break;
        
      case 'synthesizing':
        setStatus('Preparing voice...');
        break;
        
      case 'synthesisComplete':
        setStatus('Speaking...');
        // Play audio if provided
        if (event.data?.audio) {
          playResponseAudio(event.data.audio);
        }
        break;
        
      case 'speaking':
        setStatus('Speaking...');
        setAudioLevel(0.8);
        break;
        
      case 'turnComplete':
        setStatus('Listening...');
        setAudioLevel(0.3);
        break;
        
      case 'error':
        setStatus(`Error: ${event.data?.error || 'Unknown error'}`);
        setAudioLevel(0);
        console.error('Voice session error:', event.data?.error);
        break;
    }
  }, []);

  // Play synthesized audio response - platform-specific
  const playResponseAudio = async (base64Audio: string) => {
    try {
      if (Platform.OS === 'ios' && NativeAudioModule) {
        // iOS: Use NativeAudioModule
        isPlayingRef.current = true;
        setAudioLevel(0.8);
        await NativeAudioModule.playAudioBase64(base64Audio, 22050);
        isPlayingRef.current = false;
        setAudioLevel(0.3);
      } else if (Platform.OS === 'android' && Sound) {
        // Android: Use react-native-sound
        const wavData = createWavFromBase64Float32(base64Audio, 22050);
        const tempPath = `${RNFS.TemporaryDirectoryPath}/voice_response_${Date.now()}.wav`;
        await RNFS.writeFile(tempPath, wavData, 'base64');

        const sound = new Sound(tempPath, '', (error: any) => {
          if (error) {
            console.error('Failed to load sound:', error);
            return;
          }
          
          currentSoundRef.current = sound;
          setAudioLevel(0.8);
          
          sound.play((success: boolean) => {
            sound.release();
            currentSoundRef.current = null;
            setAudioLevel(0.3);
          });
        });
      } else {
        console.warn('No audio playback module available');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      isPlayingRef.current = false;
      setAudioLevel(0.3);
    }
  };

  // Convert base64 float32 PCM to WAV format
  const createWavFromBase64Float32 = (base64Audio: string, sampleRate: number): string => {
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const float32Samples = new Float32Array(bytes.buffer);
    const numSamples = float32Samples.length;

    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < float32Samples.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    const uint8Array = new Uint8Array(wavBuffer);
    let result = '';
    for (let i = 0; i < uint8Array.length; i++) {
      result += String.fromCharCode(uint8Array[i]);
    }
    return btoa(result);
  };

  // Start voice session per docs:
  // https://docs.runanywhere.ai/react-native/voice-agent#startvoicesession
  const startVoiceAgent = async () => {
    setIsActive(true);
    setStatus('Starting...');

    try {
      // Per docs: Use startVoiceSession with VoiceSessionConfig and callback
      sessionRef.current = await RunAnywhere.startVoiceSession(
        {
          agentConfig: {
            llmModelId: MODEL_IDS.llm,
            sttModelId: MODEL_IDS.stt,
            ttsModelId: MODEL_IDS.tts,
            systemPrompt: 'You are a helpful, friendly voice assistant. Keep your responses brief and conversational.',
            generationOptions: {
              maxTokens: 150,
              temperature: 0.7,
            },
          },
          enableVAD: true,
          vadSensitivity: 0.5,
          speechTimeout: 3000, // 3 seconds timeout for speech
        },
        handleVoiceEvent
      );
    } catch (error) {
      console.error('Voice agent error:', error);
      setStatus(`Error: ${error}`);
      setIsActive(false);
    }
  };

  const stopVoiceAgent = async () => {
    try {
      // Stop any playing audio - platform-specific
      if (Platform.OS === 'ios' && isPlayingRef.current && NativeAudioModule) {
        await NativeAudioModule.stopPlayback();
        isPlayingRef.current = false;
      } else if (currentSoundRef.current) {
        currentSoundRef.current.stop(() => {
          currentSoundRef.current?.release();
          currentSoundRef.current = null;
        });
      }
      
      // Stop the voice session
      if (sessionRef.current) {
        await sessionRef.current.stop();
        sessionRef.current = null;
      }
      
      setIsActive(false);
      setStatus('Ready');
      setAudioLevel(0);
    } catch (error) {
      console.error('Stop voice agent error:', error);
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
              <Text style={styles.stepText}>Voice Activity Detection (VAD) listens for speech</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>2️⃣</Text>
              <Text style={styles.stepText}>Speech is transcribed (STT with Whisper)</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>3️⃣</Text>
              <Text style={styles.stepText}>AI generates response (LLM with SmolLM2)</Text>
            </View>
            <View style={styles.infoStep}>
              <Text style={styles.stepNumber}>4️⃣</Text>
              <Text style={styles.stepText}>Response is spoken (TTS with Piper)</Text>
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
