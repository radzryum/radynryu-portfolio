import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Maximize2, PanelLeftOpen } from 'lucide-react'
import StaffHeader from '../StaffHeader'
import AvatarViewer from '../../../components/ui/AvatarViewer'
import SearchBar from '../../../components/ui/SearchBar'
import Skeleton from '../../../components/ui/Skeleton'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import OfficialPdfPreview from '../../../components/ui/OfficialPdfPreview'
import AttendanceSessionForm from './AttendanceSessionForm'
import { useAuth } from '../../../auth/useAuth'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI } from '../../../lib/format'

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function AttendanceDashboard() {
  const { profile } = useAuth()
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [query, setQuery] = useState('')
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const [loading, setLoading] = useState(true)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [recordRevision, setRecordRevision] = useState(0)
  // Sign-off status of the selected student + month (drives the header badge
  // and the pre-preview completeness warning).
  const [monthStatus, setMonthStatus] = useState('none')
  // Fullscreen mode: the directory slides away so the form takes the full
  // width — same collapse pattern as the IEP workspace.
  const [directoryHidden, setDirectoryHidden] = useState(false)
  const [photoViewer, setPhotoViewer] = useState(null)

  // Psychometricians use their own scoped endpoints (assigned students only);
  // admins keep the full roster. Both hit the same tables, so edits sync.
  const isPsychometricianView =
    profile?.role === 'psychometrician' && !(profile?.extra_roles || []).includes('admin')
  const directoryApi = isPsychometricianView ? api.psychometrician : api.admin
  const attendanceApi = isPsychometricianView ? api.psychometrician : api.admin

  const loadPatients = async () => {
    try {
      const data = await directoryApi.patients()
      const roster = data.patients || []
      setPatients(roster)
      setSelectedPatientId((current) =>
        current && roster.some((patient) => patient.id === current)
          ? current
          : roster[0]?.id || '',
      )
    } catch (error) {
      toast.error(error.message || 'Unable to load students.')
    }
  }

  useEffect(() => {
    let active = true
    loadPatients().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPsychometricianView])

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId) || null
  // Directory order is always A–Z by "LAST, FIRST M." (never backend order).
  const filteredPatients = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/,/g, ' ')
    const list = !term
      ? [...patients]
      : patients.filter((patient) =>
        [patient.name, formatLastFirstMI(patient), patient.patient_id, patient.enrollment_type]
          .some((value) => String(value || '').toLowerCase().replace(/,/g, ' ').includes(term)),
      )
    return list.sort(compareStudentsAZ)
  }, [patients, query])

  const selectedMonthLabel = monthLabel(monthKey)
  const selectedMonthDate = `${monthKey}-01`

  useEffect(() => {
    if (!selectedPatientId) {
      setMonthStatus('none')
      return
    }
    let active = true
    attendanceApi
      .getAttendanceSessionForm(selectedPatientId, selectedMonthLabel)
      .then((d) => {
        if (!active) return
        if (!d.form) setMonthStatus('none')
        else if (d.form.is_finalized) setMonthStatus('finalized')
        else if (d.form.facilitator_signature) setMonthStatus('signed')
        else setMonthStatus('unsigned')
      })
      .catch(() => {
        if (active) setMonthStatus('none')
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId, monthKey, recordRevision])

  const openOfficialPdfPreview = () => {
    if (!selectedPatient) return
    // Completeness warning only — previewing an unsigned month is allowed,
    // but the facilitator should know the official copy lacks a signature.
    if (monthStatus === 'unsigned') {
      toast('No facilitator signature yet — previewing an unsigned record.')
    } else if (monthStatus === 'none') {
      toast('No attendance record for this month yet.')
    }
    const safeStudent = (selectedPatient.name || selectedPatient.patient_id || 'student')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
    const safeMonth = selectedMonthLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
    setPdfPreview({
      title: `Official FO-11 Attendance Record - ${selectedPatient.name || 'Student'}`,
      filename: `${safeStudent || 'student'}-CMPS-SE-FO-11-${safeMonth || 'record'}.pdf`,
      loadPdf: () => attendanceApi.downloadAttendancePdf(selectedPatient.id, selectedMonthLabel),
      // Certified True Copy is an admin-only clean copy (watermark-free).
      // Psychometricians keep the watermarked preview + regular download.
      loadCtcPdf: isPsychometricianView
        ? undefined
        : () => api.admin.downloadAttendanceCtcPdf(selectedPatient.id, selectedMonthLabel),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col font-sans">
      <StaffHeader title="Attendance & Session Records" />
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden bg-slate-50 dark:bg-slate-950 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none ${directoryHidden ? 'px-2 min-[360px]:px-3 sm:px-4 py-4 sm:py-6 lg:py-7' : 'p-4 sm:p-6 lg:p-7'}`} data-onboarding-key="attendance-workspace">
        <div className={`mx-auto flex min-h-full lg:min-h-0 lg:flex-1 w-full flex-col gap-6 ${directoryHidden ? 'max-w-none' : 'max-w-7xl'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Monthly Attendance Workspace</h1>
              <PageSubtitle>
                Select a student, record attendance and session details by month, then preview the official FO-11 form.
              </PageSubtitle>
            </div>
            <button
              type="button"
              disabled={!selectedPatient}
              onClick={openOfficialPdfPreview}
              data-onboarding-key="attendance-preview-form"
              className="inline-flex min-w-36 items-center justify-center rounded-xl border border-purple-300 bg-white dark:bg-slate-900 transition-colors px-4 py-2.5 text-sm font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview Form
            </button>
          </div>

          <div className={`grid min-h-0 lg:flex-1 grid-cols-1 items-start gap-6 ${directoryHidden ? 'lg:grid-cols-[0fr_minmax(0,1fr)]' : 'lg:grid-cols-[300px_minmax(0,1fr)]'}`}>
            <div
              className={`min-w-0 transition-all duration-300 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${directoryHidden ? 'h-0 min-h-0 overflow-hidden opacity-0 invisible -translate-x-6 pointer-events-none lg:h-auto lg:min-h-0' : ''}`}
              aria-hidden={directoryHidden || undefined}
            >
            <aside className="sticky top-4 flex max-h-[calc(100vh-7rem)] min-h-[34rem] self-start flex-col rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm lg:overscroll-contain">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-purple-100 pb-3">
                <h2 className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">
                  Student Directory
                </h2>
                <button
                  type="button"
                  onClick={() => setDirectoryHidden(true)}
                  title="Fullscreen — hide directory"
                  aria-label="Fullscreen — hide student directory"
                  className="rounded-md p-1.5 text-purple-500 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 shrink-0">
                <SearchBar
                  value={query}
                  onChange={setQuery}
                  placeholder="Search student"
                  className="w-full"
                />
              </div>
              <div key={loading ? 'loading' : 'loaded'} className="mt-4 flex-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain p-2 -m-2 animate-content-fade-in">
                {/* Render from data once it exists — the skeleton is only for
                    the true first load, so the directory can never lag behind
                    the detail panel during refreshes. */}
                {loading && patients.length === 0 ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" rounded="rounded-xl" />
                  ))
                ) : filteredPatients.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">No students found.</div>
                ) : (
                  filteredPatients.map((patient) => {
                    const active = patient.id === selectedPatientId
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(patient.id)
                          setPdfPreview(null)
                        }}
                        className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer group ${
                          active
                            ? 'border-purple-300 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40 shadow-md scale-[1.02]'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {patient.photo_url || patient.patients?.photo_url ? (
                            <img src={patient.photo_url || patient.patients?.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold transition-colors ${ active ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-300 transition-colors' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:text-purple-700 dark:bg-slate-800 dark:group-hover:bg-slate-700' }`}>
                              <svg viewBox="0 0 24 24" className="h-7 w-7 opacity-50" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{formatLastFirstMI(patient) || patient.name}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                              ID: {patient.patient_id || 'N/A'}
                            </div>
                            <div className="mt-1 truncate text-[10px] font-medium text-purple-600">
                              {patient.enrollment_type || 'Program not specified'}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </aside>
            </div>

            <main key={selectedPatientId || 'empty'} className="student-directory-panel min-w-0 min-h-0 space-y-4 lg:h-full lg:overflow-y-auto lg:overscroll-contain p-2 -m-2">
              {directoryHidden ? (
                <div className="shrink-0 print:hidden">
                  <button
                    type="button"
                    onClick={() => setDirectoryHidden(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-400 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                    Show directory
                  </button>
                </div>
              ) : null}
              {selectedPatient ? (
                <>
                  <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      {selectedPatient.photo_url || selectedPatient.patients?.photo_url ? (
                        <button
                          type="button"
                          onClick={() => setPhotoViewer(selectedPatient.photo_url || selectedPatient.patients?.photo_url)}
                          aria-label="View student photo"
                          title="View student photo"
                          className="shrink-0 cursor-zoom-in rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          <img src={selectedPatient.photo_url || selectedPatient.patients?.photo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-purple-200 dark:ring-slate-700 shadow-sm" />
                        </button>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-xl font-bold text-purple-700 dark:text-purple-300">
                          {(selectedPatient.name || 'ST').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h1 className="truncate text-xl font-bold text-purple-800 dark:text-purple-300 transition-colors">{selectedPatient.name}</h1>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                          <span>
                            ID: {selectedPatient.patient_id || 'N/A'} · {selectedPatient.enrollment_type || 'Program not specified'} · {selectedMonthLabel}
                          </span>
                          {monthStatus === 'finalized' ? (
                            <span className="rounded-full bg-purple-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Finalized</span>
                          ) : monthStatus === 'signed' ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Signed</span>
                          ) : monthStatus === 'unsigned' ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Unsigned</span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </div>
                  <AvatarViewer src={photoViewer} alt={selectedPatient.name} onClose={() => setPhotoViewer(null)} />

                  <section className="min-h-[44rem] overflow-hidden rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
                    <AttendanceSessionForm
                      key={`${selectedPatient.id}-${monthKey}-${recordRevision}`}
                      patientId={selectedPatient.id}
                      patientName={selectedPatient.name}
                      program={selectedPatient.enrollment_type}
                      date={selectedMonthDate}
                      monthKey={monthKey}
                      onMonthChange={setMonthKey}
                      monthLocked={true}
                      inline={true}
                      attendanceApi={attendanceApi}
                      defaultFacilitatorName={profile?.display_name || ''}
                      onSaved={() => setRecordRevision((revision) => revision + 1)}
                      onDeleted={() => setRecordRevision((revision) => revision + 1)}
                    />
                  </section>
                </>
              ) : (
                <div className="flex min-h-[34rem] items-center justify-center rounded-2xl border-2 border-dashed border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-8 text-center text-sm text-slate-500 dark:text-slate-400 transition-colors">
                  Select a student to open their monthly attendance workspace.
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {pdfPreview ? (
        <OfficialPdfPreview {...pdfPreview} onClose={() => setPdfPreview(null)} />
      ) : null}
    </div>
  )
}

export default AttendanceDashboard

