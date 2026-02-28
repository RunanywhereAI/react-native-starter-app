/**
 * 🔒 PRIVACY NOTICE
 * SessionEngine orchestrates all local processing.
 * All data stays on device. Auto-saves every 45 seconds.
 * No external API calls. No cloud sync.
 */

import {
  Session,
  LiveSessionState,
  TranscriptChunk,
  DetectedPattern,
  NegotiationMode,
  CognitiveMetrics,
  SessionSummary,
} from '../types/session';
import { SpeechService } from './SpeechService';
import { NegotiationAnalyzer } from './NegotiationAnalyzer';
import { LocalStorageService } from './LocalStorageService';
import { calculateCognitiveMetrics } from '../ai/scoringEngine';
import { autoCorrectTranscript } from '../ai/WhisperAutoCorrector';

export interface SessionUpdateCallback {
  (state: LiveSessionState): void;
}

const DEBUG_TRANSCRIPTS: Record<NegotiationMode, string[]> = {
  [NegotiationMode.JOB_INTERVIEW]: [
    'We usually offer around 6 LPA for this position.',
    'I need to check with my manager before making any decision.',
    'Your profile looks interesting, but we have strict budget constraints.',
    'Let me think about it and get back to you next week.',
    "This looks great! I'm really excited about moving forward.",
    'Are you willing to relocate for this role?',
    'I have authority to approve up to 8 LPA maximum.',
  ],
  [NegotiationMode.SALES]: [
    'Your product looks interesting, but the price is too high.',
    'We already use a competitor for this service.',
    'I need to get approval from the procurement department.',
    'What kind of discount can you offer us?',
    'We have budget constraints this quarter.',
    'Can we start with a pilot program first?',
  ],
  [NegotiationMode.STARTUP_PITCH]: [
    'What is your customer acquisition cost?',
    'We usually invest in later stage companies.',
    'Your valuation expectations seem a bit high.',
    'How do you plan to scale this next year?',
    'I need to check with my partners before committing.',
    'This looks great! I am really excited about moving forward.',
  ],
  [NegotiationMode.SALARY_RAISE]: [
    'Company performance has been slow this quarter.',
    'We usually only do appraisals at the end of the year.',
    'I agree you have done good work, but 30% is too much.',
    'Let me review the budget with HR and get back to you.',
    'Can we look at performance bonuses instead of a base hike?',
    'You are a valuable asset to the team.',
  ],
  [NegotiationMode.INVESTOR_MEETING]: [
    'Your burn rate is concerning for this stage.',
    'What is the exact runway you have left?',
    'We need to see more traction before releasing the next tranche.',
    'Who else is participating in this funding round?',
    'Your Go-to-market strategy seems expensive.',
  ],
  [NegotiationMode.CLIENT_NEGOTIATION]: [
    'The timeline for these deliverables is too tight.',
    'Can we reduce the retainer fee for the first three months?',
    'We need unlimited revisions included in this contract.',
    'We are waiting on our legal team to review the MSA.',
    'This scope is larger than what we initially discussed.',
  ],
  [NegotiationMode.CUSTOM_SCENARIO]: [
    'I need to check with my manager before making any decision.',
    'Let me think about it and get back to you next week.',
    "This looks great! I'm really excited about moving forward.",
    'We have budget constraints this quarter.',
    'Can you send me more information via email?',
  ],
};

/**
 * SessionEngine - Orchestrates the entire session lifecycle
 * Manages recording, transcription, analysis, and auto-save
 */
export class SessionEngine {
  private sessionId: string | null = null;
  private mode: NegotiationMode = NegotiationMode.SALES;
  private speechService: SpeechService;
  private analyzer: NegotiationAnalyzer;
  private state: LiveSessionState;
  private updateCallback: SessionUpdateCallback | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private analysisDebounceTrigger: NodeJS.Timeout | null = null;
  private autoSaveIntervalMs: number = 45000; // 45 seconds as requested
  private debugTranscriptIndex: number = 0;
  private debugInterval: NodeJS.Timeout | null = null;
  private debugMode: boolean = false;

  constructor() {
    this.speechService = new SpeechService();
    this.analyzer = new NegotiationAnalyzer();
    this.state = this.createInitialState();
  }

  /**
   * Create initial session state
   */
  private createInitialState(): LiveSessionState {
    return {
      isRecording: false,
      startTime: 0,
      duration: 0,
      transcript: [],
      detectedPatterns: [],
      currentFocusScore: 100,
      audioLevel: 0,
      lastAutoSave: 0,
    };
  }

  /**
   * Start a new session
   */
  async startSession(mode: NegotiationMode, onUpdate: SessionUpdateCallback): Promise<boolean> {
    try {
      // Generate session ID
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.mode = mode;
      this.updateCallback = onUpdate;

      // Reset state
      this.state = this.createInitialState();
      this.state.startTime = Date.now();
      this.state.isRecording = true;

      // Configure analyzer
      const settings = await LocalStorageService.getSettings();
      this.analyzer.setMode(mode);
      this.analyzer.setSensitivity(settings.patternSensitivity);

      this.debugMode = settings.debugMode || false;

      if (this.debugMode) {
        console.log('[SessionEngine] 🐛 DEBUG MODE ENABLED - Using hardcoded transcripts');
        console.log('[SessionEngine] 🐛 This bypasses STT and injects test data every 7 seconds');

        // Start debug transcript injection
        this.startDebugTranscripts();
      } else {
        // Start speech service
        const started = await this.speechService.startRecording(
          this.onTranscription.bind(this),
          this.onAudioLevel.bind(this)
        );

        if (!started) {
          console.error('[SessionEngine] Failed to start speech service');
          return false;
        }
      }

      // Removed: analyzer.startContinuousAnalysis
      // Now running debounced in onTranscription

      // Start auto-save (every 45 seconds)
      this.startAutoSave();

      console.log('[SessionEngine] Session started:', this.sessionId);
      this.notifyUpdate();

      return true;
    } catch (error) {
      console.error('[SessionEngine] Error starting session:', error);
      return false;
    }
  }

  /**
   * Stop the current session and save
   */
  async stopSession(): Promise<Session | null> {
    try {
      if (!this.sessionId) {
        return null;
      }

      console.log('[SessionEngine] Stopping session:', this.sessionId);

      // Stop services
      if (this.analysisDebounceTrigger) clearTimeout(this.analysisDebounceTrigger);
      this.stopAutoSave();
      this.stopDebugTranscripts();

      if (!this.debugMode) {
        await this.speechService.stopRecording();
      }

      this.state.isRecording = false;
      this.state.duration = Date.now() - this.state.startTime;

      // Calculate final cognitive metrics
      const cognitiveMetrics = calculateCognitiveMetrics(
        this.state.transcript.map((c) => ({ text: c.text, timestamp: c.timestamp })),
        this.state.duration
      );

      // Generate summary
      const summaryData = this.analyzer.generateSummary(
        this.state.detectedPatterns,
        this.state.transcript
      );

      const summary: SessionSummary = {
        leverageMoments: summaryData.leverageMoments,
        missedOpportunities: summaryData.missedOpportunities,
        objectionCount: summaryData.objectionCount,
        positiveSignalCount: summaryData.positiveSignalCount,
        tacticalSuggestions: summaryData.tacticalSuggestions,
        keyInsights: summaryData.keyInsights,
      };

      // Create final session object
      const session: Session = {
        id: this.sessionId,
        timestamp: this.state.startTime,
        duration: this.state.duration,
        mode: this.mode,
        transcript: this.state.transcript,
        detectedPatterns: this.state.detectedPatterns,
        cognitiveMetrics,
        summary,
      };

      // Save to storage
      await LocalStorageService.saveSession(session);

      // Recalculate stats
      await LocalStorageService.calculateStats();

      console.log('[SessionEngine] Session saved:', session.id);

      // Clean up
      this.sessionId = null;
      this.updateCallback = null;

      return session;
    } catch (error) {
      console.error('[SessionEngine] Error stopping session:', error);
      return null;
    }
  }

  /**
   * Cancel the current session without saving
   */
  async cancelSession(): Promise<void> {
    console.log('[SessionEngine] Canceling session');

    if (this.analysisDebounceTrigger) clearTimeout(this.analysisDebounceTrigger);
    this.stopAutoSave();
    this.stopDebugTranscripts();

    if (!this.debugMode) {
      await this.speechService.cancelRecording();
    }

    this.state = this.createInitialState();
    this.sessionId = null;
    this.updateCallback = null;
  }

  private onTranscription(text: string, timestamp: number): void {
    const rawText = text.trim();
    if (!rawText) return;

    // Remove blank tokens just in case
    let cleanedText = rawText.replace(/\[BLANK_AUDIO\]/g, '').replace(/\[ Pause \]/gi, '').trim();
    if (!cleanedText) return;

    // 💡 Auto-correct Whisper 'tiny' hallucinations based on context vocabulary
    cleanedText = autoCorrectTranscript(cleanedText, this.mode);

    const transcriptLen = this.state.transcript.length;
    let isNewSentence = true;

    if (transcriptLen > 0) {
      const lastChunk = this.state.transcript[transcriptLen - 1];
      // Only break to a new bubble if the previous chunk ended with punctuation or it's a long pause
      const isFinished = /[.!?]\s*$/.test(lastChunk.text);
      const timeSinceLastUpdate = timestamp - lastChunk.timestamp;
      const isLongPause = timeSinceLastUpdate > 10000;

      if (!isFinished && !isLongPause) {
        // BREAK REACT'S REFERENCE EQUALITY: Create a completely new object
        // so FlatList detects that this item changed and actually re-renders!
        this.state.transcript[transcriptLen - 1] = {
          ...lastChunk,
          text: `${lastChunk.text} ${cleanedText}`.trim(),
          timestamp: timestamp,
        };
        isNewSentence = false;
      }
    }

    if (isNewSentence) {
      const chunk: TranscriptChunk = {
        id: `chunk_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        text: cleanedText,
        timestamp,
      };
      this.state.transcript.push(chunk);
    }
    this.state.duration = Date.now() - this.state.startTime;
    this.triggerDebouncedAnalysis();
  }

  private triggerDebouncedAnalysis() {
    this.notifyUpdate();
    
    // Trigger debounced analysis inline
    if (this.analysisDebounceTrigger) {
      clearTimeout(this.analysisDebounceTrigger);
    }
    
    this.analysisDebounceTrigger = setTimeout(() => {
      if (this.state.isRecording || this.debugMode) {
        this.analyzer.analyzeSession(this.state.transcript, this.state.duration)
          .then((result) => this.onAnalysisResult(result))
          .catch((err) => console.error('[SessionEngine] Analysis error:', err));
      }
    }, 300);
  }

  /**
   * Handle audio level updates
   */
  private onAudioLevel(level: number): void {
    this.state.audioLevel = level;
    this.notifyUpdate();
  }

  /**
   * Handle analysis results
   */
  private onAnalysisResult(result: any): void {
    console.log('[SessionEngine] 🧠 onAnalysisResult() called');
    console.log('[SessionEngine] 🎯 Detected patterns count:', result.detectedPatterns.length);
    console.log('[SessionEngine] 📊 Focus score:', result.focusScore);

    // Add new patterns (avoid duplicates)
    const existingPatternIds = new Set(this.state.detectedPatterns.map((p) => p.id));
    let newPatternsCount = 0;

    result.detectedPatterns.forEach((pattern: DetectedPattern) => {
      if (!existingPatternIds.has(pattern.id)) {
        this.state.detectedPatterns.push(pattern);
        newPatternsCount++;

        console.log('[SessionEngine] 🆕 New pattern detected:', {
          pattern: pattern.pattern,
          confidence: pattern.confidenceScore,
          suggestion: pattern.suggestion,
        });

        // Mark related transcript chunks
        this.state.transcript.forEach((chunk) => {
          if (chunk.text === pattern.transcript) {
            chunk.hasPattern = true;
          }
        });
      }
    });

    // Sort patterns by confidence (highest first) so counter-strategy picks the best one
    this.state.detectedPatterns.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Update focus score
    this.state.currentFocusScore = result.focusScore;

    console.log('[SessionEngine] ✅ Analysis complete');
    console.log('[SessionEngine] 🆕 New patterns added:', newPatternsCount);
    console.log('[SessionEngine] 📊 Total patterns:', this.state.detectedPatterns.length);

    if (newPatternsCount > 0) {
      // Force new array references so React detects the change
      this.state.detectedPatterns = [...this.state.detectedPatterns];
    }

    this.notifyUpdate();
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.autoSaveIntervalMs);

    console.log('[SessionEngine] Auto-save started (every 45s)');
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      console.log('[SessionEngine] Auto-save stopped');
    }
  }

  /**
   * Perform auto-save (saves current state)
   */
  private async performAutoSave(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      // Calculate current cognitive metrics
      const cognitiveMetrics = calculateCognitiveMetrics(
        this.state.transcript.map((c) => ({ text: c.text, timestamp: c.timestamp })),
        this.state.duration
      );

      // Create partial session for auto-save
      const partialSession: Session = {
        id: this.sessionId,
        timestamp: this.state.startTime,
        duration: Date.now() - this.state.startTime,
        mode: this.mode,
        transcript: this.state.transcript,
        detectedPatterns: this.state.detectedPatterns,
        cognitiveMetrics,
        summary: {
          leverageMoments: [],
          missedOpportunities: [],
          objectionCount: 0,
          positiveSignalCount: 0,
          tacticalSuggestions: [],
          keyInsights: [],
        },
      };

      await LocalStorageService.saveSession(partialSession);
      this.state.lastAutoSave = Date.now();

      console.log('[SessionEngine] Auto-save completed');
    } catch (error) {
      console.error('[SessionEngine] Auto-save error:', error);
    }
  }

  /**
   * Get current session state
   */
  getState(): LiveSessionState {
    return { ...this.state };
  }

  /**
   * Notify update callback
   */
  private notifyUpdate(): void {
    if (this.updateCallback) {
      console.log('[SessionEngine] 🔔 Notifying state update to UI');
      // Create new array references so React's useState detects the change
      this.updateCallback({
        ...this.state,
        transcript: [...this.state.transcript],
        detectedPatterns: [...this.state.detectedPatterns],
      });
    } else {
      console.log('[SessionEngine] ⚠️ No update callback registered');
    }
  }

  /**
   * Update duration (call from UI timer)
   */
  updateDuration(): void {
    if (this.state.isRecording) {
      this.state.duration = Date.now() - this.state.startTime;
      this.notifyUpdate();
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.analysisDebounceTrigger) clearTimeout(this.analysisDebounceTrigger);
    this.analyzer.cleanup();
    this.speechService.cleanup();
    this.stopAutoSave();
    this.stopDebugTranscripts();
  }

  /**
   * Start debug transcript injection (bypasses STT)
   */
  private startDebugTranscripts(): void {
    console.log('[SessionEngine] 🐛 Starting debug transcript injection');
    this.debugTranscriptIndex = 0;

    // Inject first transcript immediately
    this.injectDebugTranscript();

    // Inject new transcript every 7 seconds
    this.debugInterval = setInterval(() => {
      this.injectDebugTranscript();
    }, 7000);
  }

  /**
   * Stop debug transcript injection
   */
  private stopDebugTranscripts(): void {
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
      this.debugInterval = null;
      console.log('[SessionEngine] 🐛 Debug transcript injection stopped');
    }
  }

  /**
   * Inject a single debug transcript
   */
  private injectDebugTranscript(): void {
    const activeTranscripts = DEBUG_TRANSCRIPTS[this.mode] || DEBUG_TRANSCRIPTS[NegotiationMode.CUSTOM_SCENARIO];

    if (this.debugTranscriptIndex >= activeTranscripts.length) {
      console.log('[SessionEngine] 🐛 All debug transcripts injected, cycling back to start');
      this.debugTranscriptIndex = 0;
    }

    const text = activeTranscripts[this.debugTranscriptIndex];
    console.log(`[SessionEngine] 🐛 Injecting debug transcript (${this.mode}):`, text);

    this.onTranscription(text, Date.now());
    this.debugTranscriptIndex++;
  }
}
