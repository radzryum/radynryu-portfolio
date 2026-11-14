import { useState, useEffect, useRef, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { api, getStoredActiveBranch, setStoredActiveBranch } from '../../lib/api'
import { AuthContext } from '../../auth/AuthContext'
import { shortBranchName } from '../../lib/branches'
import useRealtimeNotifications from '../../hooks/useRealtimeNotifications'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// Display-side guard for notifications written before the server started
// capitalizing staff names — the body opens with the submitter's name, so
// an uncapitalized first letter ("jerome Dela Cruz submitted…") is fixed at
// render time. Only the first character is touched, so names like
// "McDonald" or "Dela Cruz" pass through unchanged.
function formatBody(body) {
  if (!body) return body
  return body.charAt(0).toUpperCase() + body.slice(1)
}

function getNotificationIcon(title) {
  const t = (title || '').toLowerCase()
  if (t.includes('approved')) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    )
  }
  if (t.includes('returned') || t.includes('revision')) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      </div>
    )
  }
  if (t.includes('report') || t.includes('iep')) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
    )
  }
  if (t.includes('assessment')) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    </div>
  )
}

// Module scope so the purity rule doesn't read the timestamp as a render
// side effect — stamping is an intentional one-shot handoff.
function stampBranchArrival(label) {
  try {
    sessionStorage.setItem('cymon.branchArrived', JSON.stringify({ label, at: Date.now() }))
  } catch {
    // private mode — navigation still lands on the right branch
  }
}

function NotificationsDropdown() {
  const navigate = useNavigate()
  const location = useLocation()
  // Direct context (not useAuth) so the bell never crashes outside a
  // provider — the realtime hook simply stays idle without a user id.
  const { user, profile } = useContext(AuthContext) || {}
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unread first, then newest — so the current user's fresh items sit on
  // top highlighted without scrolling. Backend already orders by
  // created_at desc; this pins unread above read within the top 10.
  const sortNotifications = (rows) =>
    [...(rows || [])].sort((a, b) => {
      const au = a.read_at ? 1 : 0
      const bu = b.read_at ? 1 : 0
      if (au !== bu) return au - bu
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  // header is non-critical; a failed fetch just leaves the bell empty
  const loadNotifications = () =>
    api
      .notifications()
      .then((data) => {
        setNotifications(sortNotifications(data.notifications || []).slice(0, 10))
        setUnread(data.unread)
      })
      .catch(() => {})

  useEffect(() => {
    const id = setInterval(loadNotifications, 60000)
    loadNotifications()
    return () => clearInterval(id)
  }, [])

  // Instant arrival via Realtime; the list refetch keeps everything
  // server-truth (badges refresh through the shared update event).
  useRealtimeNotifications(user?.id, () => {
    loadNotifications()
    window.dispatchEvent(new CustomEvent('cymon:notification-update'))
  })

  // Freshness: the 60s poll alone means a just-arrived notification only
  // shows up after a tick (or a full refresh). Reload on bell open, on
  // tab focus (timers are throttled in background tabs), and on the shared
  // update event fired after notification-changing actions elsewhere.
  useEffect(() => {
    const onFocus = () => loadNotifications()
    const onUpdate = () => loadNotifications()
    window.addEventListener('focus', onFocus)
    window.addEventListener('cymon:notification-update', onUpdate)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('cymon:notification-update', onUpdate)
    }
  }, [])

  const toggleNotifications = () => setShowNotifications((next) => {
    if (!next) loadNotifications()
    return !next
  })

  const markAllNotificationsRead = async () => {
    if (!unread) return
    setUnread(0)
    setNotifications((prev) => sortNotifications(prev.map((notification) => ({
      ...notification,
      read_at: notification.read_at || new Date().toISOString(),
    }))))
    try {
      await api.markNotificationsRead()
      window.dispatchEvent(new CustomEvent('cymon:notification-update'))
    } catch {
      loadNotifications()
    }
  }

  const handleNotifClick = async (notif) => {
    setShowNotifications(false)
    // Auto-switch branch: a notification created in another branch (e.g. a
    // Cabuyao student assigned to someone currently acting in Alabang)
    // carries its clinic_id. Persist the target branch BEFORE navigating so
    // the destination — even a different role layout, which remounts
    // StaffLayout — fetches the right branch. The arrival modal is confirmed
    // in place or handed over to the next layout.
    if (notif?.clinic_id && profile?.role) {
      try {
        const d = await api.myClinics()
        const list = d?.clinics || []
        const target = list.find((c) => c.id === notif.clinic_id)
        if (target) {
          const isSuper = profile?.role === 'super_admin'
          const stored = getStoredActiveBranch()
          const homeId = list.find((c) => c.is_primary)?.id || ''
          const effectiveId = stored || (isSuper ? '__all__' : homeId)
          // Super Admins on the cross-branch ("All") view already see every
          // branch — narrowing them would be a step back, so skip the switch.
          if (effectiveId !== '__all__' && effectiveId !== target.id) {
            const label = shortBranchName(target)
            setStoredActiveBranch(target.id)
            // Same role area: this layout survives, so confirm the switch
            // in place. Cross-area links remount StaffLayout, which would
            // kill that overlay — hand the arrival beat over via storage.
            const sameArea =
              notif.link?.split('/')[1] === location.pathname.split('/')[1]
            if (sameArea) {
              window.dispatchEvent(
                new CustomEvent('cymon:branch-switch-applied', { detail: { label } }),
              )
            } else {
              stampBranchArrival(label)
            }
          }
        }
      } catch {
        // branch lookup failed — still navigate to the link
      }
    }
    if (!notif.read_at) {
      setUnread((current) => Math.max(0, current - 1))
      setNotifications((prev) => sortNotifications(prev.map((notification) =>
        notification.id === notif.id ? { ...notification, read_at: new Date().toISOString() } : notification,
      )))
      try {
        await api.markNotificationsRead([notif.id])
        window.dispatchEvent(new CustomEvent('cymon:notification-update'))
      } catch {
        loadNotifications()
      }
    }
    if (notif.link) {
      window.dispatchEvent(
        new CustomEvent('cymon:workflow-refresh', {
          detail: { link: notif.link },
        }),
      )
      navigate(notif.link)
    }
  }

  return (
    <>
      {/* Dark Overlay for Notifications */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={() => setShowNotifications(false)}
        />
      )}

      <div className={`relative ${showNotifications ? 'z-[60]' : ''}`} ref={notifRef}>
        <button
          className={`relative rounded-md h-7 w-7 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 transition-colors ${
            showNotifications ? 'bg-white dark:bg-slate-800 text-purple-900 dark:text-slate-100 shadow-sm' : 'hover:bg-purple-50 dark:hover:bg-slate-800 text-purple-700 dark:text-slate-300'
          }`}
          aria-label="Notifications"
          aria-haspopup="true"
          aria-expanded={showNotifications}
          onClick={toggleNotifications}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 16V11a6 6 0 0 1 12 0v5l1 2H5zM10 20h4" />
          </svg>
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <div
          className={`z-50 overflow-hidden text-left rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200 ease-out ${
            showNotifications ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
          } fixed left-1/2 top-16 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 origin-top sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:translate-x-0 sm:origin-top-right`}
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-5 py-4">
            <span className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100">Notifications</span>
            {unread > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900"
                >
                  Mark all as read
                </button>
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-purple-700">
                  {unread} NEW
                </span>
              </div>
            )}
          </div>
          {/* Dropdown List */}
          <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto sm:max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">
                You're all caught up — no notifications yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-purple-100 dark:hover:bg-slate-800 active:bg-purple-200 dark:active:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500 ${
                      n.link ? 'cursor-pointer' : 'cursor-default'
                    } ${!n.read_at ? 'border-l-4 border-l-purple-500 bg-purple-50 dark:bg-slate-800/50' : ''}`}
                  >
                    {getNotificationIcon(n.title)}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${!n.read_at ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {(n.title || '').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()}
                      </span>
                      {n.body && (
                        <span className="mt-1 block text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {formatBody(n.body)}
                        </span>
                      )}
                      <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {timeAgo(n.created_at)}
                        {!n.read_at && (
                          <>
                            <span>&bull;</span>
                            <span className="text-purple-600 dark:text-purple-400">Unread</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default NotificationsDropdown
