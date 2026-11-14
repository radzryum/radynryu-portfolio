// Reload-once recovery for stale code-split chunks.
//
// Every deploy renames the hashed route chunks, so a browser holding a
// cached index.html can request a chunk that no longer exists (404) right
// after we ship. React.lazy has no built-in retry — the failed import
// unmounts the whole tree into a blank white page. This wrapper reloads
// once (the reload fetches a fresh index.html with current chunk names);
// if the chunk still fails after a fresh load, the error is rethrown to
// the ErrorBoundary instead of looping reloads.
const RETRY_KEY = 'cymon.chunk-retry'

export function clearChunkRetry() {
  try {
    sessionStorage.removeItem(RETRY_KEY)
  } catch {
    // private mode — retry still works, it just can't de-dupe
  }
}

export function lazyWithRetry(importFn) {
  return async () => {
    try {
      return await importFn()
    } catch (err) {
      let retried = false
      try {
        retried = sessionStorage.getItem(RETRY_KEY) === '1'
        if (!retried) sessionStorage.setItem(RETRY_KEY, '1')
        else sessionStorage.removeItem(RETRY_KEY)
      } catch {
        // storage unavailable — reload once anyway, the boundary
        // catches it if the chunk is genuinely broken
      }
      if (!retried) window.location.reload()
      throw err
    }
  }
}
