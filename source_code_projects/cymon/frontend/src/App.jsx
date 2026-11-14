import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import RequireAuth from './auth/RequireAuth'
import LoadingScreen from './components/ui/LoadingScreen'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { lazyWithRetry, clearChunkRetry } from './lib/lazyWithRetry'

// Route-level code splitting: every page loads in its own chunk so a visit
// to one route (e.g. psychologist/approvals) never downloads + parses the
// other 40+ pages. This is the main LCP/TBT lever on every dashboard.
// lazyWithRetry reloads once when a deploy renames chunks under a cached
// index.html (stale chunk 404) instead of white-screening.
const lazyPage = (importFn) => lazy(lazyWithRetry(importFn))
const Landing = lazyPage(() => import('./pages/Landing'))
const Login = lazyPage(() => import('./pages/Login'))
const Apply = lazyPage(() => import('./pages/Apply'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'))
const NotFound = lazyPage(() => import('./pages/NotFound'))
const ClientLayout = lazyPage(() => import('./pages/client/ClientLayout'))
const HomeProgress = lazyPage(() => import('./pages/client/HomeProgress'))
const DailyActivity = lazyPage(() => import('./pages/client/DailyActivity'))
const MyProfile = lazyPage(() => import('./pages/client/MyProfile'))
const AssessmentServices = lazyPage(() => import('./pages/client/AssessmentServices'))
const AssessmentFormPage = lazyPage(() => import('./pages/client/AssessmentFormPage'))
const Announcement = lazyPage(() => import('./pages/client/Announcement'))
const Appointments = lazyPage(() => import('./pages/client/Appointments'))
const Waivers = lazyPage(() => import('./pages/client/Waivers'))
const WaiverDetail = lazyPage(() => import('./pages/client/WaiverDetail'))
const MyActivityHistory = lazyPage(() => import('./pages/MyActivityHistory'))

const PsychologistLayout = lazyPage(() => import('./pages/staff/PsychologistLayout'))
const PsychologistTasks = lazyPage(() => import('./pages/staff/psychologist/Tasks'))
const PsychologistRoster = lazyPage(() => import('./pages/staff/psychologist/RosterOverview'))
const IntakeInterview = lazyPage(() => import('./pages/staff/psychologist/IntakeInterview'))
const Approvals = lazyPage(() => import('./pages/staff/psychologist/Approvals'))
const Progress = lazyPage(() => import('./pages/staff/psychologist/Progress'))
const IepSped = lazyPage(() => import('./pages/staff/psychometrician/IepSped'))

const AdminLayout = lazyPage(() => import('./pages/staff/AdminLayout'))
const AdminOverview = lazyPage(() => import('./pages/staff/admin/Overview'))
const AdminPatients = lazyPage(() => import('./pages/staff/admin/Patients'))
const AdminCompliance = lazyPage(() => import('./pages/staff/admin/Compliance'))
const AdminSchedule = lazyPage(() => import('./pages/staff/admin/Schedule'))
const AdminScoring = lazyPage(() => import('./pages/staff/admin/ScoringAnalytics'))
const AdminClinicalRecords = lazyPage(() => import('./pages/staff/admin/ClinicalRecords'))
const AdminAnnouncements = lazyPage(() => import('./pages/staff/admin/Announcements'))
const AdminEmployees = lazyPage(() => import('./pages/staff/admin/Employees'))
const AdminAuditTrail = lazyPage(() => import('./pages/staff/admin/AuditTrail'))
const AdminApplications = lazyPage(() => import('./pages/staff/admin/Applications'))
const AdminDataExport = lazyPage(() => import('./pages/staff/admin/DataExport'))
const AdminAttendance = lazyPage(() => import('./pages/staff/admin/AttendanceDashboard'))
const AdminLandingEditor = lazyPage(() => import('./pages/staff/admin/LandingEditor'))
const LandingPreviewPage = lazyPage(() => import('./pages/staff/admin/LandingPreviewPage'))
const PsychometricianLayout = lazyPage(() => import('./pages/staff/PsychometricianLayout'))
const Tasks = lazyPage(() => import('./pages/staff/psychometrician/Tasks'))
const PmAssessments = lazyPage(() => import('./pages/staff/psychometrician/Assessments'))
const PmRoster = lazyPage(() => import('./pages/staff/psychometrician/RosterView'))
const DataReview = lazyPage(() => import('./pages/staff/psychometrician/DataReview'))
const PmActivityLog = lazyPage(() => import('./pages/staff/psychometrician/ActivityLog'))
const PmIntakeInterview = lazyPage(() => import('./pages/staff/psychometrician/IntakeInterview'))
const DraftingReports = lazyPage(() => import('./pages/staff/psychometrician/DraftingReports'))
const StudentJournal = lazyPage(() => import('./pages/staff/StudentJournal'))
const StaffProfile = lazyPage(() => import('./pages/staff/MyProfile'))

function App() {
  useEffect(() => {
    // A fresh page load means chunks resolved — clear the single-retry
    // flag so the next deploy's stale chunk gets its one free reload.
    clearChunkRetry()
    const hash = window.location.hash
    if (hash && hash.includes('type=recovery') && hash.includes('access_token=')) {
      window.location.href = `/reset-password${hash}`
    }
  }, [])

  return (
    <>
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#334155',
            fontWeight: '600',
            fontSize: '14px',
            boxShadow: '0 10px 25px -5px rgba(109, 40, 217, 0.15), 0 8px 10px -6px rgba(109, 40, 217, 0.1)',
            borderRadius: '9999px',
            padding: '12px 24px',
            border: '1px solid #f3e8ff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            // Long validation messages (e.g. the admission missing-fields
            // list) get a wide rounded box instead of the squeezed pill.
            duration: 6000,
            style: {
              borderRadius: '16px',
              maxWidth: 'min(640px, calc(100vw - 2rem))',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }} 
      />
      <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<LoadingScreen label="Loading page…" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/apply/:clinicCode?" element={<Apply />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin/landing/preview" element={<LandingPreviewPage />} />

        <Route
          path="/client"
          element={
            <RequireAuth roles={['client']}>
              <ClientLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomeProgress />} />
          <Route path="activity" element={<DailyActivity />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="assessments" element={<AssessmentServices />} />
          <Route path="assessments/:id" element={<AssessmentFormPage />} />
          <Route path="announcements" element={<Announcement />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="waivers" element={<Waivers />} />
          <Route path="waivers/:id" element={<WaiverDetail />} />
          <Route path="history" element={<MyActivityHistory />} />
        </Route>

        <Route
          path="/psychologist"
          element={
            <RequireAuth roles={['psychologist']}>
              <PsychologistLayout />
            </RequireAuth>
          }
        >
          <Route index element={<PsychologistTasks />} />
          <Route path="tasks" element={<PsychologistTasks />} />
          <Route path="students" element={<PsychologistRoster />} />
          <Route path="intake" element={<IntakeInterview />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="data-review" element={<DataReview />} />
          <Route path="activity" element={<PmActivityLog />} />
          <Route path="student-journal" element={<StudentJournal />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="announcements" element={<Announcement />} />
          <Route path="progress" element={<Progress />} />
          <Route path="reports" element={<DraftingReports />} />
          <Route path="history" element={<MyActivityHistory />} />
        </Route>

        <Route
          path="/psychometrician"
          element={
            <RequireAuth roles={['psychometrician']}>
              <PsychometricianLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Tasks />} />
          <Route path="roster" element={<PmRoster />} />
          <Route path="intake" element={<PmIntakeInterview />} />
          <Route path="assessments" element={<PmAssessments />} />
          <Route path="data-review" element={<DataReview />} />
          <Route path="activity" element={<PmActivityLog />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="iep" element={<IepSped />} />
          <Route path="student-journal" element={<StudentJournal />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="announcements" element={<Announcement />} />
          <Route path="progress" element={<Progress />} />
          <Route path="reports" element={<DraftingReports />} />
          <Route path="history" element={<MyActivityHistory />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth roles={['admin', 'super_admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="patients" element={<AdminPatients />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="compliance" element={<AdminCompliance />} />
          <Route path="schedule" element={<AdminSchedule />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="landing" element={<AdminLandingEditor />} />
          <Route path="scoring" element={<AdminScoring />} />
          <Route path="assessments" element={<Navigate to="/admin/schedule" replace />} />
          <Route path="activity" element={<PmActivityLog />} />
          <Route path="student-journal" element={<StudentJournal />} />
          <Route path="profile" element={<StaffProfile />} />
          <Route path="progress" element={<Progress />} />
          <Route path="reports" element={<DraftingReports />} />
          <Route path="records" element={<AdminClinicalRecords />} />
          <Route path="document-releases" element={<Navigate to="/admin/records" replace />} />
          <Route path="document releases" element={<Navigate to="/admin/records" replace />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="exports" element={<AdminDataExport />} />
          <Route path="audit" element={<AdminAuditTrail />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      </BrowserRouter>
    </>
  )
}

export default App
