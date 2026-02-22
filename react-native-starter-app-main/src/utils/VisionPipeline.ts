import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import ImageLabeling from '@react-native-ml-kit/image-labeling';
import ImageResizer from 'react-native-image-resizer';
import { soundexAll } from './Soundex';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DetectionType = 'TEXT' | 'OBJECT' | 'EMPTY';

export interface VisionResult {
    detection_type: DetectionType;
    /** Original raw text extracted before any enrichment */
    raw_text: string;
    /** Flat space-joined string ready to store in SQLite for LIKE search */
    content: string;
    /** Structured keys: [original, transliteration?, soundex?, ...labels?] */
    search_index: string[];
    /** Audit field — tells whether object detection ran or was bypassed */
    optimized_status: string;
}

const MIN_TEXT_LENGTH = 3;

// ─── Step 1: OCR ─────────────────────────────────────────────────────────────

const runOCR = async (uri: string): Promise<{ latin: string; hindi: string }> => {
    // Run Latin and Devanagari in parallel — both are lightweight ML Kit models
    const [latinRes, devaRes] = await Promise.allSettled([
        TextRecognition.recognize(uri, TextRecognitionScript.LATIN),
        TextRecognition.recognize(uri, TextRecognitionScript.DEVANAGARI),
    ]);
    return {
        latin: latinRes.status === 'fulfilled' ? latinRes.value.text?.trim() ?? '' : '',
        hindi: devaRes.status === 'fulfilled' ? devaRes.value.text?.trim() ?? '' : '',
    };
};

// ─── Step 3: Object/Scene Labeling (fallback only) ───────────────────────────

const runLabeling = async (uri: string): Promise<string[]> => {
    try {
        const results = await ImageLabeling.label(uri);
        return results
            .filter(l => l.confidence >= 0.50)   // wider net
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 7)                          // up to 7 labels
            .map(l => l.text);
    } catch (_) {
        return [];
    }
};

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * SEQUENTIAL VISION PIPELINE
 *
 * 1. OCR (LATIN + DEVANAGARI in parallel)   ← always runs
 * 2. Text found? → Early exit              ← object detection SKIPPED → battery saved
 * 3. No text?   → ImageLabeling fallback   ← top 3 labels at ≥60% confidence
 *
 * Returns a structured VisionResult with:
 *  - detection_type: 'TEXT' | 'OBJECT' | 'EMPTY'
 *  - search_index:   [original, transliteration, soundex, ...] for multilingual search
 *  - content:        flat joined string for SQLite LIKE queries
 *  - optimized_status: audit string
 */
export const analyzeImage = async (originalUri: string): Promise<VisionResult> => {
    let processUri = originalUri;

    // ── Step 0: Downsample Image (Massive speed boost for ML Kit) ──────────────
    try {
        const resized = await ImageResizer.createResizedImage(
            originalUri,
            1024,
            1024,
            'JPEG',
            80,
            0,
            undefined,
            false,
            { mode: 'contain' }
        );
        processUri = resized.uri;
    } catch (resizeError) {
        // Soft fail — continue with raw 12MP image if resizer fails for some reason
        console.warn('[VisionPipeline] Resize failed, using full resolution:', resizeError);
    }

    // ── Step 1: OCR ────────────────────────────────────────────────────────────
    const { latin, hindi } = await runOCR(processUri);
    const combinedText = [latin, hindi].filter(Boolean).join(' ').trim();

    // ── Step 2: Early exit if text found ──────────────────────────────────────
    if (combinedText.length >= MIN_TEXT_LENGTH) {
        const words = combinedText.split(/\s+/).filter(Boolean);
        // Soundex only makes sense for Latin/romanized words, not Devanagari
        const latinWords = words.filter(w => /^[a-zA-Z]+$/.test(w));
        const soundexCodes = soundexAll(latinWords.join(' '));

        return {
            detection_type: 'TEXT',
            raw_text: combinedText,
            search_index: [...words, ...soundexCodes],
            content: [...words, ...soundexCodes].join(' '),
            optimized_status: 'Object_Detection_Bypassed: True',
        };
    }

    // ── Step 3: Fallback — Object/Scene Recognition ───────────────────────────
    const labels = await runLabeling(processUri);

    if (labels.length > 0) {
        const soundexCodes = soundexAll(labels.join(' '));
        return {
            detection_type: 'OBJECT',
            raw_text: labels.join(', '),
            search_index: [...labels, ...soundexCodes],
            content: [...labels, ...soundexCodes].join(' '),
            optimized_status: 'Object_Detection_Bypassed: False',
        };
    }

    return {
        detection_type: 'EMPTY',
        raw_text: '',
        search_index: [],
        content: '',
        optimized_status: 'Object_Detection_Bypassed: False',
    };
};
