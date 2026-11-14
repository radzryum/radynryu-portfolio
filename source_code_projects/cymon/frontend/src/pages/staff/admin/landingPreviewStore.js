// Tiny cross-page store for the Content Manager's live preview. The editor
// snapshots its current (unsaved) sections here before navigating to the
// full-page preview route, which reads them back. sessionStorage keeps the
// snapshot across the route change within the same tab.
const STORAGE_KEY = 'cm_landing_preview'

export function stagingSections() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStagingSections(sections) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sections || {}))
  } catch {
    /* storage may be full or unavailable — preview simply ignores staging */
  }
}
