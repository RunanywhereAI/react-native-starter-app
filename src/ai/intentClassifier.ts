/**
 * 🔒 PRIVACY NOTICE
 * All pattern classification runs locally on device using rule-based NLP.
 * No external API calls. No data leaves this device.
 */

import {
  NegotiationPattern,
  NegotiationMode,
  DetectedPattern,
  PatternSeverity,
} from '../types/session';
import { PATTERN_LIBRARY, PatternDefinition, getModeConfig, MODE_INTENT_MATRIX } from './patternLibrary';

/**
 * Classify text and detect negotiation patterns using Structural Intelligence Rules
 */
export const classifyIntent = (
  text: string,
  mode: NegotiationMode,
  sensitivityMultiplier: number = 1.0
): DetectedPattern[] => {
  console.log('[IntentClassifier] 🔍 classifyIntent() called');
  console.log('[IntentClassifier] 📝 Text:', text);
  console.log('[IntentClassifier] 🎯 Mode:', mode);

  const lowerText = text.toLowerCase();
  const timestamp = Date.now();
  const candidates: { patternDef: PatternDefinition; score: number }[] = [];

  // Check if text contains numbers
  const hasNumbers = /\d+/.test(lowerText) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|k|m)\b/.test(lowerText);

  // 1. Evaluate every pattern
  for (const pattern of Object.values(NegotiationPattern)) {
    const patternDef = PATTERN_LIBRARY[pattern];
    if (!patternDef) continue;

    // Structural Match Score
    let structuralScore = 0;
    for (const structPattern of patternDef.structuralPatterns) {
      const regex = new RegExp(structPattern, 'i');
      if (regex.test(lowerText)) {
        structuralScore = 1.0;
        break; // Only need one structural match
      }
    }

    // Topic Match Score
    let topicScore = 0;
    for (const tag of patternDef.topicTags) {
      const regex = new RegExp(`\\b${tag}\\b`, 'i');
      if (regex.test(lowerText)) {
        topicScore += 0.5; // Need at least 2 distinct topic words to max out, or 1 is 50%
      }
    }
    topicScore = Math.min(topicScore, 1.0);

    if (structuralScore === 0 && topicScore === 0) continue; // Skip if completely irrelevant

    // Numeric Boost Score
    let numericScore = 0;
    if (patternDef.requiresNumber) {
      if (hasNumbers) {
        numericScore = 1.0;
      } else {
        // Punish severely if required number is missing
        continue;
      }
    }

    // Negative Signal Penalty
    let negativePenalty = 0;
    for (const neg of patternDef.negativeSignals) {
      if (lowerText.includes(neg.toLowerCase())) {
        negativePenalty = 1.0;
        break;
      }
    }

    // Dynamic Base Weighting:
    // If structure matches exactly, they get full baseWeight (e.g. 0.70)
    // If only isolated topic words match, they get partial base weight (e.g. 0.49)
    let primaryMatchScore = structuralScore > 0 ? patternDef.baseWeight : (patternDef.baseWeight * 0.7);

    // Combine Base Scores
    let rawScore = primaryMatchScore 
                + (0.25 * topicScore) 
                + (0.10 * numericScore) 
                - (0.25 * negativePenalty);

    // Apply Mode Intelligence Filter Matrix
    let modeAdjustment = 0;
    const modeMatrix = MODE_INTENT_MATRIX[mode];
    if (modeMatrix) {
        if (modeMatrix.highWeight.includes(patternDef.intent)) {
            modeAdjustment += 0.15;
        } else if (modeMatrix.lowWeight.includes(patternDef.intent)) {
            modeAdjustment -= 0.15;
        }
    }

    const finalScore = (rawScore + modeAdjustment) * sensitivityMultiplier;
    
    // Convert to percentage
    const finalConfidenceScore = Math.min(Math.max(finalScore * 100, 0), 100);

    candidates.push({ patternDef, score: finalConfidenceScore });

    // Format logs for Demo display
    console.log(`[IntentClassifier] ⚡ Evaluated: ${patternDef.intent}`);
    console.log(`[IntentClassifier]    ├─ Structural Score: ${structuralScore}`);
    console.log(`[IntentClassifier]    ├─ Topic Score: ${topicScore}`);
    console.log(`[IntentClassifier]    ├─ Numeric Score: ${numericScore} (Required: ${patternDef.requiresNumber})`);
    console.log(`[IntentClassifier]    ├─ Negative Penalty: ${negativePenalty}`);
    console.log(`[IntentClassifier]    ├─ Mode Adjustment: ${modeAdjustment > 0 ? '+' : ''}${Math.round(modeAdjustment * 100)}% (${mode})`);
    console.log(`[IntentClassifier]    └─ FINAL CONFIDENCE: ${Math.round(finalConfidenceScore)}%`);
  }

  // 2. Highest Confidence Wins. Only push the Absolute Winner > 60%
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  console.log('[IntentClassifier] 🏆 Winning Tactic:', winner.patternDef.intent, 'at', Math.round(winner.score) + '%');

  if (winner.score >= 60) {
    const suggestion = pickRandomSuggestion(winner.patternDef.suggestions);

    return [{
      id: `${winner.patternDef.intent}_${timestamp}`,
      pattern: winner.patternDef.intent,
      confidenceScore: winner.score,
      suggestion,
      severity: winner.patternDef.severity,
      timestamp,
      transcript: text,
      context: text.substring(0, 50) + "...", 
    }];
  }

  return [];
};


/**
 * Pick a random suggestion from array
 */
const pickRandomSuggestion = (suggestions: string[]): string => {
  if (!suggestions || suggestions.length === 0) return "Acknowledge and pivot.";
  return suggestions[Math.floor(Math.random() * suggestions.length)];
};

/**
 * Filter patterns by severity
 */
export const filterBySeverity = (
  patterns: DetectedPattern[],
  minSeverity: PatternSeverity
): DetectedPattern[] => {
  const severityOrder: Record<PatternSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  const minLevel = severityOrder[minSeverity];

  return patterns.filter((p) => severityOrder[p.severity] >= minLevel);
};

/**
 * Get most common pattern from array
 */
export const getMostCommonPattern = (patterns: DetectedPattern[]): NegotiationPattern | null => {
  if (patterns.length === 0) return null;

  const counts: Record<string, number> = {};

  patterns.forEach((p) => {
    counts[p.pattern] = (counts[p.pattern] || 0) + 1;
  });

  let maxCount = 0;
  let mostCommon: NegotiationPattern | null = null;

  Object.entries(counts).forEach(([pattern, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = pattern as NegotiationPattern;
    }
  });

  return mostCommon;
};

// Legacy stubs missing from PatternLibrary refactor requirement
export const containsPattern = () => false;
export const getSuggestionForPattern = () => ""; 
export const analyzeTranscriptWindow = (
  chunks: Array<{ text: string; timestamp: number }>,
  mode: NegotiationMode,
  sensitivityMultiplier: number = 1.0,
  windowSize: number = 2 // Update to Last 2 chunks as requested
): DetectedPattern[] => {
  // Take last 2 chunks
  const recentChunks = chunks.slice(-windowSize);
  const combinedText = recentChunks.map((c) => c.text).join(' ');

  return classifyIntent(combinedText, mode, sensitivityMultiplier);
};
