// Text hygiene shared by request validation and model-output validation.

// Control characters (C0 and C1) become a space so words do not run together.
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
// Invisible characters that can hide or reorder text: every Unicode format character (zero-width
// space, bidirectional controls, soft hyphen, the tag characters used to smuggle hidden
// instructions, ...) and the Hangul fillers. Zero-width non-joiner (U+200C) and joiner (U+200D) are
// kept: Indic and Persian scripts need them.
const INVISIBLE = /[\p{Cf}ᅟᅠㅤﾠ]/gu;
const KEEP = new Set(['‌', '‍']);

/** Collapse whitespace and strip control and invisible characters. Non-strings become ''. */
export function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(INVISIBLE, (char) => (KEEP.has(char) ? char : ''))
        .replace(CONTROL, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** cleanText, then truncate to maxLength characters without splitting a surrogate pair. */
export function clip(value, maxLength) {
    const clipped = cleanText(value).slice(0, maxLength);
    return /[\uD800-\uDBFF]$/.test(clipped) ? clipped.slice(0, -1) : clipped;
}

export function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
