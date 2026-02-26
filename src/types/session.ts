/**
 * 🔒 PRIVACY NOTICE
 * All data structures defined here are stored locally on device.
 * No data leaves this device.
 */

/**
 * Negotiation modes with different pattern detection weights
 */
export enum NegotiationMode {
  JOB_INTERVIEW = 'job_interview',
  SALES = 'sales',
  STARTUP_PITCH = 'startup_pitch',
  SALARY_RAISE = 'salary_raise',
}

/**
 * Negotiation patterns that can be detected
 */
export enum NegotiationPattern {
  ANCHORING = 'anchoring',
  BUDGET_OBJECTION = 'budget_objection',
  AUTHORITY_PRESSURE = 'authority_pressure',
  TIME_PRESSURE = 'time_pressure',
  DEFLECTION = 'deflection',
  POSITIVE_SIGNAL = 'positive_signal',
  NEGATIVE_SIGNAL = 'negative_signal',
  COMMITMENT_LANGUAGE = 'commitment_language',
}

/**
 * Severity levels for detected patterns
 */
export type PatternSeverity = 'low' | 'medium' | 'high';

/**
 * Detected pattern with metadata
 */
export interface DetectedPattern {
  id: string;
  pattern: NegotiationPattern;
  confidenceScore: number; // 0-100
  suggestion: string;
  severity: PatternSeverity;
  timestamp: number;
  transcript: string;
  context?: string;
}

/**
 * Cognitive metrics tracked during session
 */
export interface CognitiveMetrics {
  focusScore: number; // 0-100
  speechGaps: number; // Count of pauses > 2 seconds
  fillerWords: number; // Count of um, uh, like, etc.
  avgSpeechRate: number; // Words per minute
  totalWords: number;
  speechDuration: number; // Milliseconds of actual speech (excluding gaps)
}

/**
 * Session summary generated after session ends
 */
export interface SessionSummary {
  leverageMoments: string[]; // Key moments where user had advantage
  missedOpportunities: string[]; // Moments where better response was possible
  objectionCount: number;
  positiveSignalCount: number;
  tacticalSuggestions: string[]; // Suggestions for next meeting
  keyInsights: string[];
}

/**
 * Transcript chunk with timestamp
 */
export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
  speaker?: 'user' | 'other'; // Future enhancement for multi-speaker
  hasPattern?: boolean; // True if this chunk has detected patterns
}

/**
 * Live session state (in-memory during recording)
 */
export interface LiveSessionState {
  isRecording: boolean;
  startTime: number;
  duration: number;
  transcript: TranscriptChunk[];
  detectedPatterns: DetectedPattern[];
  currentFocusScore: number;
  audioLevel: number;
  lastAutoSave: number;
}

/**
 * Persisted session data (saved to AsyncStorage)
 */
export interface Session {
  id: string;
  timestamp: number; // Session start time
  duration: number; // Total duration in milliseconds
  mode: NegotiationMode;
  transcript: TranscriptChunk[];
  detectedPatterns: DetectedPattern[];
  cognitiveMetrics: CognitiveMetrics;
  summary: SessionSummary;
  title?: string; // Optional user-provided title
  notes?: string; // Optional user notes
}

/**
 * Quick stats for home screen dashboard
 */
export interface SessionStats {
  totalSessions: number;
  avgFocusScore: number;
  avgDuration: number;
  mostCommonPattern: NegotiationPattern | null;
  totalPatterns: number;
  lastSessionDate: number | null;
}

/**
 * App settings stored in AsyncStorage
 */
export interface AppSettings {
  defaultMode: NegotiationMode;
  patternSensitivity: number; // 0.5 - 1.5 multiplier for confidence thresholds
  enableAutoSave: boolean;
  autoSaveInterval: number; // Milliseconds (default 45000)
  enableHapticFeedback: boolean;
  enableSuggestionNotifications: boolean;
  debugMode?: boolean; // Enable debug mode with hardcoded transcripts
}

/**
 * Pattern detection configuration per mode
 */
export interface ModeConfig {
  mode: NegotiationMode;
  displayName: string;
  description: string;
  icon: string;
  patternWeights: {
    [key in NegotiationPattern]: number; // Multiplier for confidence score
  };
}

/**
 * Audio buffer chunk for processing
 */
export interface AudioChunk {
  data: number[];
  timestamp: number;
  duration: number;
}

/**
 * Analysis result from NegotiationAnalyzer
 */
export interface AnalysisResult {
  detectedPatterns: DetectedPattern[];
  cognitiveMetrics: Partial<CognitiveMetrics>;
  suggestions: string[];
  focusScore: number;
}

/**
 * Counter strategy result from the CounterStrategyEngine
 */
export interface CounterStrategy {
  tactic: NegotiationPattern;
  tacticDisplayName: string;
  confidence: number; // 0-100
  suggestions: string[];
  explanation: string;
  timestamp: number;
}
