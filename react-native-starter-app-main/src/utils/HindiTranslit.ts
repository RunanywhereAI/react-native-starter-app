/**
 * DETERMINISTIC HINDI TRANSLITERATOR
 *
 * Converts Devanagari text to Hinglish (Romanized Hindi) using a character map.
 * Devanagari is a phonetic script, so this mapping is 100% accurate — no LLM needed.
 *
 * Also provides an English keyword lookup for common words to enable full cross-lingual search.
 */

// ─── Devanagari → Latin character map ────────────────────────────────────────

const VOWELS: Record<string, string> = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri', 'अं': 'an',
};

const MATRAS: Record<string, string> = {
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
    'ं': 'n', 'ः': 'h', '्': '', 'ँ': 'n',
};

const CONSONANTS: Record<string, string> = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क्ष': 'ksh',
    'त्र': 'tr', 'ज्ञ': 'gya',
    // Nukta variants
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f',
    'ड़': 'r', 'ढ़': 'rh', 'य़': 'y',
};

const ALL_CHARS: Record<string, string> = { ...VOWELS, ...MATRAS, ...CONSONANTS };

/**
 * Converts a Devanagari string to its Hinglish (Romanized) equivalent.
 * e.g. "कमल" → "kamal", "आधार" → "aadhaar", "घर" → "ghar"
 */
export const transliterate = (text: string): string => {
    let result = '';
    let i = 0;
    while (i < text.length) {
        // Try 2-char sequences first (conjuncts like क्ष, त्र, ज्ञ)
        const two = text.slice(i, i + 2);
        if (ALL_CHARS[two] !== undefined) {
            result += ALL_CHARS[two];
            i += 2;
            continue;
        }
        const one = text[i];
        if (CONSONANTS[one] !== undefined) {
            result += CONSONANTS[one];
            // Check for following matra
            const next = text[i + 1];
            if (next && MATRAS[next] !== undefined) {
                result += MATRAS[next];
                i += 2;
            } else if (!next || MATRAS[next] === undefined) {
                // Implicit 'a' vowel after consonant (unless halant follows)
                if (next !== '्') result += 'a';
                i++;
            }
        } else if (ALL_CHARS[one] !== undefined) {
            result += ALL_CHARS[one];
            i++;
        } else if (/[\u0900-\u097F]/.test(one)) {
            // Unknown Devanagari character — skip
            i++;
        } else {
            // Non-Devanagari (spaces, punctuation, Latin chars) — keep as-is
            result += one;
            i++;
        }
    }
    return result.trim().replace(/\s+/g, ' ');
};

// ─── Common Hindi word → English translation dictionary ───────────────────────
// Covers the most frequently searched topics. Expand as needed.

const HINDI_DICT: Record<string, string> = {
    // Nature / Plants
    'कमल': 'lotus flower', 'गुलाब': 'rose flower', 'पत्ता': 'leaf',
    'पेड़': 'tree', 'फूल': 'flower', 'नदी': 'river',
    'पहाड़': 'mountain hill', 'आसमान': 'sky', 'सूरज': 'sun',
    'चाँद': 'moon', 'तारा': 'star', 'बादल': 'cloud',
    'बारिश': 'rain', 'पानी': 'water', 'आग': 'fire',

    // People & Relations
    'माँ': 'mother mom', 'पिता': 'father dad', 'भाई': 'brother',
    'बहन': 'sister', 'बच्चा': 'child baby', 'दोस्त': 'friend',
    'परिवार': 'family', 'लड़का': 'boy man', 'लड़की': 'girl woman',

    // Places
    'घर': 'home house', 'स्कूल': 'school', 'अस्पताल': 'hospital',
    'बाजार': 'market', 'मंदिर': 'temple', 'मस्जिद': 'mosque',
    'शहर': 'city', 'गाँव': 'village', 'सड़क': 'road street',

    // Documents / ID
    'आधार': 'aadhaar id card', 'पासपोर्ट': 'passport', 'नाम': 'name',
    'पता': 'address', 'जन्म': 'birth date', 'फोन': 'phone mobile',
    'ईमेल': 'email',

    // Food
    'खाना': 'food meal eat', 'चाय': 'tea', 'दूध': 'milk',
    'रोटी': 'bread roti', 'चावल': 'rice', 'दाल': 'lentil dal',
    'सब्जी': 'vegetable', 'फल': 'fruit', 'मिठाई': 'sweets dessert',

    // Common adjectives / general
    'बड़ा': 'big large', 'छोटा': 'small little', 'अच्छा': 'good nice',
    'बुरा': 'bad', 'नया': 'new', 'पुराना': 'old',
    'लाल': 'red', 'नीला': 'blue', 'हरा': 'green',
    'सफेद': 'white', 'काला': 'black', 'पीला': 'yellow',

    // Numbers / Time
    'एक': 'one', 'दो': 'two', 'तीन': 'three', 'चार': 'four', 'पाँच': 'five',
    'आज': 'today', 'कल': 'tomorrow yesterday', 'अभी': 'now',
    'सुबह': 'morning', 'शाम': 'evening', 'रात': 'night',

    // Actions
    'जाना': 'go', 'आना': 'come', 'देखना': 'see look',
    'पीना': 'drink', 'पढ़ना': 'read', 'लिखना': 'write', 'बोलना': 'speak say',
};

/**
 * Look up English translations for all known words in a Hindi string.
 * Returns a space-separated string of English keywords.
 * e.g. "कमल घर" → "lotus flower home house"
 */
export const lookupEnglish = (text: string): string => {
    const words = text.split(/[\s,।]+/).filter(Boolean);
    const englishKeys: string[] = [];
    for (const word of words) {
        const translation = HINDI_DICT[word.trim()];
        if (translation) englishKeys.push(translation);
    }
    return englishKeys.join(' ');
};

/**
 * Detect if a string contains Devanagari characters.
 */
export const containsDevanagari = (text: string): boolean =>
    /[\u0900-\u097F]/.test(text);

/**
 * Full enrichment pipeline — deterministic, zero LLM, instant.
 *
 *  Input:  "कमल" (OCR output)
 *  Output: "कमल kamal lotus flower"
 *
 *  Input:  "आधार कार्ड"
 *  Output: "आधार कार्ड aadhaar kaard aadhaar id card"
 */
export const enrichHindi = (text: string): string => {
    const hinglish = transliterate(text);   // "kaamal"  rule-based, 100% accurate
    const english = lookupEnglish(text);   // "lotus flower"  from dict
    return [text.trim(), hinglish, english].filter(Boolean).join(' ').trim();
};
