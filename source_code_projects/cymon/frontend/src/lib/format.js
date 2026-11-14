export const PH_MOBILE_RE = /^09\d{9}$/

export const formatPHMobile = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`
}

export const normalizePHMobile = (raw) => String(raw || '').replace(/\D/g, '').replace(/^63/, '0')

export const isValidPHMobile = (raw) => PH_MOBILE_RE.test(normalizePHMobile(raw))

// Normalize a display name to formal Title Case:
// - "jerome dela cruz" → "Jerome Dela Cruz" (lowercase start)
// - "MARIA FAYE H. BIRINGAN" → "Maria Faye H. Biringan" (all-caps rows)
// Mixed-case parts ("Dela", "McDonald", "O'Brien") pass through untouched,
// and Roman-numeral suffixes ("II", "III", "IV") stay uppercase.
// Display-side guard for records typed in any casing at registration.
const ROMAN_NUMERAL_RE = /^(ii|iii|iv|v|vi|vii|viii|ix|x)$/i
export const capitalizeName = (raw) =>
  String(raw || '')
    .split(/(\s+|-|')/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === "'") return part
      const clean = part.replace(/\.$/, '')
      if (ROMAN_NUMERAL_RE.test(clean)) return clean.toUpperCase() + (part.endsWith('.') ? '.' : '')
      if (/^[a-zà-ÿ]/.test(part)) return part.charAt(0).toUpperCase() + part.slice(1)
      if (part.length > 1 && part === part.toUpperCase()) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      }
      return part
    })
    .join('')

const NAME_SUFFIX_RE = /^(jr|sr|ii|iii|iv|v)\.?$/i

// Shorten a full display name to "First M. Last" for tight spaces like the
// sidebar ("Jinky Crisostomo Malabanan" → "Jinky C. Malabanan"). A trailing
// suffix stays glued to the surname ("Juan Dela Cruz Jr" → "Juan D. Cruz
// Jr"). One- and two-word names pass through (capitalized).
export const shortDisplayName = (raw) => {
  const parts = capitalizeName(raw).trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return parts.join(' ')
  let surname = parts.pop()
  if (NAME_SUFFIX_RE.test(surname) && parts.length > 2) {
    surname = `${parts.pop()} ${surname}`
  }
  const [first, ...middles] = parts
  const initials = middles.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
  return `${first} ${initials} ${surname}`
}

// Surname particles that glue to the family name when parsing a bare string
// without structured fields ("Jerome Dela Cruz" → surname "Dela Cruz", not
// "Cruz" with a "D." initial). PH-heavy list plus common Western particles.
const COMPOUND_PREFIX_RE = /^(dela|del|de|la|los|las|san|santa|santo|van|von|der|den|le|du|da|di|st|ste|mac|mc)$/i

// A–Z comparator for student pickers and directories. Matches the displayed
// "LAST, FIRST M." order (backend `name` is "First M. Last", so sorting by it
// looks wrong on screen).
export const compareStudentsAZ = (a, b) =>
  (formatLastFirstMI(a) || a?.name || '').localeCompare(formatLastFirstMI(b) || b?.name || '')

// Pin the student a notification deep link points at to the top of a
// directory — they are the caller's most recent target, so they should never
// be buried mid-list even though everyone else stays A–Z. `key` covers maps
// keyed by patient uuid (`id`) vs Compliance's `key`.
export const pinStudentFirst = (students, patientId, key = 'id') => {
  if (!patientId) return students
  const index = students.findIndex((s) => String(s?.[key]) === String(patientId))
  if (index <= 0) return students
  return [students[index], ...students.slice(0, index), ...students.slice(index + 1)]
}

// "Lastname, Firstname M." for person dropdowns (staff + student pickers):
// "Jinky Crisostomo Malabanan" → "Malabanan, Jinky C."
// Prefers structured first/middle/last/suffix fields (employees + patients
// APIs return them); falls back to parsing a display-name string when only
// `name` / `display_name` is available. Suffix stays glued at the end
// ("Dela Cruz, Juan D. Jr"). Dropdown search matches on tokens, so both
// "malabanan jinky" and "malabanan, jinky" still hit.
export const formatLastFirstMI = (person) => {
  if (person == null) return ''
  if (typeof person === 'string') {
    const parts = capitalizeName(person).trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0]
    let surname = parts.pop()
    if (NAME_SUFFIX_RE.test(surname) && parts.length > 1) {
      surname = `${parts.pop()} ${capitalizeName(surname)}`
    }
    // Reattach compound-surname particles ("Dela", "De", "La", "San", ...)
    // so "Jerome Dela Cruz" → "Dela Cruz, Jerome" instead of "Cruz,
    // Jerome D.". Backend-composed "First M. Last" strings (whose middle is
    // already an initial like "G.") never hit this branch.
    while (parts.length > 1 && COMPOUND_PREFIX_RE.test(parts[parts.length - 1].replace(/\.$/, ''))) {
      surname = `${parts.pop()} ${surname}`
    }
    if (parts.length === 1) return `${surname}, ${parts[0]}`
    const [first, ...middles] = parts
    const initials = middles.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
    return `${surname}, ${first} ${initials}`
  }
  const first = capitalizeName(String(person.first_name || '').trim())
  const middle = String(person.middle_name || '').trim()
  const last = capitalizeName(String(person.last_name || '').trim())
  const suffix = capitalizeName(String(person.suffix_name || '').trim())
  if (!first && !last) {
    return capitalizeName(person.display_name || person.name || '')
  }
  const initials = middle
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(' ')
  if (!last) return `${first}${initials ? ` ${initials}` : ''}${suffix ? ` ${suffix}` : ''}`
  return `${last}${first ? `, ${first}` : ''}${initials ? ` ${initials}` : ''}${suffix ? ` ${suffix}` : ''}`
}
