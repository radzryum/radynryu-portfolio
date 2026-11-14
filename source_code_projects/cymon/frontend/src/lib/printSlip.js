// Print an HTML slip without window.open().
//
// Both registration slips used window.open + document.write. Popup blockers
// silently kill window.open (it returns null), so "Print Slip" appeared to
// do nothing. A same-origin hidden iframe is never treated as a popup, so
// printing works with no browser setting changes.
//
// Returns true when the print dialog was triggered, false when even the
// iframe path failed (caller should toast in that case).
export function printSlipHtml(slipHtml) {
  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const cleanup = () => setTimeout(() => iframe.remove(), 1000)
    const win = iframe.contentWindow
    // Remove the frame once printing finishes; the timeout is the fallback
    // for browsers that never fire afterprint (e.g. print preview cancel).
    try {
      win.onafterprint = () => iframe.remove()
    } catch {
      // ignore — cleanup timeout below still runs
    }

    const doc = win.document
    doc.open()
    doc.write(slipHtml)
    doc.close()

    // Give the frame a tick to render before invoking print.
    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {
        // unreachable in practice; cleanup still runs
      }
      cleanup()
    }, 250)
    return true
  } catch {
    return false
  }
}
