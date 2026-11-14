import { createOnboardingSteps } from '../staff/admin/onboardingSteps'

const CLIENT_DASHBOARDS = [
  {
    key: 'client-home',
    label: 'Home & Progress',
    path: '/client/home',
    workspaceKey: 'client-home-workspace',
    controlKeys: ['client-home-care-team', 'client-home-stats'],
    detailTargetKeys: ['client-home-care-team', 'client-home-stats'],
    sidebarText:
      'Home & Progress is your starting point. This sidebar button returns you to your child\'s care overview at any time.',
    dashboardText:
      'The Home dashboard brings your child\'s care into one place: assigned clinicians, pending assessments, daily-journal status, and this week\'s mood.',
    details: [
      { label: 'Assigned Clinical Care Team', text: 'See which psychologist and psychometrician are assigned to your child.' },
      { label: 'Quick summary', text: 'Glance at pending assessments and whether today\'s daily journal has been turned in.' },
    ],
  },
  {
    key: 'client-activity',
    label: 'Daily Journal',
    path: '/client/activity',
    workspaceKey: 'client-activity-workspace',
    controlKeys: ['client-activity-form', 'client-activity-submit'],
    detailTargetKeys: ['client-activity-form', 'client-activity-submit'],
    sidebarText:
      'Daily Journal opens the caregiver journal. This sidebar button is where your child\'s daily observations are recorded.',
    dashboardText:
      'The Daily Journal form logs mood, sleep, appetite, activities, and notes so you can share your child\'s daily state with the clinic team.',
    details: [
      { label: 'Journal form', text: 'Pick the date, choose a mood, and fill in the daily indicators and notes.' },
      { label: 'Submit Journal Entry', text: 'Save the day\'s entry. Completed entries can be updated later from here.' },
    ],
  },
  {
    key: 'client-assessments',
    label: 'Assessment Services',
    path: '/client/assessments',
    workspaceKey: 'client-assessments-workspace',
    controlKeys: ['client-assessments-list', 'client-assessments-history'],
    detailTargetKeys: ['client-assessments-list', 'client-assessments-history'],
    sidebarText:
      'Assessment Services opens your child\'s assigned assessments. This sidebar button is where you track status and request document copies.',
    dashboardText:
      'The Assessment Services page lists completed assessment documents, lets you request copies, and keeps a record of those requests.',
    details: [
      { label: 'Assessment document list', text: 'Review your child\'s assessments and select documents to request a copy.' },
      { label: 'Request history', text: 'See the status of documents you have already requested.' },
    ],
  },
  {
    key: 'client-announcements',
    label: 'Announcements',
    path: '/client/announcements',
    workspaceKey: 'client-announcements-workspace',
    controlKeys: ['client-announcements-list'],
    detailTargetKeys: ['client-announcements-list'],
    sidebarText:
      'Announcements opens clinic notices. This sidebar button is where the clinic shares reminders and updates for parents and caregivers.',
    dashboardText:
      'The Announcements page shows the latest clinic bulletin so you can read new notices and scroll or swipe through announcements.',
    details: [
      { label: 'Clinic bulletin', text: 'Read recent announcements and browse through older notices here.' },
    ],
  },
  {
    key: 'client-appointments',
    label: 'Appointments',
    path: '/client/appointments',
    workspaceKey: 'client-appointments-workspace',
    controlKeys: ['client-appointments-calendar', 'client-appointments-list'],
    detailTargetKeys: ['client-appointments-calendar', 'client-appointments-list'],
    sidebarText:
      'Appointments opens the clinic calendar. This sidebar button is where you review scheduled session dates and times.',
    dashboardText:
      'The Appointments page shows a monthly calendar with your child\'s sessions and the full schedule for a selected day.',
    details: [
      { label: 'Month calendar', text: 'See which days have sessions and move between months.' },
      { label: 'Day schedule', text: 'Review the session times, practitioners, and locations for the selected day.' },
    ],
  },
  {
    key: 'client-waivers',
    label: 'Consents & Waivers',
    path: '/client/waivers',
    workspaceKey: 'client-waivers-workspace',
    controlKeys: ['client-waivers-list'],
    detailTargetKeys: ['client-waivers-list'],
    sidebarText:
      'Consents & Waivers opens your child\'s admission and consent documents. This sidebar button is where you review and complete forms.',
    dashboardText:
      'The Consents & Waivers page lists the clinic\'s admission and consent documents with their completion status.',
    details: [
      { label: 'Waivers & Consent Forms', text: 'See each required document and its status, then open any pending form to answer or view it as a PDF.' },
    ],
  },
  {
    key: 'client-history',
    label: 'Activity History',
    path: '/client/history',
    workspaceKey: 'history-workspace',
    controlKeys: ['history-list'],
    detailTargetKeys: ['history-list'],
    sidebarText:
      'Activity History opens your own account log. This sidebar button is where you review everything you did in the system.',
    dashboardText:
      'The Activity History page lists what you did in the last 30 days — sign-ins with device and location, plus a search box to find entries.',
    details: [
      { label: 'My activity list', text: 'Each row shows when it happened, what was done, and on which device. Use the search box to filter by action or keyword.' },
    ],
  },
]

export const CLIENT_STEPS = createOnboardingSteps(CLIENT_DASHBOARDS, {
  welcomeTitle: 'Welcome to Your Client Portal',
  welcomeText:
    'This tour explains each sidebar button first, then shows what you can do inside each section of your client portal.',
})
