import { soundexAll } from './Soundex';
import { enrichHindi, containsDevanagari } from './HindiTranslit';

// ─── LLM-ready state (still used if someone opts in later) ───────────────────
let _llmReady: boolean | null = null;
export const markLLMReady = () => { _llmReady = true; };

/**
 * Detects if a string contains Devanagari (Hindi) characters.
 */
export const containsHindi = (text: string): boolean =>
    /[\u0900-\u097F]/.test(text);

/**
 * Builds a 3-part multilingual search index for any detected text.
 *
 * For Hindi text, uses DETERMINISTIC transliteration (no LLM):
 *   Part 1 — Original Devanagari    e.g. "कमल"
 *   Part 2 — Hinglish (rule-based)  e.g. "kamal"
 *   Part 3 — English (dict lookup)  e.g. "lotus flower"
 *   Part 4 — Soundex phonetic codes e.g. "K540 L320"
 *
 * Search examples that now all match "कमल":
 *   "कमल" ✅  "kamal" ✅  "lotus" ✅  "kamaal" ✅  "lotus flower" ✅
 *
 * No LLM required — works offline, instant, zero errors.
 */
export const buildIndexableContent = async (rawText: string): Promise<string> => {
    if (!rawText || rawText.trim().length === 0) return '';

    if (containsHindi(rawText)) {
        // Deterministic pipeline — no model, no latency, no errors
        const enriched = enrichHindi(rawText);  // "कमल kamal lotus flower"

        // Add soundex on the Hinglish/English parts for typo tolerance
        const latinPart = enriched.replace(/[\u0900-\u097F]/g, '').trim();
        const soundexCodes = latinPart ? soundexAll(latinPart).join(' ') : '';

        return [enriched, soundexCodes].filter(Boolean).join(' ').trim();
    }

    return rawText.trim();
};
