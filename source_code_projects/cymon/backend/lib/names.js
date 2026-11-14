// Build a patient's display name with a middle initial: "First M. Last".
// Pass an object carrying first_name / middle_name / last_name (e.g. a patients
// row or a joined `patients(...)` object). Returns '—' when given null/undefined
// so callers can drop their own fallbacks. Each part is title-cased so
// ALL-CAPS rows ("MARIA", "BIRINGAN") render formally ("Maria", "Biringan").
function patientName(p) {
  if (!p) return '—';
  const mid = p.middle_name && p.middle_name.trim();
  const initial = mid ? `${mid.charAt(0).toUpperCase()}.` : null;
  return [capitalizeNamePart(p.first_name), initial, capitalizeNamePart(p.last_name)].filter(Boolean).join(' ');
}

const ROMAN_NUMERAL_RE = /^(ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

// Staff / student names are typed by hand, so normalize casing:
// - "jerome" → "Jerome" (lowercase start)
// - "MARIA" → "Maria", "BIRINGAN" → "Biringan" (all-caps rows)
// Mixed-case parts ("Dela", "McDonald", "O'Brien") pass through untouched,
// and Roman-numeral suffixes ("II", "III", "IV") stay uppercase.
function capitalizeNamePart(value) {
  return String(value || '')
    .split(/(\s+|-|')/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === "'") return part;
      const clean = part.replace(/\.$/, '');
      if (ROMAN_NUMERAL_RE.test(clean)) return clean.toUpperCase() + (part.endsWith('.') ? '.' : '');
      if (/^[a-zà-ÿ]/.test(part)) return part.charAt(0).toUpperCase() + part.slice(1);
      if (part.length > 1 && part === part.toUpperCase()) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      // Shouted mixed shapes like "McDONALD" → "Mcdonald" look worse than
      // leaving them, so only collapse the all-caps case above.
      return part;
    })
    .join('');
}

const NAME_SUFFIX_RE = /^(jr|sr|ii|iii|iv|v)\.?$/i;

// Shorten a full display name to "First M. Last" for tight spaces like PDF
// signatory lines ("Jinky Crisostomo Malabanan" → "Jinky C. Malabanan").
// Mirrors the frontend shortDisplayName helper. A trailing suffix stays glued
// to the surname; one- and two-word names pass through (capitalized).
function shortDisplayName(value) {
  const parts = capitalizeNamePart(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  let surname = parts.pop();
  if (NAME_SUFFIX_RE.test(surname) && parts.length > 2) {
    surname = `${parts.pop()} ${surname}`;
  }
  const [first, ...middles] = parts;
  const initials = middles.map((part) => `${part.charAt(0).toUpperCase()}.`).join(' ');
  return `${first} ${initials} ${surname}`;
}

module.exports = { patientName, capitalizeNamePart, shortDisplayName };
