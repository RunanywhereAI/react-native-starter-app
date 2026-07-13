import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RunAnywhere } from '@runanywhere/core';
import { LLMGenerationOptions } from '@runanywhere/proto-ts/llm_options';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ChatMessageBubble, ChatMessage, ModelLoaderWidget } from '../components';

export const ChatScreen: React.FC = () => {
  const modelService = useModelService();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const responseRef = useRef(''); // Track response for closure
  const wasCancelledRef = useRef(false);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, currentResponse]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;

    // Add user message
    const userMessage: ChatMessage = {
      text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);
    setCurrentResponse('');
    responseRef.current = '';
    wasCancelledRef.current = false;

    try {
      // Canonical cross-SDK streaming path: generateStream() returns an
      // AsyncIterable<LLMStreamEvent>; aggregateStream() drives it to
      // completion (manual iterator.next() loop under the hood — Hermes does
      // not support `for await...of` over NitroModules async iterables) and
      // reports the running transcript via onToken for live UI updates.
      const eventStream = RunAnywhere.generateStream(
        text,
        LLMGenerationOptions.fromPartial({
          maxTokens: 256,
          temperature: 0.8,
        })
      );
      const finalResult = await RunAnywhere.aggregateStream(
        text,
        eventStream,
        (transcript) => {
          responseRef.current = transcript;
          setCurrentResponse(transcript);
        }
      );

      const finalText = finalResult.text || responseRef.current;
      const assistantMessage: ChatMessage = {
        text: finalText,
        isUser: false,
        timestamp: new Date(),
        tokensPerSecond: finalResult.tokensPerSecond,
        totalTokens: finalResult.totalTokens,
        wasCancelled: wasCancelledRef.current,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setCurrentResponse('');
      responseRef.current = '';
      wasCancelledRef.current = false;
      setIsGenerating(false);
    } catch (error) {
      const errorMessage: ChatMessage = {
        text: `Error: ${error}`,
        isUser: false,
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentResponse('');
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    wasCancelledRef.current = true;
    void RunAnywhere.cancelGeneration();
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const renderSuggestionChip = (text: string) => (
    <TouchableOpacity
      key={text}
      style={styles.suggestionChip}
      onPress={() => {
        setInputText(text);
        handleSend();
      }}
    >
      <Text style={styles.suggestionText}>{text}</Text>
    </TouchableOpacity>
  );

  if (!modelService.isLLMLoaded) {
    return (
      <ModelLoaderWidget
        title="LLM Model Required"
        subtitle="Download and load the language model to start chatting"
        icon="chat"
        accentColor={AppColors.accentCyan}
        isDownloading={modelService.isLLMDownloading}
        isLoading={modelService.isLLMLoading}
        progress={modelService.llmDownloadProgress}
        onLoad={modelService.downloadAndLoadLLM}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
          </View>
          <Text style={styles.emptyTitle}>Start a Conversation</Text>
          <Text style={styles.emptySubtitle}>
            Ask anything! The AI runs entirely on your device.
          </Text>
          <View style={styles.suggestionsContainer}>
            {renderSuggestionChip('Tell me a joke')}
            {renderSuggestionChip('What is AI?')}
            {renderSuggestionChip('Write a haiku')}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={[...messages, ...(isGenerating ? [{ text: currentResponse || '...', isUser: false, timestamp: new Date() }] : [])]}
          renderItem={({ item, index }) => (
            <ChatMessageBubble
              message={item as ChatMessage}
              isStreaming={isGenerating && index === messages.length}
            />
          )}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={AppColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            editable={!isGenerating}
            multiline
          />
          {isGenerating ? (
            <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
              <View style={styles.stopIcon}>
                <Text style={styles.stopIconText}>⏹</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSend} disabled={!inputText.trim()}>
              <LinearGradient
                colors={[AppColors.accentCyan, AppColors.accentViolet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButton}
              >
                <Text style={styles.sendIcon}>📤</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  messageList: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: AppColors.accentCyan + '20',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.accentCyan + '40',
  },
  suggestionText: {
    fontSize: 12,
    color: AppColors.textPrimary,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '1A',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.primaryMid,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 15,
    color: AppColors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: AppColors.accentCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sendIcon: {
    fontSize: 20,
  },
  stopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.error + '33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIconText: {
    fontSize: 20,
    color: AppColors.error,
  },
});
