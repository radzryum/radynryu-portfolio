import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { CircleHelp, LayoutDashboard, BookOpenText, FileCheck, Megaphone, Calendar, FileSignature, History, User, X } from 'lucide-react'
import { SidebarContext } from '../../components/sidebarContext'
import { api, getSessionAccessToken } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import { toast } from 'react-hot-toast'
import OnboardingTour from '../staff/admin/AdminOnboarding'
import { CLIENT_STEPS } from './clientOnboardingSteps'

const NAV = [
  { key: 'client-home', to: '/client/home', label: 'Home & Progress', icon: LayoutDashboard },
  { key: 'client-activity', to: '/client/activity', label: 'Daily Journal', icon: BookOpenText },
  { key: 'client-assessments', to: '/client/assessments', label: 'Assessment Services', icon: FileCheck },
  { key: 'client-announcements', to: '/client/announcements', label: 'Announcements', icon: Megaphone },
  { key: 'client-appointments', to: '/client/appointments', label: 'Appointments', icon: Calendar },
  { key: 'client-waivers', to: '/client/waivers', label: 'Consents & Waivers', icon: FileSignature },
  { key: 'client-history', to: '/client/history', label: 'Activity History', icon: History },
]

function Sidebar({ open, collapsed, onNavigate, name, patientId, photoUrl, helpAction, onLogout, loading, badges = {}, clearBadge }) {
  const displayName = name || 'My Account'
  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#3b0d77] to-[#581c87] dark:from-[#2a1065] dark:to-[#3b1a7a] transition-all duration-300 border-r border-white/10 dark:border-white/5',
        'lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
        collapsed ? 'w-24' : 'w-64',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onNavigate}
        aria-label="Close menu"
        className="absolute right-3 top-3 z-50 rounded-md p-1.5 text-purple-900 hover:bg-purple-100 lg:hidden"
      >
        <X className="h-5 w-5" />
      </button>

      {/* TOP PROFILE AREA */}
      <div className="relative shrink-0 flex flex-col items-center">
        <div className={['relative flex flex-col items-center bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out', collapsed ? 'w-[calc(100%-1rem)] mx-2 pb-4 pt-3 rounded-b-[2.5rem]' : 'w-[calc(100%-1rem)] mx-2 pb-3 pt-4 rounded-b-[1.5rem] shadow-sm'].join(' ')}>
          <Link to="/client/profile" onClick={onNavigate} title={loading ? 'Loading...' : displayName} className="flex flex-col items-center gap-2 relative z-10 transition-transform hover:scale-105 w-full">
            <div className={['flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg border-4 transition-all duration-500 ease-in-out transform', collapsed ? 'h-11 w-11 border-[#4a237f] bg-[#4a237f] rotate-[360deg]' : 'h-14 w-14 border-[#4a237f] bg-[#4a237f] rotate-0'].join(' ')}>
              {loading ? (
                 <div className="h-full w-full skeleton bg-purple-400/30" />
              ) : photoUrl ? (
                <img src={photoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover animate-[cymonModalFade_0.4s_ease-out]" />
              ) : (
                <User className={['text-white/90 animate-[cymonModalFade_0.4s_ease-out]', collapsed ? 'h-5 w-5' : 'h-6 w-6'].join(' ')} />
              )}
            </div>
            <div className={['flex flex-col items-center gap-0.5 transition-all duration-300 ease-in-out overflow-hidden w-full px-2', collapsed ? 'max-h-0 opacity-0 mt-0 pointer-events-none' : 'max-h-24 opacity-100 mt-1'].join(' ')}>
              {loading ? (
                <>
                  <div className="h-4 w-24 skeleton bg-purple-300/40 rounded-md mt-0.5" />
                  <div className="h-5 w-20 skeleton bg-purple-400/30 rounded-full mt-1.5" />
                </>
              ) : (
                <div className="flex flex-col items-center animate-[cymonModalFade_0.4s_ease-out]">
                  <div className="truncate px-2 text-[14px] font-bold tracking-wide text-[#311465] dark:text-purple-300 max-w-full transition-colors">{displayName}</div>
                  <span className="mt-0.5 text-[11px] font-semibold tracking-wide text-[#4a237f] dark:text-purple-400 transition-colors">Student</span>
                  {patientId ? (
                    <span className="inline-flex items-center rounded-full px-4 py-1 text-[11px] font-bold tracking-wide shadow-md bg-[#4a237f] text-white mt-1">
                      {patientId}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>

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
      `}</style>
      <nav 
        className={['flex-1 space-y-1 overflow-y-auto overflow-x-hidden pt-2 pb-2 cymon-nav-group', collapsed ? 'px-2 mt-2' : 'px-3 mt-1'].join(' ')}
        style={{ '--nav-shift': collapsed ? '0px' : '17px' }}
      >
        {NAV.map((item) => {
          const badgeKey = item.to.split('/').pop()
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
              onClick={onNavigate}
              title={item.label}
              data-onboarding-key={item.key}
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

      {/* BOTTOM LOGO AREA */}
      <div className="relative shrink-0 w-full h-28 mt-auto flex items-end">
        <div className={[
          'bg-white dark:bg-slate-900 relative z-10 transition-all duration-500 ease-in-out overflow-hidden shadow-xl border border-purple-100 dark:border-slate-800',
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
  )
}

function ClientLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, session, reloadProfile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [child, setChild] = useState({ name: '', patientId: '', photoUrl: '' })
  const [loading, setLoading] = useState(true)
  const [badges, setBadges] = useState({})
  
  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }
  const [tourRequested, setTourRequested] = useState(false)
  const [tourDismissed, setTourDismissed] = useState(false)
  const [tourVersion, setTourVersion] = useState(0)
  const [activeStepKey, setActiveStepKey] = useState(null)
  const [retargetSignal, setRetargetSignal] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(min-width: 1024px)').matches === false)

  useEffect(() => {
    let on = true
    api.client
      .getPatient()
      .then((d) => {
        if (on) {
          setChild({
            name: d.patient.full_name,
            patientId: d.patient.patient_id,
            photoUrl: d.patient.photo_url || '',
          })
          setLoading(false)
        }
      })
      .catch(() => {
        if (on) setLoading(false)
      })
      
    const fetchBadges = () => {
      Promise.all([api.navBadges(), api.notifications()]).then(([badgeResponse, notificationResponse]) => {
        if (on && badgeResponse.badges) {
          setBadges({ ...badgeResponse.badges, ...(notificationResponse.unreadByNav || {}) })
        }
      }).catch(() => {})
    }
    
    fetchBadges()
    const int = setInterval(fetchBadges, 30000)
    
    return () => {
      on = false
      clearInterval(int)
    }
  }, [api])

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

  const onboardingOpen = Boolean(
    profile && ((!profile.onboarding_completed_at && !tourDismissed) || tourRequested),
  )
  const openOnboarding = () => {
    setTourVersion((current) => current + 1)
    setTourRequested(true)
  }
  const completeOnboarding = async () => {
    try {
      await api.client.completeOnboarding(getSessionAccessToken(session))
      setTourRequested(false)
      setTourDismissed(true)
      await reloadProfile()
    } catch (error) {
      toast.error(error.message || 'Unable to save onboarding completion.')
    }
  }
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cymon.sidebarCollapsed') === '1'
    } catch {
      return false
    }
  })
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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handle = (e) => setIsMobile(!e.matches)
    mq.addEventListener('change', handle)
    handle(mq)
    return () => mq.removeEventListener('change', handle)
  }, [])

  const sidebarStep = onboardingOpen && activeStepKey && activeStepKey.key?.endsWith('-sidebar')

  useEffect(() => {
    if (!onboardingOpen) {
      setOpen(false)
      return
    }
    if (sidebarStep && isMobile) {
      setOpen(true)
    } else {
      setOpen(false)
    }
    setRetargetSignal((current) => current + 1)
  }, [sidebarStep, isMobile, onboardingOpen])

  return (
    <SidebarContext.Provider value={{ openSidebar: () => setOpen(true), collapsed, toggleCollapsed }}>
      <div className="flex h-dvh bg-[#efeaf7] dark:bg-slate-950 transition-colors duration-300">
        {open ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        ) : null}
        <Sidebar
          open={open}
          collapsed={collapsed}
          onNavigate={() => setOpen(false)}
          name={child.name}
          patientId={child.patientId}
          photoUrl={child.photoUrl}
          helpAction={openOnboarding}
          onLogout={handleLogout}
          loading={loading}
          badges={badges}
        />
        <div key={location.pathname} className="flex min-w-0 flex-1 flex-col overflow-hidden motion-safe:animate-page-in">
          <Outlet />
        </div>
      </div>
      <OnboardingTour
        key={tourVersion}
        open={onboardingOpen}
        onComplete={completeOnboarding}
        steps={CLIENT_STEPS}
        ariaLabel="Client portal onboarding"
        onStepChange={setActiveStepKey}
        retargetSignal={retargetSignal}
      />
    </SidebarContext.Provider>
  )
}

export default ClientLayout
