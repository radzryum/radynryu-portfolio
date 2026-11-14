import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { SidebarContext } from '../../components/sidebarContext'
import { BranchSwitchContext } from '../../components/branchSwitchContext'
import { useAuth } from '../../auth/useAuth'
import { api } from '../../lib/api'
import { roleOptions } from '../../lib/roleNav'
import { setStoredActiveBranch } from '../../lib/api'
import SwitchOverlay from '../../components/ui/SwitchOverlay'

// Role switch beats (total ≈ 5s): the "Switching to…" modal plays in the
// CURRENT layout, then navigation remounts StaffLayout under the new role
// path — which would kill any in-memory modal instantly. So the arrival
// beat travels via sessionStorage and replays in the NEW layout.
const ROLE_SWITCHING_MS = 1800
const ROLE_ARRIVED_MS = 3200
const ROLE_ARRIVED_KEY = 'cymon.roleArrived'
// Branch beats mirror the role flow (total ≈ 5s) but stay in ONE layout —
// no reload, so no butterfly loading screen and the workspace can never
// appear before the arrival modal. The stored branch swaps exactly when
// the content remounts, so every refetch carries the new x-active-branch.
const BRANCH_SWITCHING_MS = 1800
const BRANCH_ARRIVED_MS = 3200
const BRANCH_ARRIVED_KEY = 'cymon.branchArrived'
const BRANCH_GLYPH = (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
  </svg>
)

// Module scope (not a component/hook) so the purity rule stays quiet:
// stamping the arrival flag is an intentional side effect.
function stampRoleArrival(label) {
  try {
    sessionStorage.setItem(ROLE_ARRIVED_KEY, JSON.stringify({ label, at: Date.now() }))
  } catch {
    // ignore storage errors (private mode)
  }
}
import { capitalizeName, shortDisplayName } from '../../lib/format'
import { CircleHelp, ChevronDown, User, X } from 'lucide-react'

function StaffLayout({ user, nav, profileTo, outletContext, helpAction = null, onboarding = null }) {
  const [open, setOpen] = useState(false)
  const [badges, setBadges] = useState({})
  
  useEffect(() => {
    let on = true
    const fetchBadges = () => {
      if (document.hidden) return
      Promise.all([api.navBadges(), api.notifications()]).then(([badgeResponse, notificationResponse]) => {
        if (on && badgeResponse.badges) {
          setBadges({ ...badgeResponse.badges, ...(notificationResponse.unreadByNav || {}) })
        }
      }).catch(() => {})
    }

    fetchBadges()
    const int = setInterval(fetchBadges, 30000)
    window.addEventListener('focus', fetchBadges)

    return () => {
      on = false
      clearInterval(int)
      window.removeEventListener('focus', fetchBadges)
    }
  }, [])

  useEffect(() => {
    const handleUpdate = () => {
      Promise.all([api.navBadges(), api.notifications()]).then(([badgeResponse, notificationResponse]) => {
        if (badgeResponse.badges) {
          setBadges({ ...badgeResponse.badges, ...(notificationResponse.unreadByNav || {}) })
        }
      }).catch(() => {})
    }
    window.addEventListener('cymon-badge-update', handleUpdate)
    window.addEventListener('cymon:notification-update', handleUpdate)
    return () => {
      window.removeEventListener('cymon-badge-update', handleUpdate)
      window.removeEventListener('cymon:notification-update', handleUpdate)
    }
  }, [])

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cymon.sidebarCollapsed') === '1'
    } catch {
      return false
    }
  })
  const close = () => setOpen(false)
  // Top feather shows only while the nav is actually scrolled (items
  // clipped under the top edge). No scroll = no fade bar.
  const navRef = useRef(null)
  const [navScrolled, setNavScrolled] = useState(false)
  useEffect(() => {
    const el = navRef.current
    if (!el) return undefined
    const onScroll = () => setNavScrolled(el.scrollTop > 4)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem('cymon.sidebarCollapsed', next ? '1' : '0')
      } catch {
        // ignore storage errors (private mode)
      }
      return next
    })

  const { profile } = useAuth()
  // Sidebar short name ("Jinky C. Malabanan"). Built from name parts so the
  // middle initial is exact and compound surnames ("Dela Cruz") stay intact —
  // splitting the display string would mangle those into "D. Cruz". Falls
  // back to string-splitting when parts are absent (legacy session payload).
  const sidebarName = profile?.first_name || profile?.last_name
    ? [
        capitalizeName(profile.first_name),
        profile.middle_name
          ? `${capitalizeName(profile.middle_name).trim().charAt(0).toUpperCase()}.`
          : null,
        capitalizeName(profile.last_name),
      ].filter(Boolean).join(' ')
    : shortDisplayName(user.name)
  const navigate = useNavigate()
  const location = useLocation()
  const [roleOpen, setRoleOpen] = useState(false)
  const [activeRoleKey, setActiveRoleKey] = useState(() => {
    try {
      return localStorage.getItem('cymon.activeRole') || ''
    } catch {
      return ''
    }
  })
  // Modal-style role switch in two slow beats so multi-role staff can SEE
  // the change happen: "Switching to…" here, then "Now you are in…" with a
  // countdown bar in the new layout (total ≈ 5s). Clicking the overlay or
  // Continue skips ahead.
  const [roleSwitch, setRoleSwitch] = useState(null)
  const roleTimers = useRef([])
  useEffect(() => () => {
    roleTimers.current.forEach((t) => clearTimeout(t))
  }, [])
  const dismissRoleSwitch = () => {
    roleTimers.current.forEach((t) => clearTimeout(t))
    roleTimers.current = []
    setRoleSwitch(null)
  }
  // Branch switch, requested by BranchSwitcher through context (direct call,
  // never a window event, so the request cannot get lost). Cancelling
  // mid-switch is free: the stored branch only changes at the remount
  // beat, so there is nothing to roll back.
  const [branchNonce, setBranchNonce] = useState(0)
  const [branchSwitch, setBranchSwitch] = useState(null)
  const branchTimers = useRef([])
  useEffect(() => () => {
    branchTimers.current.forEach((t) => clearTimeout(t))
  }, [])
  const dismissBranchSwitch = () => {
    branchTimers.current.forEach((t) => clearTimeout(t))
    branchTimers.current = []
    setBranchSwitch(null)
  }
  const requestBranchSwitch = ({ label, next, arrivedSubtitle } = {}) => {
    if (!label) return
    branchTimers.current.forEach((t) => clearTimeout(t))
    branchTimers.current = []
    setBranchSwitch({ phase: 'switching', label })
    branchTimers.current.push(setTimeout(() => {
      setStoredActiveBranch(next || '')
      // Remount the workspace so every list refetches under the new
      // branch — behind the overlay, never before the arrival modal.
      setBranchNonce((n) => n + 1)
      setBranchSwitch({ phase: 'arrived', label, arrivedSubtitle })
      branchTimers.current.push(setTimeout(() => setBranchSwitch(null), BRANCH_ARRIVED_MS))
    }, BRANCH_SWITCHING_MS))
  }
  // Bell notifications switch branches without going through the switcher:
  // the target branch is already persisted, so skip the "switching" beat and
  // only remount + confirm. Same-area links fire this event; cross-area links
  // write BRANCH_ARRIVED_KEY instead and replay on mount below.
  useEffect(() => {
    const onApplied = (event) => {
      const label = event?.detail?.label
      if (!label) return
      branchTimers.current.forEach((t) => clearTimeout(t))
      branchTimers.current = []
      setBranchNonce((n) => n + 1)
      setBranchSwitch({ phase: 'arrived', label })
      branchTimers.current.push(setTimeout(() => setBranchSwitch(null), BRANCH_ARRIVED_MS))
    }
    window.addEventListener('cymon:branch-switch-applied', onApplied)
    return () => window.removeEventListener('cymon:branch-switch-applied', onApplied)
  }, [])
  // Cross-area arrival beat: the previous layout unmounted before its overlay
  // could finish, so replay "Now you are in…" here.
  useEffect(() => {
    let arrivalTimer = null
    try {
      const raw = sessionStorage.getItem(BRANCH_ARRIVED_KEY)
      if (raw) {
        sessionStorage.removeItem(BRANCH_ARRIVED_KEY)
        const { label, at } = JSON.parse(raw)
        if (label && Date.now() - Number(at || 0) < 8000) {
          setBranchSwitch({ phase: 'arrived', label })
          arrivalTimer = setTimeout(() => setBranchSwitch(null), BRANCH_ARRIVED_MS)
          branchTimers.current.push(arrivalTimer)
        }
      }
    } catch {
      // ignore storage errors (private mode)
    }
    return () => {
      if (arrivalTimer) clearTimeout(arrivalTimer)
    }
  }, [])
  // Arrival beat: after navigation remounts this layout under the new role
  // path, replay "Now you are in…" from the sessionStorage flag (fresh
  // flags only — stale ones are dropped silently).
  useEffect(() => {
    let arrivalTimer = null
    try {
      const raw = sessionStorage.getItem(ROLE_ARRIVED_KEY)
      if (raw) {
        sessionStorage.removeItem(ROLE_ARRIVED_KEY)
        const { label, at } = JSON.parse(raw)
        if (label && Date.now() - Number(at || 0) < 8000) {
          setRoleSwitch({ to: { label }, phase: 'arrived' })
          arrivalTimer = setTimeout(() => setRoleSwitch(null), ROLE_ARRIVED_MS)
          roleTimers.current.push(arrivalTimer)
        }
      }
    } catch {
      // ignore storage errors (private mode)
    }
    return () => {
      if (arrivalTimer) clearTimeout(arrivalTimer)
    }
  }, [])
  const handlePickRole = (target) => {
    if (roleSwitch) dismissRoleSwitch()
    if (target.role === activeRole?.role) {
      if (!onPath(target)) navigate(target.path)
      return
    }
    try {
      localStorage.setItem('cymon.activeRole', target.role)
    } catch {
      // ignore storage errors (private mode)
    }
    setActiveRoleKey(target.role)
    stampRoleArrival(target.label)
    setRoleSwitch({ to: target, phase: 'switching' })
    // Navigate only after the switching beat has played — navigating
    // at once would unmount this layout and kill the modal instantly.
    roleTimers.current = [
      setTimeout(() => {
        if (!onPath(target)) {
          navigate(target.path)
        } else {
          // Same section (no remount coming): play the arrival beat here.
          setRoleSwitch({ to: target, phase: 'arrived' })
          roleTimers.current.push(setTimeout(() => setRoleSwitch(null), ROLE_ARRIVED_MS))
        }
      }, ROLE_SWITCHING_MS),
    ]
  }

  const roles = roleOptions(profile)
  // Self-heal: drop a stored acting role the current account doesn't hold
  // (e.g. leftover from a previous login on a shared computer). Without this
  // the backend scopes every directory to the wrong role → empty lists that
  // only "fix" after manually switching roles.
  useEffect(() => {
    if (!profile) return
    const held = new Set([profile.role, ...(profile.extra_roles || [])].filter(Boolean))
    if (activeRoleKey && !held.has(activeRoleKey)) {
      try {
        localStorage.removeItem('cymon.activeRole')
      } catch {
        // ignore storage errors (private mode)
      }
      setActiveRoleKey('')
    }
  }, [profile, activeRoleKey])
  const onPath = (r) => location.pathname === r.path || location.pathname.startsWith(`${r.path}/`)
  const matching = roles.filter(onPath)
  const activeRole = matching.find((r) => r.role === activeRoleKey) || matching[0] || null
  const multiRole = roles.length > 1

  // License / PRC numbers are confidential and only shown in Profile settings.
  const employeeId = profile?.employee_id || ''

  const roleChip = multiRole ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setRoleOpen((o) => !o)
      }}
      aria-expanded={roleOpen}
      className={['inline-flex items-center gap-1 rounded-full px-3 py-1 mt-1 text-[10px] uppercase font-bold tracking-wider transition shadow-sm', collapsed ? 'hidden' : 'bg-[#4a237f] text-white hover:bg-[#381665]'].join(' ')}
    >
      Switch Role
      <ChevronDown className={['h-3 w-3 transition-transform', roleOpen ? 'rotate-180' : ''].join(' ')} strokeWidth={3} />
    </button>
  ) : null

  const avatar = (
    <div className={['flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg border-4 transition-all duration-300', collapsed ? 'h-14 w-14 border-[#4a237f] bg-[#4a237f]' : 'h-16 w-16 border-[#4a237f] bg-[#4a237f]'].join(' ')}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={`${user.name} profile`}
          className="h-full w-full object-cover"
        />
      ) : (
        <User className={['text-white/90', collapsed ? 'h-6 w-6' : 'h-7 w-7'].join(' ')} />
      )}
    </div>
  )

  return (
    <BranchSwitchContext.Provider value={requestBranchSwitch}>
    <SidebarContext.Provider value={{ openSidebar: () => setOpen(true), collapsed, toggleCollapsed }}>
      <div className="flex h-dvh overflow-hidden bg-[#efeaf7] dark:bg-slate-950 transition-colors duration-300">
        {open ? (
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={close} aria-hidden="true" />
        ) : null}
        <aside
          className={[
            'fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-[#4c1d95] to-[#581c87] dark:from-[#2a1065] dark:to-[#3b1a7a] transition-all duration-300 shadow-[10px_0_30px_-5px_rgba(0,0,0,0.6)] border-r border-white/10 dark:border-white/5',
            'lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
            collapsed ? 'w-24' : 'w-64',
            open ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="absolute right-3 top-3 z-50 rounded-md p-1.5 text-purple-900 hover:bg-purple-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          {/* TOP PROFILE AREA */}
          <div className="relative shrink-0 flex flex-col items-center">
            <div className={['relative flex flex-col items-center bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 transition-all duration-300 ease-in-out', collapsed ? 'w-[calc(100%-1rem)] mx-2 pb-4 pt-3 rounded-b-[2.5rem]' : 'w-[calc(100%-1rem)] mx-2 pb-3 pt-4 rounded-b-[1.5rem] shadow-sm'].join(' ')}>
              <Link to={profileTo} onClick={close} title="My Profile Settings" className="flex flex-col items-center gap-2 relative z-10 transition-transform hover:scale-105">
                <div className={['flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg border-4 transition-all duration-500 ease-in-out transform', collapsed ? 'h-11 w-11 border-[#4a237f] bg-[#4a237f] rotate-[360deg]' : 'h-14 w-14 border-[#4a237f] bg-[#4a237f] rotate-0'].join(' ')}>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${user.name} profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className={['text-white/90', collapsed ? 'h-5 w-5' : 'h-6 w-6'].join(' ')} />
                  )}
                </div>
                <div className={['flex flex-col items-center transition-all duration-300 ease-in-out overflow-hidden', collapsed ? 'max-h-0 opacity-0 mt-0 pointer-events-none' : 'max-h-48 opacity-100 mt-1.5 gap-1.5'].join(' ')}>
                  <div className="truncate px-2 text-[14px] font-bold tracking-wide text-[#311465] dark:text-purple-300 transition-colors" title={user.name}>{sidebarName}</div>
                  
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#4a237f]/80 dark:text-purple-400 bg-[#efeaf7] dark:bg-purple-900/40 px-2 py-0.5 rounded border border-[#4a237f]/10 shadow-inner transition-colors">
                    ID: {employeeId || 'Not Assigned'}
                  </div>

                  {/* Role(s) shown as styled badges — the ACTIVE role is solid,
                      inactive ones are faded, so dual-role staff can tell at a
                      glance which side they are on. */}
                  <div className="flex flex-wrap justify-center gap-1 px-2 mt-0.5">
                    {roles.map((r) => {
                      const isActiveRole = activeRole?.role === r.role
                      return (
                        <span
                          key={r.role}
                          title={isActiveRole ? 'Current role' : `Switch to ${r.label}`}
                          className={[
                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm border transition-colors',
                            isActiveRole
                              ? 'bg-[#4a237f] text-white border-[#4a237f] dark:bg-purple-500 dark:border-purple-500 dark:text-white'
                              : 'bg-purple-50 text-purple-400 border-purple-200 opacity-70 dark:bg-white/5 dark:text-purple-300/60 dark:border-white/10',
                          ].join(' ')}
                        >
                          {r.label}
                        </span>
                      )
                    })}
                  </div>
                  {roleChip}
                </div>
              </Link>
            </div>
          </div>

          {/* ROLE SWITCHER DROPDOWN — solid card (never translucent over the
              gradient) so every row stays readable in both themes. The
              grid-rows wrapper animates both open (slide down) and close
              (slide up); conditional render alone would snap instantly. */}
          {multiRole && !collapsed ? (
            <div className={`grid transition-all duration-300 ease-in-out ${roleOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="px-4 pb-2 pt-2 shrink-0">
                  <div className="space-y-1 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-white/10 shadow-lg p-1.5">
                    {roles.map((r) => {
                      const isActive = activeRole?.role === r.role
                      return (
                        <button
                          key={r.role}
                          type="button"
                          tabIndex={roleOpen ? 0 : -1}
                          onClick={() => {
                            setRoleOpen(false)
                            close()
                            handlePickRole(r)
                          }}
                          className={[
                            'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs transition-colors border',
                            isActive
                              ? 'bg-[#4a237f] border-[#4a237f] font-bold text-white shadow-sm dark:bg-purple-600 dark:border-purple-600'
                              : 'bg-purple-50 border-purple-100 text-[#4a237f] hover:bg-purple-100 dark:bg-white/5 dark:border-white/10 dark:text-purple-100 dark:hover:bg-white/10',
                          ].join(' ')}
                        >
                          {r.label}
                          {isActive ? <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] text-white uppercase font-bold tracking-wider">Current</span> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* NAV LINKS */}
          <style>{`
            .cymon-nav-group:hover > a:not(:hover) {
              transition: 300ms;
              filter: blur(1.5px);
              transform: scale(0.95);
            }
            .cymon-nav-item {
              position: relative;
              transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
              border: 2px solid transparent;
              box-sizing: border-box;
            }
            .cymon-nav-item:not(.active):hover {
              border: 2px solid rgba(255, 255, 255, 0.2);
              background-color: rgba(255, 255, 255, 0.05);
            }
            .cymon-nav-item.active,
            .cymon-nav-item:focus {
              background-color: rgba(255, 255, 255, 0.15);
              transform: translateX(var(--nav-shift));
            }
            .cymon-nav-item::before {
              content: "";
              position: absolute;
              top: 10%;
              left: -15px;
              width: 5px;
              height: 80%;
              background-color: #c084fc;
              border-radius: 5px;
              opacity: 0;
              transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .cymon-nav-item.active::before,
            .cymon-nav-item:focus::before {
              opacity: 1;
            }
            .cymon-nav-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
              /* Scrollbar on the LEFT: flip the container, restore the items. */
              direction: rtl;
            }
            .cymon-nav-scroll > * {
              direction: ltr;
            }
            .cymon-nav-scroll::-webkit-scrollbar {
              width: 4px;
            }
            .cymon-nav-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .cymon-nav-scroll::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.18);
              border-radius: 9999px;
            }
            .cymon-nav-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.32);
            }
          `}</style>
          {/* NAV LINKS — the wrapper (not the nav itself) owns the flex space so
              the fade overlay can sit absolutely over the scrollport without
              ever shifting or covering nav items. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* Feathered top edge, visible only while scrolled. Absolute +
                pointer-events-none: purely visual, never blocks taps. */}
            {navScrolled ? (
              <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[#4c1d95] to-transparent dark:from-[#2a1065] pointer-events-none" />
            ) : null}
          <nav
            ref={navRef}
            className={['min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pt-2 pb-2 cymon-nav-group cymon-nav-scroll', collapsed ? 'px-2 mt-2' : 'px-3 mt-1'].join(' ')}
            style={{ '--nav-shift': collapsed ? '0px' : '17px' }}
          >
            {nav.map((item) => {
              const badgeKey = item.key || item.to.split('/').pop()
              let count = badges[badgeKey] || 0
              
              if (badgeKey === 'announcements' && badges.announcements_ids) {
                try {
                  const readAnn = JSON.parse(localStorage.getItem('cymon.announcements.read') || '[]')
                  const localUnread = badges.announcements_ids.filter(id => !readAnn.includes(id)).length
                  // The bell tracks server-side notification reads while cards
                  // track local opens — take the higher so the badge never hides
                  // while either side still has something unseen.
                  const serverUnread = Number(badges.announcements) || 0
                  count = Math.max(localUnread, serverUnread)
                } catch {
                  // private mode — fall back to the server badge count
                }
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={close}
                  data-onboarding-key={item.key || item.label.toLowerCase().replace(/\s+/g, '-')}
                  title={item.label}
                  className={({ isActive }) =>
                    [
                      'cymon-nav-item group flex w-full items-center justify-between rounded-xl',
                      collapsed ? 'p-2.5 mx-1 justify-center' : 'px-4 py-2.5',
                      isActive 
                        ? 'active text-white shadow-inner font-bold' 
                        : 'text-purple-100/70 hover:text-white font-medium',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon className={`shrink-0 h-[18px] w-[18px] transition-all duration-300 ${collapsed ? '' : 'group-hover:scale-110'} ${isActive ? 'text-white' : 'text-purple-300/70 group-hover:text-white'}`} strokeWidth={isActive ? 2.5 : 2} />
                        <span className={['transition-all duration-300 ease-in-out', collapsed ? 'hidden opacity-0 w-0' : 'opacity-100 truncate text-[13px] tracking-wide'].join(' ')}>{item.label}</span>
                      </div>
                      {count > 0 && (
                        <span className={['transition-all duration-300 bg-rose-500 text-white font-bold rounded-full flex items-center justify-center', collapsed ? 'absolute top-1 right-1 h-3 w-3 text-[0px]' : 'h-5 min-w-[20px] px-1.5 text-[10px] ml-2'].join(' ')}>
                          {collapsed ? '' : count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
          </div>

          {/* BOTTOM LOGO AREA */}
          <div className="relative shrink-0 w-full h-28 mt-auto flex items-end">
            <div className={[
              'bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 relative z-10 transition-all duration-500 ease-in-out overflow-hidden shadow-xl border border-purple-100 dark:border-slate-800 transition-colors',
              collapsed
                ? 'w-[3.5rem] h-[5.5rem] mx-auto mb-3 rounded-full'
                : 'w-[calc(100%-1rem)] mx-2 mb-3 h-[52px] rounded-full'
            ].join(' ')}>
              {/* LOGO */}
              <div className={[
                'absolute transition-all duration-500 ease-in-out flex items-center',
                collapsed ? 'top-3 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-[60px]'
              ].join(' ')}>
                <img src="/logo-cymon.png" alt="CyMon" className={['object-contain transition-all duration-500 drop-shadow-sm', collapsed ? 'w-8' : 'w-7'].join(' ')} />
              </div>

              {/* TEXT */}
              <div className={[
                'absolute flex flex-col text-left leading-none transition-all duration-500 ease-in-out',
                collapsed ? 'top-1/2 left-1/2 -translate-x-1/2 opacity-0 scale-90 pointer-events-none' : 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-[22px] opacity-100 scale-100'
              ].join(' ')}>
                <div className="text-[14px] text-[#311465] dark:text-purple-300 font-bold tracking-wide leading-none transition-colors" style={{ fontFamily: 'Against' }}>
                  CyMon
                </div>
                <div className="text-[6.5px] tracking-[0.1em] text-[#4a237f] dark:text-purple-400 font-sans font-bold uppercase mt-1 whitespace-nowrap truncate transition-colors">
                  ClearMind Clinic
                </div>
              </div>

              {/* HELP BUTTON */}
              {helpAction ? (
                <button
                  type="button"
                  onClick={helpAction}
                  title="Help & Support"
                  className={[
                    'absolute flex items-center justify-center rounded-full text-purple-400 transition-all duration-500 ease-in-out hover:bg-purple-50 hover:text-purple-700',
                    collapsed ? 'bottom-2.5 left-1/2 -translate-x-1/2 h-7 w-7' : 'top-1/2 -translate-y-1/2 right-2 h-7 w-7'
                  ].join(' ')}
                >
                  <CircleHelp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        <div key={`${activeRole?.role || 'norole'}:${branchNonce}:${location.pathname}`} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden motion-safe:animate-page-in">
          <Outlet context={outletContext} />
        </div>
        {branchSwitch ? (
          <SwitchOverlay
            phase={branchSwitch.phase}
            switchingLabel="Switching to"
            arrivedLabel="Now you are in"
            title={branchSwitch.label}
            subtitle={branchSwitch.phase === 'arrived'
              ? (branchSwitch.arrivedSubtitle || 'All lists now show this branch.')
              : "Loading this branch's workspace…"}
            glyph={BRANCH_GLYPH}
            arrivedMs={BRANCH_ARRIVED_MS}
            onDismiss={dismissBranchSwitch}
          />
        ) : null}
        {roleSwitch?.to ? (
          <SwitchOverlay
            phase={roleSwitch.phase}
            switchingLabel="Switching to"
            arrivedLabel="Now you are in"
            title={roleSwitch.to.label}
            subtitle={roleSwitch.phase === 'arrived' ? 'Workspace updated.' : 'Loading your workspace…'}
            glyph={(roleSwitch.to.label || '?').trim().charAt(0).toUpperCase() || '?'}
            arrivedMs={ROLE_ARRIVED_MS}
            onDismiss={dismissRoleSwitch}
          />
        ) : null}
        {onboarding}
      </div>
    </SidebarContext.Provider>
    </BranchSwitchContext.Provider>
  )
}

export default StaffLayout
