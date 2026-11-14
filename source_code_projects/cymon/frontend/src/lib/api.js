// Strip any trailing slash so `${BASE}/api/...` never produces `//api/...`
// (a `//` makes Vercel 308-redirect, which a CORS preflight can't follow).
const productionApiBase = 'https://cymon-fpoj.vercel.app'
const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? productionApiBase : '')).replace(/\/+$/, '')

const SESSION_KEY = 'cymon.session'
const ACTIVE_ROLE_KEY = 'cymon.activeRole'
const ACTIVE_BRANCH_KEY = 'cymon.activeBranch'

// Acting branch for multi-branch staff (one email, many branches): sent as
// x-active-branch so the backend re-scopes every listing to that branch.
// The backend ignores branches the account cannot act in. Reset on sign-in/out.
export function getStoredActiveBranch() {
  try {
    return localStorage.getItem(ACTIVE_BRANCH_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredActiveBranch(branchId) {
  try {
    if (branchId) localStorage.setItem(ACTIVE_BRANCH_KEY, branchId)
    else localStorage.removeItem(ACTIVE_BRANCH_KEY)
  } catch {
    // ignore storage errors (private mode)
  }
}

// Broadcast once per burst when the backend reports a dead session, so
// AuthProvider can auto-logout (RequireAuth then routes to /login).
// A Retry button is nonsense here — retrying without signing in just 401s
// again — so expiry always funnels to a fresh login instead.
export const SESSION_EXPIRED_EVENT = 'cymon:session-expired'
let lastExpiryBroadcastAt = 0
function isSessionExpiredFailure(status, backendMessage) {
  if (status !== 401) return false
  const backend = String(backendMessage || '').trim()
  if (!backend) return true // the api layer already reads bare 401s as expired
  return /invalid or expired token|missing bearer token|session expired/i.test(backend)
}
function broadcastSessionExpired() {
  const now = Date.now()
  if (now - lastExpiryBroadcastAt < 10000) return
  lastExpiryBroadcastAt = now
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
  } catch {
    // non-DOM context — ignore
  }
}

// Acting role sent as x-active-role so the backend scopes directories to one
// role for dual-role staff. For the single-role dashboards (/psychologist/*,
// /admin/*) the current route takes precedence over the stored value, because
// a stale stored role (e.g. tapping a notification without switching roles
// first) silently filters every listing by the wrong role — empty directories
// that only "fix themselves" after switching roles. Always reset on sign-in/out.
export function getStoredActiveRole() {
  try {
    return localStorage.getItem(ACTIVE_ROLE_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredActiveRole(role) {
  try {
    if (role) localStorage.setItem(ACTIVE_ROLE_KEY, role)
    else localStorage.removeItem(ACTIVE_ROLE_KEY)
  } catch {
    // ignore storage errors (private mode)
  }
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function getSessionAccessToken(session = getStoredSession()) {
  return (
    session?.access_token ||
    session?.accessToken ||
    session?.session?.access_token ||
    session?.data?.session?.access_token ||
    null
  )
}

function getAccessToken() {
  return getSessionAccessToken()
}

function friendlyHttpError(status, backendMessage, fallbackAction) {
  const backend = String(backendMessage || '').trim()
  // Only genuine token/session problems become the session-expired message.
  // A 401 with any other backend message (e.g. "Invalid email or password"
  // on login) must pass through untouched.
  if (/invalid or expired token|missing bearer token|session expired/i.test(backend)) {
    return 'Your session expired. Please sign in again.'
  }
  if (/invalid login credentials/i.test(backend)) {
    return 'Invalid email/ID or password. Please check your details and try again.'
  }
  // Safety net: raw database text must never reach users (e.g. enum or
  // constraint errors if an older backend message slips through).
  if (/invalid input value for enum/i.test(backend)) {
    return 'This record has an outdated status and could not be saved. Please reload the page and try again — if it keeps happening, contact support.'
  }
  if (/duplicate key value|unique constraint|already exists/i.test(backend)) {
    return 'This record already exists. Reload to see the latest data, then try again.'
  }
  if (/violates (foreign key|not-null)/i.test(backend)) {
    return 'Something went wrong while saving. Please reload and try again.'
  }
  if (backend) return backend
  if (status === 401) return 'Your session expired. Please sign in again.'
  if (status === 400) return `Invalid request. ${fallbackAction || 'Please check the form and try again.'}`
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 404) return 'Record not found. It may have been moved or deleted — reload and try again.'
  if (status === 409) return 'Conflict: this record was already saved. Reload to get the latest data.'
  if (status >= 500) {
    // A 500 with no backend message usually means the request never reached
    // the API: the backend isn't running (dev proxy ECONNREFUSED surfaces as
    // a 500 HTML page) or the host is unreachable. Say so plainly instead of
    // implying the user's work was saved somewhere.
    const isLoad = /load/i.test(fallbackAction || '')
    const keepWork = isLoad
      ? 'Nothing was lost — this page just could not load its data.'
      : 'Your work is safe on this page — nothing was submitted.'
    return `Cannot reach the server right now. ${keepWork} Check your connection (and, for local development, make sure the backend is running on :4000), then retry.`
  }
  return `Request failed (${status}). ${fallbackAction || 'Please try again.'}`
}

async function request(path, { method = 'GET', body, auth = false, accessToken: suppliedToken = null } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const accessToken = suppliedToken || getAccessToken()
    if (!accessToken) {
      broadcastSessionExpired()
      const err = new Error('Your session expired. Please sign in again.')
      err.status = 401
      err.sessionExpired = true
      throw err
    }
    headers.Authorization = `Bearer ${accessToken}`

    try {
      // The route declares the acting role for single-role dashboards: a
      // dual-role user tapping a notification lands on /psychologist/* while
      // localStorage may still say psychometrician, and that stale value
      // silently scopes every listing to the wrong role (empty directory on
      // the Approvals page, "fixed" only after manually switching roles).
      // The backend ignores roles the account doesn't hold, so sending the
      // route-implied role is safe. /psychometrician/* keeps the stored
      // value — that dashboard is shared by legacy speech/occupational roles
      // that must not be re-scoped to psychometrician.
      const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
      const routeRole = pathname.startsWith('/psychologist') ? 'psychologist'
        : pathname.startsWith('/admin') ? 'admin'
        : ''
      const activeRole = routeRole || getStoredActiveRole()
      if (activeRole) {
        headers['x-active-role'] = activeRole
      }
      const activeBranch = getStoredActiveBranch()
      if (activeBranch) {
        headers['x-active-branch'] = activeBranch
      }
    } catch {
      // ignore storage errors
    }
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Chrome surfaces CORS/preflight and offline failures as TypeError.
    const err = new Error('Network error: could not reach the server. Check your connection, then retry. Your form data is still here.')
    err.status = 0
    throw err
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON (e.g. proxy/HTML error page) — keep status for the message below.
    data = null
  }

  if (!res.ok) {
    const expired = isSessionExpiredFailure(res.status, data?.error)
    if (expired) broadcastSessionExpired()
    const message = friendlyHttpError(res.status, data?.error, `Failed to ${method === 'GET' ? 'load' : 'save'} ${path}.`)
    const err = new Error(message)
    err.status = res.status
    err.details = data
    err.sessionExpired = expired
    throw err
  }

  return data
}

async function download(path, { auth = false, method = 'GET', body } = {}) {
  const headers = {}
  if (auth) {
    const accessToken = getAccessToken()
    if (!accessToken) {
      broadcastSessionExpired()
      const err = new Error('Your session expired. Please sign in again.')
      err.status = 401
      err.sessionExpired = true
      throw err
    }
    headers.Authorization = `Bearer ${accessToken}`
    try {
      const activeBranch = getStoredActiveBranch()
      if (activeBranch) headers['x-active-branch'] = activeBranch
    } catch {
      // ignore storage errors
    }
  }
  let res
  try {
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      res = await fetch(`${BASE}${path}`, { method, headers, body: JSON.stringify(body) })
    } else {
      res = await fetch(`${BASE}${path}`, { method, headers })
    }
  } catch {
    const err = new Error('Network error: could not download the file. Check your connection, then retry.')
    err.status = 0
    throw err
  }
  if (!res.ok) {
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { /* PDF/error response may not be JSON. */ }
    const expired = isSessionExpiredFailure(res.status, data?.error)
    if (expired) broadcastSessionExpired()
    const err = new Error(friendlyHttpError(res.status, data?.error, 'Download failed.'))
    err.status = res.status
    err.sessionExpired = expired
    throw err
  }
  return res.blob()
}

export async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const api = {
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  // Best-effort sign-out beacon for the audit trail. Never throws: sign-out
  // must succeed locally even when the network is gone.
  logout: () => request('/api/auth/logout', { method: 'POST', auth: true }).catch(() => ({ ok: false })),
  me: () => request('/api/auth/me', { auth: true }),
  // Own audit-trail entries (last 30 days) for client / staff self-service.
  myActivity: () => request('/api/auth/my-activity', { auth: true }),
  // Branches the caller may act in (branch switcher; any role).
  myClinics: () => request('/api/auth/my-clinics', { auth: true }),
  staffDirectory: () => request('/api/auth/staff-directory', { auth: true }),
  updateProfile: (payload) => request('/api/auth/profile', { method: 'PUT', body: payload, auth: true }),
  changePassword: (payload) => request('/api/auth/change-password', { method: 'POST', body: payload, auth: true }),
  forgotPassword: (email) => request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyOTP: (email, otp) => request('/api/auth/verify-otp', { method: 'POST', body: { email, otp } }),
  resetPassword: (email, password) => request('/api/auth/reset-password', { method: 'POST', body: { email, password } }),
  health: () => request('/api/health'),
  publicAnnouncements: () => request('/api/auth/public-announcements'),
  publicLanding: (clinicId) => request(`/api/public/landing?clinic_id=${encodeURIComponent(clinicId || '')}`),
  applyMeta: (clinicCode) => request(`/api/public/apply/meta?clinic_code=${encodeURIComponent(clinicCode || '')}`),
  submitApplication: (payload) => request('/api/public/apply', { method: 'POST', body: payload }),
  myAnnouncements: () => request('/api/auth/my-announcements', { auth: true }),
  navBadges: () => request('/api/auth/nav-badges', { auth: true }),
  // Per-recipient notifications — same endpoint for client and staff.
  notifications: () => request('/api/notifications', { auth: true }),
  markNotificationsRead: (ids) =>
    request('/api/notifications/read', { method: 'POST', body: { ids }, auth: true }),
  client: {
    completeOnboarding: (accessToken) => request('/api/client/onboarding', { method: 'PATCH', body: { completed: true }, auth: true, accessToken }),
    getPatient: () => request('/api/client/patient', { auth: true }),
    createPatient: (payload) => request('/api/client/patient', { method: 'POST', body: payload, auth: true }),
    updatePatient: (payload) => request('/api/client/patient', { method: 'PATCH', body: payload, auth: true }),
    home: () => request('/api/client/home', { auth: true }),
    activityLogs: () => request('/api/client/activity-logs', { auth: true }),
    addActivityLog: (payload) => request('/api/client/activity-logs', { method: 'POST', body: payload, auth: true }),
    voiceUpload: (payload) => request('/api/client/voice-upload', { method: 'POST', body: payload, auth: true }),
    deleteActivityLog: (id) => request(`/api/client/activity-logs/${id}`, { method: 'DELETE', auth: true }),
    appointments: () => request('/api/client/appointments', { auth: true }),
    announcements: () => request('/api/client/announcements', { auth: true }),
    waivers: () => request('/api/client/waivers', { auth: true }),
    waiverDetails: (code) => request(`/api/client/waivers/${code}`, { auth: true }),
    downloadFormPdf: (code) => download(`/api/client/pdfs/${encodeURIComponent(code)}`, { auth: true }),
    downloadAssessmentReleaseSlip: (requestId) => download(`/api/client/assessment-document-release-requests/${encodeURIComponent(requestId)}/pdf`, { auth: true }),
    submitWaiver: (code, payload) =>
      request(`/api/client/waivers/${code}`, { method: 'POST', body: payload, auth: true }),
    assessments: () => request('/api/client/assessments', { auth: true }),
    requestAssessmentDocumentRelease: (items, paymentPreference, reason) => request('/api/client/assessments/document-release-requests', { method: 'POST', body: { items, payment_preference: paymentPreference, client_reason: reason }, auth: true }),
    requestAssessmentOnsiteView: (source_table, record_id) =>
      request('/api/client/assessments/onsite-view-requests', {
        method: 'POST',
        body: { source_table, record_id },
        auth: true,
      }),
    selectAssessmentOnsiteViewDate: (source_table, record_id, selected_date) =>
      request('/api/client/assessments/onsite-view-requests/select', {
        method: 'POST',
        body: { source_table, record_id, selected_at: selected_date },
        auth: true,
      }),
    submitAssessment: (templateId, payload) =>
      request(`/api/client/assessments/${templateId}/submit`, { method: 'POST', body: payload, auth: true }),
    assessmentSubmission: (patientId, templateId) =>
      request(
        `/api/client/assessments/submission?patient_id=${encodeURIComponent(patientId)}&template_id=${encodeURIComponent(templateId)}`,
        { auth: true },
      ),
    assessmentTemplate: (templateId) =>
      request(`/api/client/assessments/templates/${templateId}`, { auth: true }),
  },
  admin: {
    completeOnboarding: (accessToken) => request('/api/admin/onboarding', { method: 'PATCH', body: { completed: true }, auth: true, accessToken }),
    overview: (clinicId = '') =>
      request(`/api/admin/overview${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    attendanceStats: () => request('/api/admin/attendance-stats', { auth: true }),
    getAttendanceSessionForm: (patient_id, month_year) => request(`/api/admin/attendance-session-forms?patient_id=${patient_id}&month_year=${encodeURIComponent(month_year)}`, { auth: true }),
    downloadAttendancePdf: (patient_id, month_year) => download(`/api/admin/pdf/attendance-session-forms?patient_id=${encodeURIComponent(patient_id)}&month_year=${encodeURIComponent(month_year)}`, { auth: true }),
    downloadAttendanceCtcPdf: (patient_id, month_year) => download(`/api/admin/pdf/attendance-session-forms?patient_id=${encodeURIComponent(patient_id)}&month_year=${encodeURIComponent(month_year)}&ctc=true`, { auth: true }),
    saveAttendanceSessionForm: (payload) => request('/api/admin/attendance-session-forms', { method: 'POST', body: payload, auth: true }),
    deleteAttendanceSessionForm: (patient_id, month_year) =>
      request(
        `/api/admin/attendance-session-forms?patient_id=${encodeURIComponent(patient_id)}&month_year=${encodeURIComponent(month_year)}`,
        { method: 'DELETE', auth: true },
      ),
    finalizeAttendanceSessionForm: (patient_id, month_year, finalized = true) =>
      request('/api/admin/attendance-session-forms/finalize', { method: 'POST', body: { patient_id, month_year, finalized }, auth: true }),
    getPendingPatientPermissions: () => request('/api/admin/assessment-permissions/pending', { auth: true }),
    resolvePatientPermission: (id, status) => request(`/api/admin/assessment-permissions/${id}`, { method: 'PATCH', body: { status }, auth: true }),
    grantPatientPermissionDirect: (payload) => request('/api/admin/assessment-permissions/grant', { method: 'POST', body: payload, auth: true }),
    patients: (includeArchived = false, clinicId = '') => {
      const params = new URLSearchParams();
      if (includeArchived) params.set('include_archived', 'true');
      if (clinicId) params.set('clinic_id', clinicId);
      const qs = params.toString();
      return request(`/api/admin/patients${qs ? `?${qs}` : ''}`, { auth: true });
    },
    applications: (status = '', clinicId = '') => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (clinicId) params.set('clinic_id', clinicId);
      const qs = params.toString();
      return request(`/api/admin/applications${qs ? `?${qs}` : ''}`, { auth: true });
    },
    clinic: () => request('/api/admin/clinic', { auth: true }),
    clinics: () => request('/api/admin/clinics', { auth: true }),
    markApplication: (id, status) =>
      request(`/api/admin/applications/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status }, auth: true }),
    // Single record for notification deep-links (?application=<id>).
    application: (id) =>
      request(`/api/admin/applications/${encodeURIComponent(id)}`, { auth: true }),
    patient: (id) => request(`/api/admin/patients/${id}`, { auth: true }),
    createPatient: (payload) =>
      request('/api/admin/patients', { method: 'POST', body: payload, auth: true }),
    uploadAdmissionScan: (payload) =>
      request('/api/admin/admission-scan-upload', { method: 'POST', body: payload, auth: true }),
    admissionPrefillPdf: (payload) =>
      download('/api/admin/admission-prefill-pdf', { auth: true, method: 'POST', body: payload }),
    updatePatient: (id, payload) =>
      request(`/api/admin/patients/${id}`, { method: 'PATCH', body: payload, auth: true }),
    archivePatient: (id) =>
      request(`/api/admin/patients/${id}/archive`, { method: 'PATCH', auth: true }),
    restorePatient: (id) =>
      request(`/api/admin/patients/${id}/restore`, { method: 'PATCH', auth: true }),
    deletePatient: (id) =>
      request(`/api/admin/patients/${id}`, { method: 'DELETE', auth: true }),
    compliance: (clinicId = '') =>
      request(`/api/admin/compliance${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    remindCompliance: (id) =>
      request(`/api/admin/compliance/${id}/remind`, { method: 'POST', auth: true }),
    answerCompliance: (id, payload) =>
      request(`/api/admin/compliance/${id}`, { method: 'PATCH', body: payload, auth: true }),
    saveCompliance: (patientId, code, payload) =>
      request(`/api/admin/compliance/${patientId}/${encodeURIComponent(code)}`, {
        method: 'PUT',
        body: payload,
        auth: true,
      }),
    returnCompliance: (id, reviewComment) =>
      request(`/api/admin/compliance/${id}/return`, {
        method: 'POST',
        body: { review_comment: reviewComment },
        auth: true,
      }),
    schedule: (clinicId = '') =>
      request(`/api/admin/schedule${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    createAppointment: (payload) =>
      request('/api/admin/schedule', { method: 'POST', body: payload, auth: true }),
    deleteAppointment: (id) =>
      request(`/api/admin/schedule/${id}`, { method: 'DELETE', auth: true }),
    updateAppointment: (id, payload) =>
      request(`/api/admin/schedule/${id}`, { method: 'PATCH', body: payload, auth: true }),
    documents: (clinicId = '') =>
      request(`/api/admin/documents${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    // One-click backup downloads (admin only; every export is audit-logged).
    exportStudents: (format = 'csv', clinicId = '') =>
      download(`/api/admin/export/students?format=${encodeURIComponent(format)}${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    exportEmployees: (format = 'csv', clinicId = '') =>
      download(`/api/admin/export/employees?format=${encodeURIComponent(format)}${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    exportDocuments: (format = 'csv', clinicId = '') =>
      download(`/api/admin/export/documents?format=${encodeURIComponent(format)}${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    exportDocumentsZip: (clinicId = '') =>
      download(`/api/admin/export/documents-pdf${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    downloadDocumentPdf: (sourceTable, id) => download(`/api/admin/pdf/documents/${encodeURIComponent(sourceTable)}/${encodeURIComponent(id)}`, { auth: true }),
    downloadDocumentCtcPdf: (sourceTable, id) => download(`/api/admin/pdf/documents/${encodeURIComponent(sourceTable)}/${encodeURIComponent(id)}?ctc=true`, { auth: true }),
    downloadPatientPdf: (id, code = 'CMPS:SE-FO-01') => download(`/api/admin/pdf/patients/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`, { auth: true }),
    downloadPatientCtcPdf: (id, code = 'CMPS:SE-FO-01') => download(`/api/admin/pdf/patients/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}&ctc=true`, { auth: true }),
    announcements: (clinicId = '') =>
      request(`/api/admin/announcements${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    createAnnouncement: (payload) =>
      request('/api/admin/announcements', { method: 'POST', body: payload, auth: true }),
    updateAnnouncement: (id, payload) =>
      request(`/api/admin/announcements/${id}`, { method: 'PATCH', body: payload, auth: true }),
    deleteAnnouncement: (id) =>
      request(`/api/admin/announcements/${id}`, { method: 'DELETE', auth: true }),
    audit: () => request('/api/admin/audit', { auth: true }),
    scoring: () => request('/api/admin/scoring', { auth: true }),
    assessments: (clinicId = '') =>
      request(`/api/admin/assessments${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    assessmentDocumentReleases: (clinicId = '') =>
      request(`/api/admin/assessment-document-releases${clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : ''}`, { auth: true }),
    scheduleAssessmentDocumentRelease: (id, payload) =>
      request(`/api/admin/assessment-document-releases/${id}`, { method: 'PATCH', body: payload, auth: true }),
    releaseAssessmentDocuments: (id, payment_method) =>
      request(`/api/admin/assessment-document-releases/${id}/release`, {
        method: 'POST',
        body: { payment_method },
        auth: true,
      }),
    setAssessmentActive: (id, is_active) =>
      request(`/api/admin/assessments/${id}`, { method: 'PATCH', body: { is_active }, auth: true }),
    resolveAssessmentRequest: (id, status) =>
      request(`/api/admin/assessment-requests/${id}`, { method: 'PATCH', body: { status }, auth: true }),
    employees: (includeDisabled = false, clinicId = '') => {
      const params = new URLSearchParams();
      if (includeDisabled) params.set('include_disabled', 'true');
      if (clinicId) params.set('clinic_id', clinicId);
      const qs = params.toString();
      return request(`/api/admin/employees${qs ? `?${qs}` : ''}`, { auth: true });
    },
    createEmployee: (payload) =>
      request('/api/admin/employees', { method: 'POST', body: payload, auth: true }),
    deactivateEmployee: (id, payload = null) =>
      request(`/api/admin/employees/${id}/deactivate`, { method: 'PATCH', body: payload || undefined, auth: true }),
    reactivateEmployee: (id) =>
      request(`/api/admin/employees/${id}/reactivate`, { method: 'PATCH', auth: true }),
    // Per-role status + reassignment gate.
    employeeAssignments: (id) =>
      request(`/api/admin/employees/${id}/assignments`, { auth: true }),
    disableEmployeeRole: (id, payload) =>
      request(`/api/admin/employees/${id}/roles/disable`, { method: 'PATCH', body: payload, auth: true }),
    enableEmployeeRole: (id, role) =>
      request(`/api/admin/employees/${id}/roles/enable`, { method: 'PATCH', body: { role }, auth: true }),
    // One email, many branches: grant/revoke branch access on one account.
    grantBranchAccess: (id, clinic_id) =>
      request(`/api/admin/employees/${id}/branches`, { method: 'POST', body: { clinic_id }, auth: true }),
    revokeBranchAccess: (id, clinicId) =>
      request(`/api/admin/employees/${id}/branches/${encodeURIComponent(clinicId)}`, { method: 'DELETE', auth: true }),
    // Practitioner weekly branch schedules (booking branch suggestion).
    employeeSchedules: (id) =>
      request(`/api/admin/employees/${id}/schedules`, { auth: true }),
    createEmployeeSchedule: (id, payload) =>
      request(`/api/admin/employees/${id}/schedules`, { method: 'POST', body: payload, auth: true }),
    deleteEmployeeSchedule: (id, scheduleId) =>
      request(`/api/admin/employees/${id}/schedules/${encodeURIComponent(scheduleId)}`, { method: 'DELETE', auth: true }),
    scheduleSuggestion: (practitioner_id, date, time = '') =>
      request(`/api/admin/schedule/suggestion?practitioner_id=${encodeURIComponent(practitioner_id)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`, { auth: true }),
    deleteEmployee: (id) =>
      request(`/api/admin/employees/${id}`, { method: 'DELETE', auth: true }),
    updateEmployee: (id, payload) =>
      request(`/api/admin/employees/${id}`, { method: 'PATCH', body: payload, auth: true }),
    manageUserAccount: (id, payload) =>
      request(`/api/admin/users/${id}/account`, { method: 'PATCH', body: payload, auth: true }),
    landing: () => request('/api/admin/landing', { auth: true }),
    saveLanding: (sections) => request('/api/admin/landing', { method: 'PATCH', body: { sections, publish: false }, auth: true }),
    publishLanding: (sections) => request('/api/admin/landing', { method: 'PATCH', body: { sections, publish: true }, auth: true }),
    uploadLandingImage: (dataUrl) => request('/api/admin/landing/upload', { method: 'POST', body: { dataUrl }, auth: true }),
    resetLandingSection: (sectionKey) => request(`/api/admin/landing/${sectionKey}`, { method: 'DELETE', auth: true }),
  },
  psychologist: {
    completeOnboarding: (accessToken) => request('/api/psychologist/onboarding', { method: 'PATCH', body: { completed: true }, auth: true, accessToken }),
    tasks: () => request('/api/psychologist/tasks', { auth: true }),
    completeAppointment: (id, payload) =>
      request(`/api/psychologist/tasks/appointments/${id}`, { method: 'PATCH', body: payload, auth: true }),
    approvals: () => request('/api/psychologist/approvals', { auth: true }),
    roster: () => request('/api/psychologist/roster', { auth: true }),
    updateRoster: (id, payload) =>
      request(`/api/psychologist/roster/${id}`, { method: 'PATCH', body: payload, auth: true }),
    rosterSuggestion: (id) =>
      request(`/api/psychologist/roster/${id}/suggestion`, { auth: true }),
    intake: (patientId) =>
      request(`/api/psychologist/intake/${encodeURIComponent(patientId)}`, { auth: true }),
    saveIntake: (patientId, payload) =>
      request(`/api/psychologist/intake/${encodeURIComponent(patientId)}`, { method: 'PUT', body: payload, auth: true }),
    mainstreaming: () => request('/api/psychologist/mainstreaming', { auth: true }),
    addMainstreaming: (payload) =>
      request('/api/psychologist/mainstreaming', { method: 'POST', body: payload, auth: true }),
    interventions: () => request('/api/psychologist/interventions', { auth: true }),
    addIntervention: (payload) =>
      request('/api/psychologist/interventions', { method: 'POST', body: payload, auth: true }),
    progress: () => request('/api/psychologist/progress', { auth: true }),
    addProgressReport: (payload) =>
      request('/api/psychologist/progress', { method: 'POST', body: payload, auth: true }),
    updateReport: (id, payload) =>
      request(`/api/psychologist/reports/${id}`, { method: 'PATCH', body: payload, auth: true }),
    deleteProgressReport: (id) =>
      request(`/api/psychologist/progress/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
    updateActivityLog: (id, payload) =>
      request(`/api/psychologist/activity-logs/${id}`, { method: 'PATCH', body: payload, auth: true }),
    grantAssessmentPermission: (payload) =>
      request('/api/psychologist/assessments/grant-permission', { method: 'POST', body: payload, auth: true }),
    assessmentOnsiteViewRequests: () => request('/api/psychologist/assessment-onsite-view-requests', { auth: true }),
    resolveAssessmentOnsiteViewRequest: (source_table, id, status, options = []) =>
      request(`/api/psychologist/assessment-onsite-view-requests/${id}`, {
        method: 'PATCH',
        body: { source_table, status, options },
        auth: true,
      }),
    updateSubmission: (id, payload) =>
      request(`/api/psychologist/submissions/${id}`, { method: 'PATCH', body: payload, auth: true }),
  },
  psychometrician: {
    completeOnboarding: (accessToken) => request('/api/psychometrician/onboarding', { method: 'PATCH', body: { completed: true }, auth: true, accessToken }),
    tasks: () => request('/api/psychometrician/tasks', { auth: true }),
    completeAppointment: (id, payload) =>
      request(`/api/psychometrician/tasks/appointments/${id}`, { method: 'PATCH', body: payload, auth: true }),
    assessments: () => request('/api/psychometrician/assessments', { auth: true }),
    // Lean roster for pages that only need patients + tests (e.g. the
    // psychologist Approvals directory): skips sessions, employees, full
    // submissions, assignments, and permissions server-side.
    assessmentsLean: () => request('/api/psychometrician/assessments?lean=1', { auth: true }),
    dataReview: () => request('/api/psychometrician/data-review', { auth: true }),
    reports: () => request('/api/psychometrician/reports', { auth: true }),
    draftingReports: () => request('/api/psychometrician/drafting-reports', { auth: true }),
    addBehavioralReport: (payload) =>
      request('/api/psychometrician/reports', { method: 'POST', body: payload, auth: true }),
    downloadDocumentPdf: (sourceTable, id) => download(`/api/psychometrician/pdf/${encodeURIComponent(sourceTable)}/${encodeURIComponent(id)}`, { auth: true }),
    monthlyProgressPdf: (patientId) => download(`/api/psychometrician/progress/${encodeURIComponent(patientId)}/pdf`, { auth: true }),
    activityLogs: () => request('/api/psychometrician/activity-logs', { auth: true }),
    addActivityLog: (payload) =>
      request('/api/psychometrician/activity-logs', { method: 'POST', body: payload, auth: true }),
    deleteActivityLog: (id) =>
      request(`/api/psychometrician/activity-logs/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
    assessmentTemplate: (id) => request(`/api/psychometrician/assessment-templates/${id}`, { auth: true }),
    assessmentSubmission: (patientId, templateId) =>
      request(
        `/api/psychometrician/assessments/submission?patient_id=${encodeURIComponent(patientId)}&template_id=${encodeURIComponent(templateId)}`,
        { auth: true },
      ),
    submitAssessment: (id, payload) =>
      request(`/api/psychometrician/assessments/${id}/submit`, { method: 'POST', body: payload, auth: true }),
    saveDraftAssessment: (id, payload) =>
      request(`/api/psychometrician/assessments/${id}/submit`, { method: 'POST', body: { ...payload, status: 'draft' }, auth: true }),
    assignAssessment: (payload) =>
      request('/api/psychometrician/assignments', { method: 'POST', body: payload, auth: true }),
    requestAssessment: (payload) =>
      request('/api/psychometrician/assessment-requests', { method: 'POST', body: payload, auth: true }),
    updateSubmission: (id, payload) =>
      request(`/api/psychometrician/submissions/${id}`, { method: 'PATCH', body: payload, auth: true }),
    updateReport: (id, payload) =>
      request(`/api/psychometrician/reports/${id}`, { method: 'PATCH', body: payload, auth: true }),
    patients: () => request('/api/psychometrician/patients', { auth: true }),
    patient: (id) => request(`/api/psychometrician/patients/${id}`, { auth: true }),
    getAttendanceSessionForm: (patient_id, month_year) => request(`/api/psychometrician/attendance-session-forms?patient_id=${patient_id}&month_year=${encodeURIComponent(month_year)}`, { auth: true }),
    downloadAttendancePdf: (patient_id, month_year) => download(`/api/psychometrician/pdf/attendance-session-forms?patient_id=${encodeURIComponent(patient_id)}&month_year=${encodeURIComponent(month_year)}`, { auth: true }),
    saveAttendanceSessionForm: (payload) => request('/api/psychometrician/attendance-session-forms', { method: 'POST', body: payload, auth: true }),
    deleteAttendanceSessionForm: (patient_id, month_year) =>
      request(
        `/api/psychometrician/attendance-session-forms?patient_id=${encodeURIComponent(patient_id)}&month_year=${encodeURIComponent(month_year)}`,
        { method: 'DELETE', auth: true },
      ),
    finalizeAttendanceSessionForm: (patient_id, month_year, finalized = true) =>
      request('/api/psychometrician/attendance-session-forms/finalize', { method: 'POST', body: { patient_id, month_year, finalized }, auth: true }),
    studentJournal: (patientId) => request(`/api/psychometrician/student-journal/${patientId}`, { auth: true }),
    requestAssessmentPermission: (payload) =>
      request('/api/psychometrician/assessments/request-permission', { method: 'POST', body: payload, auth: true }),
    updateJournalPermission: (patient_id, allow_journal_entry) =>
      request('/api/psychometrician/journal-permission', { method: 'PATCH', body: { patient_id, allow_journal_entry }, auth: true }),
    iep: () => request('/api/psychometrician/iep', { auth: true }),
    addIepReport: (payload) =>
      request('/api/psychometrician/iep', { method: 'POST', body: payload, auth: true }),
    deleteIepReport: (id) =>
      request(`/api/psychometrician/iep/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  },
  payments: {
    createCheckout: (request_id) =>
      request('/api/payments/checkout', { method: 'POST', body: { request_id }, auth: true }),
    checkStatus: (requestId) =>
      request(`/api/payments/status/${encodeURIComponent(requestId)}`, { auth: true }),
  },
}

