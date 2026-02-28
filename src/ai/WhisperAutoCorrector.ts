import { NegotiationMode } from '../types/session';
import { PATTERN_LIBRARY, MODE_INTENT_MATRIX } from './patternLibrary';

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Extracts a flattened, unique list of vocabulary words for a given negotiation mode.
 * This includes both topic tags and simple structural pattern words.
 */
function getModeVocabulary(mode: NegotiationMode): string[] {
  const modeMatrix = MODE_INTENT_MATRIX[mode] || {};
  const intentKeys = Object.keys(modeMatrix) as Array<keyof typeof PATTERN_LIBRARY>;
  
  const vocabSet = new Set<string>();

  intentKeys.forEach((intent) => {
    // Only process intents that are actually weighted for this mode > 0
    if ((modeMatrix as any)[intent] > 0) {
      const tactic = PATTERN_LIBRARY[intent];
      
      // Add topic tags
      if (tactic.topicTags) {
        tactic.topicTags.forEach((tag: string) => vocabSet.add(tag.toLowerCase()));
      }
      
      // Attempt to extract raw words from simple structural regexes
      if (tactic.structuralPatterns) {
        tactic.structuralPatterns.forEach((pattern: string) => {
          // Remove regex artifacts like .* or ^ or \b
          const words = pattern.replace(/[.*^$\\?|()[\]{}]/g, ' ')
                               .split(/\s+/)
                               .filter((w: string) => w.length > 3); // Only preserve meaningful words > 3 chars
          words.forEach((w: string) => vocabSet.add(w.toLowerCase()));
        });
      }
    }
  });

  return Array.from(vocabSet);
}

// Cache vocabulary per mode to prevent recalculating on every transcript chunk
const vocabCache: Record<string, string[]> = {};

function getCachedVocabulary(mode: NegotiationMode): string[] {
  if (!vocabCache[mode]) {
    vocabCache[mode] = getModeVocabulary(mode);
  }
  return vocabCache[mode];
}

/**
 * Auto-corrects a Whisper transcription chunk by fuzzy matching misheard words 
 * against the expected negotiation mode vocabulary.
 */
export function autoCorrectTranscript(transcript: string, mode: NegotiationMode): string {
  if (!transcript) return transcript;

  const vocab = getCachedVocabulary(mode);
  if (vocab.length === 0) return transcript;

  // Split into words, preserving punctuation if possible by matching words
  // e.g. "Wait, what?" -> ["Wait", ",", " ", "what", "?"]
  // We'll just tokenize by word boundaries and check the alphabetic chunks
  const tokens = transcript.split(/(\b[a-zA-Z]+\b)/);

  const correctedTokens = tokens.map(token => {
    // Only fuzz alpha words that are reasonably long
    if (/^[a-zA-Z]+$/.test(token) && token.length >= 4) {
      let bestMatch = token;
      let minDistance = Infinity;

      for (const vWord of vocab) {
        // Skip comparing if lengths are vastly different
        if (Math.abs(vWord.length - token.length) > 2) continue;

        const dist = levenshteinDistance(token, vWord);

        // Threshold logic:
        // Length 4-5: allow 1 error
        // Length 6+: allow 2 errors
        const maxErrors = token.length >= 6 ? 2 : 1;

        if (dist <= maxErrors && dist < minDistance) {
          minDistance = dist;
          // Match the original casing if possible. Simple heuristic: match first letter casing
          const isCapitalized = token[0] === token[0].toUpperCase();
          bestMatch = isCapitalized 
            ? vWord.charAt(0).toUpperCase() + vWord.slice(1)
            : vWord;
        }
      }
      return bestMatch;
    }
    return token;
  });

  return correctedTokens.join('');
}
