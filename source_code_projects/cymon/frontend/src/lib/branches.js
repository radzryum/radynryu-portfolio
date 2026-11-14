// Short branch labels for tight UI surfaces (filter dropdowns, chips,
// register/book/publish selectors). The official full names in the
// database stay untouched — flyers, letterheads, and public forms keep
// using those. Accepts a { code, name } object or a plain string.
export function shortBranchName(input) {
  const code = typeof input === 'string' ? input : (input?.code || '')
  const name = typeof input === 'string' ? input : (input?.name || '')
  const haystack = `${code} ${name}`.toUpperCase()
  if (haystack.includes('ALABANG')) return 'ClearMind Alabang'
  if (haystack.includes('CABUYAO')) return 'ClearMind Cabuyao'
  return String(name || code || '').trim()
}

// "ClearMind Alabang (CLEARMIND-ALABANG)" — for selects where the code
// helps tell branches apart.
export function branchOptionLabel(branch) {
  const short = shortBranchName(branch)
  const code = typeof branch === 'string' ? '' : (branch?.code || '')
  if (!short) return code
  return code ? `${short} (${code})` : short
}

// "Alabang Branch" — for the public admission form pill, so guardians see
// a short plain label instead of the full official clinic name + code.
export function branchApplyLabel(branch) {
  const code = typeof branch === 'string' ? branch : (branch?.code || '')
  const name = typeof branch === 'string' ? branch : (branch?.name || '')
  const haystack = `${code} ${name}`.toUpperCase()
  if (haystack.includes('ALABANG')) return 'Alabang Branch'
  if (haystack.includes('CABUYAO')) return 'Cabuyao Branch'
  return String(name || code || '').trim()
}
