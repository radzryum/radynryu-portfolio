import { useState } from 'react'
import StaffLayout from './StaffLayout'
import { useAuth } from '../../auth/useAuth'
import { api, getSessionAccessToken } from '../../lib/api'
import AdminOnboarding from './admin/AdminOnboarding'
import { toast } from 'react-hot-toast'

import { LayoutDashboard, Users, Briefcase, ShieldCheck, Monitor, Clock, FileText, Megaphone, History, Globe, Inbox, DatabaseBackup } from 'lucide-react'

const NAV = [
  { key: 'overview', to: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'patients', to: '/admin/patients', label: 'Students', icon: Users },
  { key: 'applications', to: '/admin/applications', label: 'Applications', icon: Inbox },
  { key: 'employees', to: '/admin/employees', label: 'Employees', icon: Briefcase },
  { key: 'compliance', to: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'schedule', to: '/admin/schedule', label: 'Front Desk', icon: Monitor },
  { key: 'attendance', to: '/admin/attendance', label: 'Attendance', icon: Clock },
  { key: 'records', to: '/admin/records', label: 'Clinical Records', icon: FileText },
  { key: 'exports', to: '/admin/exports', label: 'Data Export', icon: DatabaseBackup },
  { key: 'landing', to: '/admin/landing', label: 'Content Manager', icon: Globe },
  { key: 'announcements', to: '/admin/announcements', label: 'Announcement', icon: Megaphone },
  { key: 'audit', to: '/admin/audit', label: 'Audit Trail', icon: History },
]

function AdminLayout() {
  const { profile, session, reloadProfile } = useAuth()
  const [tourRequested, setTourRequested] = useState(false)
  const [tourDismissed, setTourDismissed] = useState(false)
  const [tourVersion, setTourVersion] = useState(0)
  const onboardingOpen = Boolean(profile && (!profile.onboarding_completed_at && !tourDismissed || tourRequested))

  const openOnboarding = () => {
    setTourVersion((current) => current + 1)
    setTourRequested(true)
  }

  const completeOnboarding = async () => {
    try {
      await api.admin.completeOnboarding(getSessionAccessToken(session))
      setTourRequested(false)
      setTourDismissed(true)
      await reloadProfile()
    } catch (error) {
      toast.error(error.message || 'Unable to save onboarding completion.')
    }
  }

  return (
    <StaffLayout
      user={{ name: profile?.display_name || 'Administrator', id: 'Administrator' }}
      profileTo="/admin/profile"
      nav={NAV}
      helpAction={openOnboarding}
      onboarding={<AdminOnboarding key={tourVersion} open={onboardingOpen} onComplete={completeOnboarding} />}
    />
  )
}

export default AdminLayout
