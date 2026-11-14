import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSidebar } from '../../components/sidebarContext'
import TodayDate from '../../components/ui/TodayDate'
import BranchSwitcher from '../../components/ui/BranchSwitcher'
import NotificationsDropdown from '../../components/ui/NotificationsDropdown'
import ThemeToggle from '../../components/ui/ThemeToggle'

const Icon = ({ d, className = '' }) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function StaffHeader({ title }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { openSidebar, collapsed, toggleCollapsed } = useSidebar()

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [closing, setClosing] = useState(false)

  const logoutRef = useRef(null)
  const closeTimer = useRef(null)

  // Animated exit: fade/zoom out first, unmount after.
  const closeDialog = useCallback(() => {
    setClosing((c) => {
      if (c) return c
      closeTimer.current = setTimeout(() => {
        setShowLogoutConfirm(false)
        setClosing(false)
      }, 200)
      return true
    })
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (logoutRef.current && !logoutRef.current.contains(event.target)) {
        closeDialog()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [closeDialog])

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
      <header className="flex items-center justify-between border-b border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors dark:bg-slate-900 px-4 py-3 sm:px-6 relative transition-colors duration-300">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Open menu"
            className="rounded-md p-2 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors lg:hidden"
          >
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="hidden shrink-0 rounded-md p-2 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors lg:inline-flex"
          >
            <Icon d="M4 5h16v14H4zM9 5v14" />
          </button>
          <div>
            <div className="text-lg font-semibold text-purple-800 dark:text-purple-300 transition-colors dark:text-purple-400 leading-tight transition-colors">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-purple-700 dark:text-purple-300 relative z-50 transition-colors">
          <TodayDate />

          <BranchSwitcher />
          <ThemeToggle />
          <NotificationsDropdown />

          {/* Logout Confirmation Dropdown */}
          <div className="relative" ref={logoutRef}>
            <button
              className="rounded-md h-7 w-7 flex items-center justify-center hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Log out"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <Icon d="M14 4h5v16h-5M14 12H4M8 8l-4 4 4 4" />
            </button>
            {showLogoutConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div 
                  className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm ${closing ? 'animate-[cymonModalFadeOut_0.2s_ease-in_forwards]' : 'animate-modal-fade'}`}
                  onClick={closeDialog}
                />
                <div className={`relative w-full max-w-sm rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors dark:bg-slate-800 p-6 shadow-2xl text-center transition-colors ${closing ? 'animate-[cymonModalZoomOut_0.2s_ease-in_forwards]' : 'animate-modal-zoom'}`}>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors dark:text-slate-100 mb-2 transition-colors">Sign out?</div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors dark:text-slate-400 mb-6 leading-relaxed transition-colors">Are you sure you want to log out of CyMon?</p>
                  <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
                    <button
                      onClick={closeDialog}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 transition-colors dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors dark:text-slate-300 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 cursor-pointer"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
  )
}

export default StaffHeader
