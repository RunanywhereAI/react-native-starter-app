/**
 * Soundex phonetic algorithm — pure JS, offline, no dependencies.
 * Maps words that sound similar to the same 4-char code.
 *
 * Examples:
 *   soundex("aaj")  → "A200"
 *   soundex("aajj") → "A200"   ← same code ✅
 *   soundex("aj")   → "A200"   ← same code ✅
 *   soundex("raam") → "R500"
 *   soundex("ram")  → "R500"   ← same code ✅
 */
export const soundex = (str: string): string => {
    if (!str) return '';
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!s) return '';

    const codeMap: Record<string, string> = {
        B: '1', F: '1', P: '1', V: '1',
        C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
        D: '3', T: '3',
        L: '4',
        M: '5', N: '5',
        R: '6',
    };

    let result = s[0];
    let prev = codeMap[s[0]] ?? '0';

    for (let i = 1; i < s.length && result.length < 4; i++) {
        const c = codeMap[s[i]] ?? '0';
        if (c !== '0' && c !== prev) {
            result += c;
        }
        prev = c === '0' ? prev : c; // don't update prev on vowels (they just separate)
    }

    return result.padEnd(4, '0');
};

/**
 * Generate soundex codes for every word in a transliterated string.
 * e.g. "aaj ghar" → ["A200", "G600"]
 */
export const soundexAll = (text: string): string[] =>
    text
        .split(/\s+/)
        .filter(Boolean)
        .map(soundex)
        .filter(code => code.length === 4);
