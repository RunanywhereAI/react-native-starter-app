/**
 * 🔒 PRIVACY NOTICE
 * All pattern analysis runs locally on device.
 * No external API calls. No data leaves this device.
 */

import { InteractionManager } from 'react-native';
import {
  NegotiationMode,
  NegotiationPattern,
  DetectedPattern,
  TranscriptChunk,
  AnalysisResult,
} from '../types/session';
import { classifyIntent, analyzeTranscriptWindow } from '../ai/intentClassifier';
import { calculateCognitiveMetrics, calculateFocusScore } from '../ai/scoringEngine';
import { getPatternDefinition } from '../ai/patternLibrary';

/**
 * NegotiationAnalyzer - Analyzes transcript for negotiation patterns
 * Runs analysis in background to avoid blocking UI
 */
export class NegotiationAnalyzer {
  private mode: NegotiationMode;
  private sensitivityMultiplier: number;
  private analysisInterval: NodeJS.Timeout | null = null;
  private isAnalyzing: boolean = false;

  constructor(mode: NegotiationMode = NegotiationMode.SALES, sensitivityMultiplier: number = 1.0) {
    this.mode = mode;
    this.sensitivityMultiplier = sensitivityMultiplier;
  }

  /**
   * Analyze a single transcript chunk
   */
  analyzeChunk(text: string): DetectedPattern[] {
    return classifyIntent(text, this.mode, this.sensitivityMultiplier);
  }

  /**
   * Analyze multiple transcript chunks (window-based analysis)
   */
  analyzeWindow(chunks: TranscriptChunk[], windowSize: number = 1): DetectedPattern[] {
    const recentChunks = chunks.slice(-windowSize).map((c) => ({
      text: c.text,
      timestamp: c.timestamp,
    }));

    return analyzeTranscriptWindow(recentChunks, this.mode, this.sensitivityMultiplier, windowSize);
  }

  /**
   * Perform comprehensive analysis
   * Returns patterns, cognitive metrics, and suggestions
   */
  async analyzeSession(
    chunks: TranscriptChunk[],
    sessionDuration: number
  ): Promise<AnalysisResult> {
    // Run analysis in background to avoid blocking UI
    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        try {
          // Analyze patterns from the most recent chunk to optimize speed and maintain high keyword density
          const detectedPatterns = this.analyzeWindow(chunks, 1);

          // Calculate cognitive metrics
          const cognitiveMetrics = calculateCognitiveMetrics(
            chunks.map((c) => ({ text: c.text, timestamp: c.timestamp })),
            sessionDuration
          );

          // Calculate focus score
          const focusScore = calculateFocusScore(cognitiveMetrics, sessionDuration);

          // Generate suggestions based on patterns
          const suggestions = this.generateSuggestions(detectedPatterns);

          resolve({
            detectedPatterns,
            cognitiveMetrics,
            suggestions,
            focusScore,
          });
        } catch (error) {
          console.error('[NegotiationAnalyzer] Analysis error:', error);
          resolve({
            detectedPatterns: [],
            cognitiveMetrics: {},
            suggestions: [],
            focusScore: 100,
          });
        }
      });
    });
  }

  /**
   * (Removed `startContinuousAnalysis` to migrate to debounced execution inline)
   */

  /**
   * (Removed `stopContinuousAnalysis` to migrate to debounced execution inline)
   */

  /**
   * Generate tactical suggestions based on detected patterns
   */
  private generateSuggestions(patterns: DetectedPattern[]): string[] {
    const suggestions: string[] = [];
    const seenSuggestions = new Set<string>();

    // Get top 3 highest confidence patterns
    const topPatterns = patterns.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 3);

    for (const pattern of topPatterns) {
      if (!seenSuggestions.has(pattern.suggestion)) {
        suggestions.push(pattern.suggestion);
        seenSuggestions.add(pattern.suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Generate session summary
   */
  generateSummary(
    allPatterns: DetectedPattern[],
    chunks: TranscriptChunk[]
  ): {
    leverageMoments: string[];
    missedOpportunities: string[];
    objectionCount: number;
    positiveSignalCount: number;
    tacticalSuggestions: string[];
    keyInsights: string[];
  } {
    // Leverage moments (positive signals and commitments)
    const leverageMoments: string[] = [];
    allPatterns
      .filter(
        (p) =>
          p.pattern === NegotiationPattern.POSITIVE_SIGNAL ||
          p.pattern === NegotiationPattern.COMMITMENT_LANGUAGE
      )
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5)
      .forEach((p) => {
        leverageMoments.push(
          `${this.formatTimestamp(p.timestamp)}: ${p.context || p.transcript.substring(0, 50)}`
        );
      });

    // Missed opportunities (deflections and negative signals without follow-up)
    const missedOpportunities: string[] = [];
    const deflections = allPatterns.filter(
      (p) =>
        p.pattern === NegotiationPattern.DEFLECTION ||
        p.pattern === NegotiationPattern.NEGATIVE_SIGNAL
    );
    deflections.slice(0, 3).forEach((p) => {
      const patternDef = getPatternDefinition(p.pattern);
      missedOpportunities.push(
        `${this.formatTimestamp(p.timestamp)}: ${patternDef.displayName} - Consider: ${p.suggestion}`
      );
    });

    // Count objections (budget + authority)
    const objectionCount = allPatterns.filter(
      (p) =>
        p.pattern === NegotiationPattern.BUDGET_OBJECTION ||
        p.pattern === NegotiationPattern.AUTHORITY_PRESSURE
    ).length;

    // Count positive signals
    const positiveSignalCount = allPatterns.filter(
      (p) => p.pattern === NegotiationPattern.POSITIVE_SIGNAL
    ).length;

    // Tactical suggestions (most common patterns)
    const tacticalSuggestions: string[] = [];
    const patternCounts: Record<string, number> = {};

    allPatterns.forEach((p) => {
      patternCounts[p.pattern] = (patternCounts[p.pattern] || 0) + 1;
    });

    const sortedPatterns = Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    sortedPatterns.forEach(([pattern]) => {
      const patternDef = getPatternDefinition(pattern as NegotiationPattern);
      tacticalSuggestions.push(
        `Prepare for ${patternDef.displayName}: ${patternDef.suggestions[0]}`
      );
    });

    // Key insights
    const keyInsights: string[] = [];
    const totalPatterns = allPatterns.length;

    if (positiveSignalCount > objectionCount) {
      keyInsights.push('Strong positive momentum - capitalize on enthusiasm');
    }
    if (objectionCount > 5) {
      keyInsights.push('High objection frequency - focus on value proposition');
    }
    if (deflections.length > 3) {
      keyInsights.push('Multiple deferrals detected - establish concrete next steps');
    }
    if (totalPatterns < 5) {
      keyInsights.push('Low pattern detection - conversation may need more depth');
    }

    return {
      leverageMoments,
      missedOpportunities,
      objectionCount,
      positiveSignalCount,
      tacticalSuggestions,
      keyInsights,
    };
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Update mode
   */
  setMode(mode: NegotiationMode): void {
    this.mode = mode;
  }

  /**
   * Update sensitivity
   */
  setSensitivity(multiplier: number): void {
    this.sensitivityMultiplier = multiplier;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    // no continuous analysis to stop
  }
}
