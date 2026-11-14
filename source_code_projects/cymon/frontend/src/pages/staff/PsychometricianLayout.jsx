import { useState } from 'react'
import { toast } from 'react-hot-toast'
import StaffLayout from './StaffLayout'
import { useAuth } from '../../auth/useAuth'
import { api, getSessionAccessToken } from '../../lib/api'
import { ROLE_DEST } from '../../lib/roleNav'
import OnboardingTour from './admin/AdminOnboarding'
import { createOnboardingSteps } from './admin/onboardingSteps'

import { CheckSquare, FileCheck, FileSpreadsheet, BookOpenText, LineChart, BookOpen, Megaphone, Clock, Users, ClipboardList, History } from 'lucide-react'

const NAV = [
  { key: 'task-list', to: '/psychometrician', label: 'Task List', icon: CheckSquare, end: true },
  { key: 'student-roster', to: '/psychometrician/roster', label: 'Students', icon: Users },
  { key: 'intake-interview', to: '/psychometrician/intake', label: 'Intake Interview', icon: ClipboardList },
  { key: 'assessment-services', to: '/psychometrician/assessments', label: 'Assessment Services', icon: FileCheck },
  { key: 'individualized-education-plan', to: '/psychometrician/iep', label: 'IEP Workspace', icon: FileSpreadsheet },
  { key: 'daily-activity-report', to: '/psychometrician/activity', label: 'Daily Activity Report', icon: BookOpenText },
  { key: 'monthly-assessment-report', to: '/psychometrician/progress', label: 'Monthly Report', icon: LineChart },
  { key: 'attendance', to: '/psychometrician/attendance', label: 'Attendance', icon: Clock },
  { key: 'student-journal', to: '/psychometrician/student-journal', label: 'Student Journal', icon: BookOpen },
  { key: 'announcements', to: '/psychometrician/announcements', label: 'Announcements', icon: Megaphone },
  { key: 'history', to: '/psychometrician/history', label: 'Activity History', icon: History },
]

const PSYCHOMETRICIAN_DASHBOARDS = [
  {
    key: 'task-list',
    label: 'Task List',
    path: '/psychometrician',
    workspaceKey: 'psychometrician-task-workspace',
    controlKeys: ['psychometrician-task-controls'],
    detailTargetKeys: ['psychometrician-task-workspace', 'psychometrician-task-controls'],
    sidebarText: 'Task List is the psychometrician starting point. Use it to see scheduled sessions, pending assessments, and the next clinical action.',
    dashboardText: 'The Task List dashboard brings daily reminders, scheduled sessions, and pending assessments into one workspace.',
    details: [
      { label: 'Daily reminders', text: 'Review the testing, data encoding, observation, and report instructions before starting your work.' },
      { label: 'Sessions and Assessments', text: 'Switch between scheduled sessions and pending assessments, then open the relevant assessment or report workflow.' },
    ],
  },
  {
    key: 'student-roster',
    label: 'Students',
    path: '/psychometrician/roster',
    workspaceKey: 'student-roster-workspace',
    controlKeys: ['student-roster-search', 'student-roster-list'],
    detailTargetKeys: ['student-roster-search', 'student-roster-list'],
    sidebarText: 'Students opens your assigned student list. Use it to review support levels and milestone progress before starting assessments.',
    dashboardText: 'The Students page lists your assigned students with support levels and milestone progress. Viewing only — roster updates are made by the psychologist.',
    details: [
      { label: 'Find a student', text: 'Search your assigned students by name or support level.' },
      { label: 'Roster list', text: 'Each row shows the support level and progress — open a record to view details and its intake summary.' },
    ],
  },
  {
    key: 'intake-interview',
    label: 'Intake Interview',
    path: '/psychometrician/intake',
    workspaceKey: 'intake-workspace',
    controlKeys: ['intake-directory', 'intake-form'],
    detailTargetKeys: ['intake-directory', 'intake-form'],
    sidebarText: 'Intake Interview opens the shared intake record you co-fill with the psychologist, with autosave and per-field edit tracking.',
    dashboardText: 'The Intake Interview workspace pairs the student picker with the shared interview form — roster impression fields stay psychologist-only.',
    details: [
      { label: 'Student picker', text: 'Choose the student on the left to load their shared intake record.' },
      { label: 'Interview form', text: 'Fill in your sections of the record — entries autosave and every field tracks who edited it and when.' },
    ],
  },
  {
    key: 'assessment-services',
    label: 'Assessment Services',
    path: '/psychometrician/assessments',
    workspaceKey: 'psychometrician-assessments-workspace',
    controlKeys: ['psychometrician-assessments-directory', 'psychometrician-assessments-panel'],
    detailTargetKeys: ['psychometrician-assessments-directory', 'psychometrician-assessments-panel'],
    sidebarText: 'Assessment Services is where you select an assigned student and administer standardized assessment forms.',
    dashboardText: 'Select a student, choose the assigned assessment, complete the form, sign it, and submit it to the psychologist for review.',
    details: [
      { label: 'Student Directory', text: 'Search and select the student whose assigned assessment you need to administer.' },
      { label: 'Assessment workspace', text: 'Open the checklist, CAFAT, or MMSE form, complete its fields, add your signature, and send it for review.' },
    ],
  },
  {
    key: 'individualized-education-plan',
    label: 'IEP Workspace',
    path: '/psychometrician/iep',
    workspaceKey: 'psychometrician-iep-workspace',
    controlKeys: ['psychometrician-iep-directory', 'psychometrician-iep-form'],
    detailTargetKeys: ['psychometrician-iep-directory', 'psychometrician-iep-form'],
    sidebarText: 'Individualized Education Plan opens the student-specific IEP workspace for preparing and submitting weekly plans.',
    dashboardText: 'Use the IEP workspace to select a student, complete the weekly domains, and send the plan to the assigned psychologist.',
    details: [
      { label: 'Student Directory', text: 'Choose the student whose IEP you need to create, update, or review.' },
      { label: 'IEP form', text: 'Complete the plan fields for each week, check the saved status, and submit the signed IEP for psychologist review.' },
    ],
  },
  {
    key: 'daily-activity-report',
    label: 'Daily Activity Report',
    path: '/psychometrician/activity',
    workspaceKey: 'daily-activity-workspace',
    controlKeys: ['daily-activity-directory', 'daily-activity-form'],
    detailTargetKeys: ['daily-activity-directory', 'daily-activity-form'],
    sidebarText: 'Daily Activity Report opens the monthly activity record for each assigned student.',
    dashboardText: 'Select a student, complete the activity record, add your signature, and send the report to the psychologist for approval.',
    details: [
      { label: 'Student Directory', text: 'Search and select the student whose monthly activity report you need to complete.' },
      { label: 'Activity Report form', text: 'Complete the saved activity fields, review the status, and submit the signed report. Returned reports can be revised.' },
    ],
  },
  {
    key: 'monthly-assessment-report',
    label: 'Monthly Report',
    path: '/psychometrician/progress',
    workspaceKey: 'monthly-assessment-workspace',
    controlKeys: ['monthly-assessment-directory', 'monthly-assessment-form'],
    detailTargetKeys: ['monthly-assessment-directory', 'monthly-assessment-form'],
    sidebarText: 'Monthly Assessment Report opens the monthly progress report workspace for assigned students.',
    dashboardText: 'Prepare the student progress report, complete the assessment narratives and plan, sign it, and send it for psychologist validation.',
    details: [
      { label: 'Student Directory', text: 'Find the assigned student whose monthly report you need to prepare.' },
      { label: 'Monthly report form', text: 'Complete the report fields and activity plan, then submit the signed report for review. Returned reports can be edited.' },
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    path: '/psychometrician/attendance',
    workspaceKey: 'attendance-workspace',
    controlKeys: ['attendance-preview-form'],
    detailTargetKeys: ['attendance-workspace', 'attendance-workspace', 'attendance-preview-form'],
    sidebarText: 'Attendance opens the monthly student attendance workspace. Use this sidebar button to record sessions and attendance.',
    dashboardText: 'The Attendance dashboard records monthly attendance, session details, notes, and facilitator sign-off for each student.',
    details: [
      { label: 'Student Directory', text: 'Choose the student whose monthly attendance record you need to manage.' },
      { label: 'Month controls', text: 'Move between months and update the selected month\'s attendance and session details.' },
      { label: 'Preview Form', text: 'Open the official attendance document for review or printing.' },
    ],
  },
  {
    key: 'student-journal',
    label: 'Student Journal',
    path: '/psychometrician/student-journal',
    workspaceKey: 'student-journal-workspace',
    controlKeys: ['student-journal-directory', 'student-journal-logs'],
    detailTargetKeys: ['student-journal-directory', 'student-journal-logs'],
    sidebarText: 'Student Journal opens caregiver-submitted daily observations for the students you handle.',
    dashboardText: 'Select a student to review journal history, inspect entries, manage journal access, and export a report when needed.',
    details: [
      { label: 'Student Directory', text: 'Select the student whose journal history and access setting you need to review.' },
      { label: 'Journal history', text: 'Search and open caregiver entries, inspect the daily observations, and manage whether the student can submit journals.' },
    ],
  },
  {
    key: 'announcements',
    label: 'Announcements',
    path: '/psychometrician/announcements',
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
    path: '/psychometrician/history',
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

const PSYCHOMETRICIAN_STEPS = createOnboardingSteps(PSYCHOMETRICIAN_DASHBOARDS, {
  welcomeTitle: 'Welcome to the Psychometrician Dashboard',
  welcomeText: 'This tour explains each psychometrician sidebar button first, then shows the workspace and form controls inside each dashboard.',
})

function PsychometricianLayout() {
  const { profile, session, reloadProfile } = useAuth()
  const roleLabel = ROLE_DEST[profile?.role]?.label || 'Psychometrician'
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
      await api.psychometrician.completeOnboarding(getSessionAccessToken(session))
      setTourRequested(false)
      setTourDismissed(true)
      await reloadProfile()
    } catch (error) {
      toast.error(error.message || 'Unable to save onboarding completion.')
    }
  }

  return (
    <StaffLayout
      user={{ name: profile?.display_name || roleLabel, id: roleLabel }}
      profileTo="/psychometrician/profile"
      nav={NAV}
      helpAction={openOnboarding}
      onboarding={(
        <OnboardingTour
          key={tourVersion}
          open={onboardingOpen}
          onComplete={completeOnboarding}
          steps={PSYCHOMETRICIAN_STEPS}
          ariaLabel="Psychometrician onboarding"
        />
      )}
    />
  )
}

export default PsychometricianLayout
