/**
 * 🔒 PRIVACY NOTICE
 * All scoring calculations run locally on device.
 * No data leaves this device.
 */

import { CognitiveMetrics } from '../types/session';
import { FILLER_WORD_PATTERN } from './patternLibrary';

/**
 * Calculate confidence score based on multiple factors
 */
export const calculateConfidenceScore = (
  baseConfidence: number,
  factors: {
    keywordMatches: number;
    contextMatches: number;
    patternWeight: number;
    sensitivityMultiplier: number;
  }
): number => {
  // Base confidence from pattern definition
  let score = baseConfidence;

  // Boost confidence based on keyword matches (up to +20)
  const keywordBoost = Math.min(factors.keywordMatches * 5, 20);
  score += keywordBoost;

  // Boost confidence based on context clues (up to +10)
  const contextBoost = Math.min(factors.contextMatches * 3, 10);
  score += contextBoost;

  // Apply mode-specific pattern weight
  score *= factors.patternWeight;

  // Apply user sensitivity setting (0.5 - 1.5 range)
  score *= factors.sensitivityMultiplier;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Calculate focus score from cognitive metrics
 * Formula: 100 - (gapPenalty * 0.3 + fillerPenalty * 0.4 + ratePenalty * 0.3)
 */
export const calculateFocusScore = (
  metrics: Partial<CognitiveMetrics>,
  sessionDuration: number // in milliseconds
): number => {
  const durationMinutes = sessionDuration / 60000;

  // Avoid division by zero
  if (durationMinutes < 0.1) {
    return 100;
  }

  // Calculate speech gaps penalty (0-40 points)
  // More than 5 gaps per minute is concerning
  const speechGaps = metrics.speechGaps || 0;
  const gapsPerMinute = speechGaps / durationMinutes;
  const gapPenalty = Math.min((gapsPerMinute / 5) * 40, 40);

  // Calculate filler words penalty (0-50 points)
  // More than 10 filler words per minute is concerning
  const fillerWords = metrics.fillerWords || 0;
  const fillersPerMinute = fillerWords / durationMinutes;
  const fillerPenalty = Math.min((fillersPerMinute / 10) * 50, 50);

  // Calculate speech rate penalty (0-30 points)
  // Normal speech: 120-150 WPM, too slow (<80) or too fast (>200) is concerning
  const avgSpeechRate = metrics.avgSpeechRate || 130;
  let ratePenalty = 0;
  if (avgSpeechRate < 80) {
    ratePenalty = ((80 - avgSpeechRate) / 80) * 30;
  } else if (avgSpeechRate > 200) {
    ratePenalty = ((avgSpeechRate - 200) / 100) * 30;
  }
  ratePenalty = Math.min(ratePenalty, 30);

  // Calculate final focus score
  const focusScore = 100 - (gapPenalty * 0.3 + fillerPenalty * 0.4 + ratePenalty * 0.3);

  return Math.max(0, Math.min(100, Math.round(focusScore)));
};

/**
 * Analyze text for filler words
 */
export const countFillerWords = (text: string): number => {
  const matches = text.match(FILLER_WORD_PATTERN);
  return matches ? matches.length : 0;
};

/**
 * Detect speech gaps in transcript chunks
 * Returns count of gaps > 2 seconds
 */
export const detectSpeechGaps = (
  chunks: Array<{ timestamp: number; text: string }>,
  gapThreshold: number = 2000 // 2 seconds in milliseconds
): number => {
  let gapCount = 0;

  for (let i = 1; i < chunks.length; i++) {
    const timeDiff = chunks[i].timestamp - chunks[i - 1].timestamp;
    // If gap is larger than threshold and previous chunk had text
    if (timeDiff > gapThreshold && chunks[i - 1].text.trim().length > 0) {
      gapCount++;
    }
  }

  return gapCount;
};

/**
 * Calculate words per minute from transcript
 */
export const calculateSpeechRate = (
  totalWords: number,
  speechDuration: number // in milliseconds
): number => {
  const durationMinutes = speechDuration / 60000;
  if (durationMinutes === 0) return 0;
  return Math.round(totalWords / durationMinutes);
};

/**
 * Count total words in text
 */
export const countWords = (text: string): number => {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
};

/**
 * Calculate cognitive metrics from transcript chunks
 */
export const calculateCognitiveMetrics = (
  chunks: Array<{ timestamp: number; text: string }>,
  sessionDuration: number
): CognitiveMetrics => {
  // Combine all text
  const fullText = chunks.map((c) => c.text).join(' ');

  // Count metrics
  const totalWords = countWords(fullText);
  const fillerWords = countFillerWords(fullText);
  const speechGaps = detectSpeechGaps(chunks);

  // Calculate speech duration (total session time minus gaps)
  let speechDuration = sessionDuration;
  for (let i = 1; i < chunks.length; i++) {
    const timeDiff = chunks[i].timestamp - chunks[i - 1].timestamp;
    if (timeDiff > 2000) {
      speechDuration -= timeDiff - 2000; // Subtract gap time beyond 2s
    }
  }
  speechDuration = Math.max(speechDuration, 1000); // Minimum 1 second

  const avgSpeechRate = calculateSpeechRate(totalWords, speechDuration);
  const focusScore = calculateFocusScore(
    { speechGaps, fillerWords, avgSpeechRate, totalWords, speechDuration },
    sessionDuration
  );

  return {
    focusScore,
    speechGaps,
    fillerWords,
    avgSpeechRate,
    totalWords,
    speechDuration,
  };
};

/**
 * Determine pattern severity based on confidence score
 */
export const determineSeverity = (confidenceScore: number): 'low' | 'medium' | 'high' => {
  if (confidenceScore >= 80) return 'high';
  if (confidenceScore >= 60) return 'medium';
  return 'low';
};

/**
 * Calculate leverage indicator (Low/Medium/High)
 * Based on ratio of positive to negative signals
 */
export const calculateLeverageLevel = (
  positiveSignals: number,
  negativeSignals: number,
  totalPatterns: number
): 'low' | 'medium' | 'high' => {
  if (totalPatterns === 0) return 'medium';

  const positiveRatio = positiveSignals / totalPatterns;
  const negativeRatio = negativeSignals / totalPatterns;

  if (positiveRatio > negativeRatio * 2) return 'high';
  if (negativeRatio > positiveRatio * 2) return 'low';
  return 'medium';
};
