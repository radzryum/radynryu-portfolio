import { useContext, useEffect, useRef, useState } from 'react'
import { api, getStoredActiveBranch, setStoredActiveBranch } from '../../lib/api'
import { shortBranchName } from '../../lib/branches'
import { useAuth } from '../../auth/useAuth'
import { BranchSwitchContext } from '../branchSwitchContext'

// Pseudo-option for Super Admins: no header = cross-branch view.
const ALL_ID = '__all__'
const ALL_LABEL = 'All branches'

const BRANCH_GLYPH = (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
  </svg>
)

// Branch switcher for one-email multi-branch staff: pick which branch to
// act in. The choice travels as x-active-branch, so every listing re-scopes
// server-side. Hidden unless the account can act in 2+ branches.
//
// The switch itself is orchestrated by StaffLayout (it owns the overlay + a
// content remount, so there is NO full-page reload and NO butterfly loading
// screen): this dropdown only announces the pick via `cymon:branch-switch`.
// StaffLayout plays "Switching to…", swaps the stored branch, remounts the
// workspace (every list refetches under the new branch), then plays
// "Now you are in…" on top — the workspace never appears first.
function BranchSwitcher() {
  const [clinics, setClinics] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { profile } = useAuth() || {}
  const isSuper = profile?.role === 'super_admin'
  // Direct call into StaffLayout (always mounted above this dropdown), so
  // the switching modal is guaranteed to appear — no events involved.
  const requestBranchSwitch = useContext(BranchSwitchContext)

  useEffect(() => {
    let on = true
    api.myClinics()
      .then((d) => {
        if (!on) return
        const list = d?.clinics || []
        setClinics(list)
        // Drop a stored branch the account can no longer act in (access
        // revoked elsewhere) instead of silently scoping to home.
        const stored = getStoredActiveBranch()
        if (stored && !list.some((c) => c.id === stored)) {
          setStoredActiveBranch('')
        }
      })
      .catch(() => {})
    return () => { on = false }
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Super Admins always get the switcher (all branches + cross-branch
  // view). Everyone else only when they can act in 2+ branches — a single
  // branch means there is nothing to switch between.
  if (clinics.length < 2 && !isSuper) return null

  const stored = getStoredActiveBranch()
  const homeId = clinics.find((c) => c.is_primary)?.id || ''
  // No stored choice: Super Admin sees everything, others see home.
  const effectiveId = stored || (isSuper ? ALL_ID : homeId)
  const rows = isSuper ? [{ id: ALL_ID, code: '', name: ALL_LABEL }, ...clinics] : clinics
  const current = rows.find((c) => c.id === effectiveId) || rows[0]

  const pick = (id) => {
    setOpen(false)
    // "All branches" (and a non-super's home) send no header: Super Admin
    // back to the cross-branch view, everyone else to home.
    const next = (id === ALL_ID || (!isSuper && id === homeId)) ? '' : id
    if ((stored || '') === next) return
    const isAll = id === ALL_ID
    const target = clinics.find((c) => c.id === id)
    requestBranchSwitch?.({
      label: isAll ? ALL_LABEL : shortBranchName(target || { name: '' }),
      next,
      arrivedSubtitle: isAll ? 'Showing all branches.' : undefined,
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.id === ALL_ID ? 'Viewing all branches' : `Acting branch: ${shortBranchName(current)}`}
        className="flex h-7 max-w-[10rem] items-center gap-1.5 rounded-md px-2 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-slate-800 sm:max-w-[12rem]"
      >
        <span className="block h-4 w-4 shrink-0 [&>svg]:h-full [&>svg]:w-full">{BRANCH_GLYPH}</span>
        <span className="truncate">{current.id === ALL_ID ? ALL_LABEL : shortBranchName(current)}</span>
      </button>
      {open ? (
        <div role="listbox" aria-label="Acting branch" className="absolute right-0 z-[70] mt-1 w-56 overflow-hidden rounded-xl border border-purple-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800">
            Acting branch
          </div>
          {rows.map((c) => {
            const isCurrent = c.id === current.id
            const isAll = c.id === ALL_ID
            return (
              <button
                key={c.id}
                role="option"
                aria-selected={isCurrent}
                type="button"
                onClick={() => pick(c.id)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-purple-50 dark:hover:bg-slate-800 ${isCurrent ? 'font-bold text-purple-800 dark:text-purple-200' : 'font-medium text-slate-600 dark:text-slate-300'}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{isAll ? ALL_LABEL : shortBranchName(c)}</span>
                  {c.is_primary && !isAll ? (
                    <span className="block text-[10px] font-semibold text-slate-400">Home branch</span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Current</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default BranchSwitcher
