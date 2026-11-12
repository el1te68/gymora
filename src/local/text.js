// Port of FoodTextNormalizer: forgiving Persian/English search text.

const ARABIC_FIX = { 'ي': 'ی', 'ى': 'ی', 'ك': 'ک', 'ۀ': 'ه', 'ة': 'ه', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا' };
const SEPARATORS = new Set(['‌', '‍', '-', '_', '/', '(', ')', '،', ',', '.', '+']);

export function normalize(text) {
  if (text == null || String(text).trim() === '') return '';
  let out = '';
  for (const raw of String(text)) {
    let c = ARABIC_FIX[raw] ?? raw;
    if (c >= '۰' && c <= '۹') c = String.fromCharCode(48 + c.charCodeAt(0) - 0x06f0);
    else if (c >= '٠' && c <= '٩') c = String.fromCharCode(48 + c.charCodeAt(0) - 0x0660);

    // Arabic diacritics and tatweel carry no meaning for search.
    if ((c >= 'ً' && c <= 'ٟ') || c === 'ـ' || c === 'ٰ') continue;

    if (SEPARATORS.has(c) || /\s/.test(c)) {
      out += ' ';
      continue;
    }
    out += c.toLowerCase();
  }
  return out.split(' ').filter(Boolean).join(' ');
}

export function buildSearchKey(name, englishName, brand) {
  const spaced = normalize(`${name ?? ''} ${englishName ?? ''} ${brand ?? ''}`);
  return `${spaced} ${spaced.replaceAll(' ', '')}`;
}

export function searchTokens(term) {
  const parts = normalize(term).split(' ').filter(Boolean);
  return [...new Set(parts)].slice(0, 6);
}
