import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RunAnywhere } from '@runanywhere/core';
import type {
  ToolCallingResult,
} from '@runanywhere/proto-ts/tool_calling';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';
import { DEMO_TOOLS, registerDemoTools } from '../utils/chatSampleTools';

// ─── Helpers ──────────────────────────────────────────────────────

/** Pretty-print a JSON-encoded string (argumentsJson / resultJson); falls
 *  back to the raw string when it isn't valid JSON. */
const formatJson = (json: string | undefined): string | undefined => {
  if (!json) return json;
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

// ─── Log Entry Types ─────────────────────────────────────────────

type LogType = 'info' | 'prompt' | 'tool_call' | 'tool_result' | 'response' | 'error';

interface LogEntry {
  id: number;
  type: LogType;
  title: string;
  detail?: string;
  timestamp: Date;
}

// ─── Screen Component ────────────────────────────────────────────

export const ToolCallingScreen: React.FC = () => {
  const modelService = useModelService();
  const [inputText, setInputText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toolsRegistered, setToolsRegistered] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const logIdRef = useRef(0);

  // Auto-scroll on new logs
  useEffect(() => {
    if (logs.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [logs]);

  const addLog = (type: LogType, title: string, detail?: string) => {
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    setLogs(prev => [
      ...prev,
      { id, type, title, detail, timestamp: new Date() },
    ]);
  };

  // ─── Register tools ──────────────────────────────────────────

  const handleRegisterTools = async () => {
    try {
      await registerDemoTools();

      setToolsRegistered(true);
      addLog('info', 'Tools Registered', `Registered ${DEMO_TOOLS.length} tools: ${DEMO_TOOLS.map(t => t.name).join(', ')}`);
    } catch (error) {
      addLog('error', 'Registration Failed', String(error));
    }
  };

  // ─── Run tool calling generation ─────────────────────────────

  const handleGenerate = async () => {
    const prompt = inputText.trim();
    if (!prompt || isRunning) return;

    setInputText('');
    setIsRunning(true);
    addLog('prompt', 'User Prompt', prompt);

    try {
      const result: ToolCallingResult = await RunAnywhere.generateWithTools(prompt, {
        tools: DEMO_TOOLS,
        maxToolCalls: 3,
        autoExecute: true,
        temperature: 0.7,
        maxTokens: 512,
      });

      // Log tool calls (ToolCall.name / .argumentsJson, ToolResult.name / .resultJson
      // are the proto-canonical field names — the old toolName/arguments/result
      // shorthand fields were removed).
      if (result.toolCalls.length > 0) {
        for (let i = 0; i < result.toolCalls.length; i++) {
          const tc = result.toolCalls[i]!;
          addLog(
            'tool_call',
            `Tool Call: ${tc.name}`,
            formatJson(tc.argumentsJson),
          );
          const tr = result.toolResults[i];
          if (tr) {
            addLog(
              'tool_result',
              `Result: ${tr.name} (${tr.success ? 'success' : 'failed'})`,
              tr.success ? formatJson(tr.resultJson) : tr.error,
            );
          }
        }
      } else {
        addLog('info', 'No Tool Calls', 'The model responded without calling any tools');
      }

      // Log final response
      addLog('response', 'Model Response', result.text || '(empty)');
    } catch (error) {
      addLog('error', 'Generation Failed', String(error));
    } finally {
      setIsRunning(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  if (!modelService.isLLMLoaded) {
    return (
      <ModelLoaderWidget
        title="LLM Model Required"
        subtitle="Download and load a language model to test tool calling"
        icon="tools"
        accentColor={AppColors.accentOrange}
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
      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, toolsRegistered && styles.actionBtnActive]}
          onPress={handleRegisterTools}
        >
          <Text style={styles.actionBtnText}>
            {toolsRegistered ? 'Tools Ready' : 'Register Tools'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnClear}
          onPress={() => setLogs([])}
        >
          <Text style={styles.actionBtnClearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Tool chips */}
      <View style={styles.toolChips}>
        {DEMO_TOOLS.map(tool => (
          <View key={tool.name} style={styles.toolChip}>
            <Text style={styles.toolChipText}>{tool.name}</Text>
          </View>
        ))}
      </View>

      {/* Log output */}
      <ScrollView
        ref={scrollRef}
        style={styles.logArea}
        contentContainerStyle={styles.logContent}
      >
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛠</Text>
            <Text style={styles.emptyTitle}>Tool Calling Test</Text>
            <Text style={styles.emptySubtitle}>
              Register tools, then ask the model to use them.{'\n'}
              Try: "What's the weather in Tokyo?" or "Calculate 42 * 17"
            </Text>
          </View>
        ) : (
          logs.map(log => (
            <View key={log.id} style={[styles.logEntry, styles[`log_${log.type}`]]}>
              <View style={styles.logHeader}>
                <Text style={styles.logIcon}>{LOG_ICONS[log.type]}</Text>
                <Text style={styles.logTitle}>{log.title}</Text>
                <Text style={styles.logTime}>
                  {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>
              {log.detail ? (
                <Text style={styles.logDetail}>{log.detail}</Text>
              ) : null}
            </View>
          ))
        )}
        {isRunning && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={AppColors.accentOrange} />
            <Text style={styles.loadingText}>Generating...</Text>
          </View>
        )}
      </ScrollView>

      {/* Suggestion chips */}
      <View style={styles.suggestions}>
        {['What\'s the weather in Tokyo?', 'Calculate 123 * 456', 'What time is it right now?'].map(s => (
          <TouchableOpacity
            key={s}
            style={styles.suggestionChip}
            onPress={() => setInputText(s)}
          >
            <Text style={styles.suggestionText} numberOfLines={1}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Ask something that needs a tool..."
            placeholderTextColor={AppColors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleGenerate}
            editable={!isRunning}
            multiline
          />
          <TouchableOpacity onPress={handleGenerate} disabled={!inputText.trim() || isRunning}>
            <LinearGradient
              colors={[AppColors.accentOrange, '#E67E22']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.sendButton, (!inputText.trim() || isRunning) && styles.sendButtonDisabled]}
            >
              <Text style={styles.sendIcon}>▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Constants ─────────────────────────────────────────────────

const LOG_ICONS: Record<LogType, string> = {
  info: 'ℹ️',
  prompt: '💬',
  tool_call: '🔧',
  tool_result: '📦',
  response: '🤖',
  error: '❌',
};

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceCard,
    borderWidth: 1,
    borderColor: AppColors.accentOrange + '40',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: AppColors.accentOrange + '20',
    borderColor: AppColors.accentOrange,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.accentOrange,
  },
  actionBtnClear: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceCard,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '40',
    alignItems: 'center',
  },
  actionBtnClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMuted,
  },

  // Tool chips
  toolChips: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  toolChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: AppColors.surfaceElevated,
    borderRadius: 8,
  },
  toolChipText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: AppColors.textSecondary,
  },

  // Log area
  logArea: {
    flex: 1,
  },
  logContent: {
    padding: 12,
    paddingBottom: 8,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  // Log entries
  logEntry: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logIcon: {
    fontSize: 14,
  },
  logTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  logTime: {
    fontSize: 10,
    color: AppColors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logDetail: {
    marginTop: 6,
    fontSize: 12,
    color: AppColors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },

  // Log type-specific colors
  log_info: {
    backgroundColor: AppColors.info + '10',
    borderColor: AppColors.info + '30',
  },
  log_prompt: {
    backgroundColor: AppColors.accentCyan + '10',
    borderColor: AppColors.accentCyan + '30',
  },
  log_tool_call: {
    backgroundColor: AppColors.accentOrange + '10',
    borderColor: AppColors.accentOrange + '30',
  },
  log_tool_result: {
    backgroundColor: AppColors.accentGreen + '10',
    borderColor: AppColors.accentGreen + '30',
  },
  log_response: {
    backgroundColor: AppColors.accentViolet + '10',
    borderColor: AppColors.accentViolet + '30',
  },
  log_error: {
    backgroundColor: AppColors.error + '10',
    borderColor: AppColors.error + '30',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: AppColors.accentOrange,
  },

  // Suggestions
  suggestions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  suggestionChip: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.accentOrange + '30',
  },
  suggestionText: {
    fontSize: 10,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },

  // Input
  inputContainer: {
    padding: 12,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '1A',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.primaryMid,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
