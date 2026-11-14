import { useState } from 'react'
import { toast } from 'react-hot-toast'
import StaffLayout from './StaffLayout'
import { useAuth } from '../../auth/useAuth'
import { api, getSessionAccessToken } from '../../lib/api'
import OnboardingTour from './admin/AdminOnboarding'
import { createOnboardingSteps } from './admin/onboardingSteps'

import { CheckSquare, BookOpenText, LineChart, BookOpen, Megaphone, LayoutDashboard, Users, ClipboardList, History } from 'lucide-react'

const NAV = [
  { key: 'tasks', to: '/psychologist/tasks', label: 'Tasks', icon: LayoutDashboard },
  { key: 'students', to: '/psychologist/students', label: 'Students', icon: Users },
  { key: 'intake', to: '/psychologist/intake', label: 'Intake Interview', icon: ClipboardList },
  { key: 'approvals', to: '/psychologist/approvals', label: 'Approvals', icon: CheckSquare },
  { key: 'daily-activity-report', to: '/psychologist/activity', label: 'Daily Activity Report', icon: BookOpenText },
  { key: 'monthly-assessment-report', to: '/psychologist/progress', label: 'Monthly Report', icon: LineChart },
  { key: 'student-journal', to: '/psychologist/student-journal', label: 'Student Journal', icon: BookOpen },
  { key: 'announcements', to: '/psychologist/announcements', label: 'Announcements', icon: Megaphone },
  { key: 'history', to: '/psychologist/history', label: 'Activity History', icon: History },
]

const PSYCHOLOGIST_DASHBOARDS = [
  {
    key: 'tasks',
    label: 'Tasks',
    path: '/psychologist/tasks',
    workspaceKey: 'psychologist-tasks-workspace',
    controlKeys: ['psychologist-tasks-queue', 'psychologist-tasks-actions'],
    detailTargetKeys: ['psychologist-tasks-queue', 'psychologist-tasks-actions'],
    sidebarText: 'Tasks is your daily dashboard where you can see your upcoming sessions and any pending reports or submissions awaiting your review.',
    dashboardText: 'The Tasks dashboard shows your schedule and pending review queue, with quick actions to access other parts of your workspace.',
    details: [
      { label: 'Today\'s Queue', text: 'View your scheduled sessions and any assessment reports or submissions that need your attention.' },
      { label: 'Quick Actions', text: 'Use the side panel to quickly jump to Approvals, Daily Activity Reports, or Monthly Reports.' },
    ],
  },
  {
    key: 'students',
    label: 'Students',
    path: '/psychologist/students',
    workspaceKey: 'students-workspace',
    controlKeys: ['students-search', 'students-roster'],
    detailTargetKeys: ['students-search', 'students-roster'],
    sidebarText: 'Students opens your assigned student roster. Use this sidebar button to review support levels and milestone progress.',
    dashboardText: 'The Students roster lists your assigned students with their current support level and milestone completion.',
    details: [
      { label: 'Find a student', text: 'Search your assigned students by name or support level.' },
      { label: 'Support levels & progress', text: 'Each row shows the support level (HSN, MSN, or LSN) and milestone progress — open a record to view details or update the roster.' },
    ],
  },
  {
    key: 'intake',
    label: 'Intake Interview',
    path: '/psychologist/intake',
    workspaceKey: 'intake-workspace',
    controlKeys: ['intake-directory', 'intake-form'],
    detailTargetKeys: ['intake-directory', 'intake-form'],
    sidebarText: 'Intake Interview opens the first assessment before treatment. Use this sidebar button to record concerns, background, and initial observations.',
    dashboardText: 'The Intake Interview workspace pairs the student picker with the interview form and its per-field edit history.',
    details: [
      { label: 'Student picker', text: 'Choose the student on the left to load or start their intake interview.' },
      { label: 'Interview form', text: 'Record the chief complaint, background, and initial observations — every field tracks who edited it and when.' },
    ],
  },
  {
    key: 'approvals',
    label: 'Approvals',
    path: '/psychologist/approvals',
    workspaceKey: 'psychologist-approvals-workspace',
    controlKeys: ['psychologist-approvals-directory', 'psychologist-approvals-panel'],
    detailTargetKeys: ['psychologist-approvals-directory', 'psychologist-approvals-panel'],
    sidebarText: 'Approvals is where you review submitted clinical forms and decide whether they are ready to approve or need revision.',
    dashboardText: 'The Approvals dashboard combines the student directory with the selected student\'s submitted reports and review workspace.',
    details: [
      { label: 'Student Directory', text: 'Select a student to load the forms and reports submitted by the assigned psychometrician.' },
      { label: 'Review workspace', text: 'Open a report to inspect its saved answers, signatures, and comments, then approve or return it for revision.' },
    ],
  },
  {
    key: 'daily-activity-report',
    label: 'Daily Activity Report',
    path: '/psychologist/activity',
    workspaceKey: 'daily-activity-workspace',
    controlKeys: ['daily-activity-directory', 'daily-activity-form'],
    detailTargetKeys: ['daily-activity-directory', 'daily-activity-form'],
    sidebarText: 'Daily Activity Report opens monthly activity records submitted by psychometricians for psychologist review.',
    dashboardText: 'Use this workspace to select a student, inspect the saved activity report, and approve or return the record.',
    details: [
      { label: 'Student Directory', text: 'Search and select a student to load the student\'s current activity report and review status.' },
      { label: 'Activity Report form', text: 'Review the saved report fields and signature, then use the review controls when the report is ready for a decision.' },
    ],
  },
  {
    key: 'monthly-assessment-report',
    label: 'Monthly Report',
    path: '/psychologist/progress',
    workspaceKey: 'monthly-assessment-workspace',
    controlKeys: ['monthly-assessment-directory', 'monthly-assessment-form'],
    detailTargetKeys: ['monthly-assessment-directory', 'monthly-assessment-form'],
    sidebarText: 'Monthly Assessment Report opens monthly progress reports submitted by psychometricians for validation.',
    dashboardText: 'Select a student to review the saved monthly report, its status, and its prepared signature before approving or returning it.',
    details: [
      { label: 'Student Directory', text: 'Find the student whose monthly assessment report you need to review.' },
      { label: 'Monthly report form', text: 'Read the submitted assessment details and use the review section to approve or request revisions.' },
    ],
  },
  {
    key: 'student-journal',
    label: 'Student Journal',
    path: '/psychologist/student-journal',
    workspaceKey: 'student-journal-workspace',
    controlKeys: ['student-journal-directory', 'student-journal-logs'],
    detailTargetKeys: ['student-journal-directory', 'student-journal-logs'],
    sidebarText: 'Student Journal opens caregiver-submitted observations and daily entries for clinical review.',
    dashboardText: 'The Student Journal dashboard lets you select a student, inspect journal history, and review the details of each entry.',
    details: [
      { label: 'Student Directory', text: 'Select a student to load that student\'s journal entries and access state.' },
      { label: 'Journal history', text: 'Search the student\'s entries and open a journal record to inspect its observations and daily indicators.' },
    ],
  },
  {
    key: 'announcements',
    label: 'Announcements',
    path: '/psychologist/announcements',
    workspaceKey: 'client-announcements-workspace',
    controlKeys: ['client-announcements-list'],
    detailTargetKeys: ['client-announcements-list'],
    sidebarText: 'Announcements opens clinic notices. Use this sidebar button to stay updated on reminders and events from the admin office.',
    dashboardText: 'The Announcements page shows the latest clinic bulletin so you can read new notices and browse older ones.',
    details: [
      { label: 'Clinic bulletin', text: 'Read recent announcements and scroll through older notices here.' },
    ],
  },
  {
    key: 'history',
    label: 'Activity History',
    path: '/psychologist/history',
    workspaceKey: 'history-workspace',
    controlKeys: ['history-list'],
    detailTargetKeys: ['history-list'],
    sidebarText: 'Activity History opens your own account log. Use this sidebar button to review everything you did in the system.',
    dashboardText: 'The Activity History page lists what you did in the last 30 days — sign-ins with device and location, plus a search box to find entries.',
    details: [
      { label: 'My activity list', text: 'Each row shows when it happened, what was done, and on which device. Use the search box to filter by action or keyword.' },
    ],
  },
]

const PSYCHOLOGIST_STEPS = createOnboardingSteps(PSYCHOLOGIST_DASHBOARDS, {
  welcomeTitle: 'Welcome to the Psychologist Dashboard',
  welcomeText: 'This tour explains each psychologist sidebar button first, then shows the workspace and review controls inside each dashboard.',
})

function PsychologistLayout() {
  const { profile, session, reloadProfile } = useAuth()
  const [tourRequested, setTourRequested] = useState(false)
  const [tourDismissed, setTourDismissed] = useState(false)
  const [tourVersion, setTourVersion] = useState(0)
  const onboardingOpen = Boolean(
    profile && ((!profile.onboarding_completed_at && !tourDismissed) || tourRequested),
  )

  const openOnboarding = () => {
    setTourVersion((current) => current + 1)
    setTourRequested(true)
  }

  const completeOnboarding = async () => {
    try {
      await api.psychologist.completeOnboarding(getSessionAccessToken(session))
      setTourRequested(false)
      setTourDismissed(true)
      await reloadProfile()
    } catch (error) {
      toast.error(error.message || 'Unable to save onboarding completion.')
    }
  }

  return (
    <StaffLayout
      user={{ name: profile?.display_name || 'Psychologist', id: 'Psychologist' }}
      profileTo="/psychologist/profile"
      nav={NAV}
      helpAction={openOnboarding}
      onboarding={(
        <OnboardingTour
          key={tourVersion}
          open={onboardingOpen}
          onComplete={completeOnboarding}
          steps={PSYCHOLOGIST_STEPS}
          ariaLabel="Psychologist onboarding"
        />
      )}
    />
  )
}

export default PsychologistLayout
