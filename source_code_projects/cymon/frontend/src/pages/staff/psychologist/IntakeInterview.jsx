import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import SearchBar from '../../../components/ui/SearchBar'
import Skeleton from '../../../components/ui/Skeleton'
import Button from '../../../components/ui/Button'
import DatePicker from '../../../components/ui/DatePicker'
import { api } from '../../../lib/api'
import { capitalizeName, compareStudentsAZ, formatLastFirstMI, pinStudentFirst } from '../../../lib/format'
import { levelTone } from '../../../lib/rosterMeta'
import { ProgressBar } from './RosterOverview'

// The Intake Interview is the first assessment an MHP records before treatment
// begins. It captures the patient's presenting concerns, background, and
// initial observations — one record per student, collaboratively editable by
// the assigned psychologist and psychometrician (migration 0091 + 0098).
// `source` selects the directory feed: 'psychologist' (default, full roster
// with clinical impression fields) or 'psychometrician' (assigned students,
// intake fields only — roster impressions stay psychologist-only).

const displayRole = (r) =>
  r === 'psychologist' ? 'Psychologist' : r === 'psychometrician' ? 'Psychometrician' : r === 'admin' || r === 'super_admin' ? 'Admin' : (r || 'Clinician')

const Labeled = ({ label, children, full = false, edited = null }) => (
  <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
    <div className="font-semibold text-purple-700">{label}</div>
    {children}
      {edited ? (
        <div className="mt-1 text-[11px] italic text-slate-400">
          {/* Snapshots stored before the casing fix may be lowercase. */}
          Last edited by {capitalizeName(edited.by || 'Clinician')}
        {edited.role ? ` (${displayRole(edited.role)})` : ''}
        {edited.at ? ` · ${new Date(edited.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
      </div>
    ) : null}
  </label>
)

const Text = (props) => (
  <input {...props} className="mt-1 h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 px-3 text-sm" />
)

const Area = ({ rows = 3, ...props }) => (
  <textarea rows={rows} {...props} className="mt-1 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 px-3 py-2 text-sm" />
)

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
    <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">{title}</div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  </section>
)

const blank = {
  interview_date: '',
  informant: '',
  concerns: '',
  onset: '',
  background: '',
  developmental: '',
  medical: '',
  family: '',
  observations: '',
}

const FIELDS = ['interview_date', 'informant', 'concerns', 'onset', 'background', 'developmental', 'medical', 'family', 'observations']

function IntakeInterview({ source = 'psychologist' }) {
  const isPsychometrician = source === 'psychometrician'
  // Roster impressions (chief complaint / working diagnosis) stay
  // psychologist-only; psychometricians collaborate on the intake fields.
  const canEditClinical = !isPsychometrician
  const [clients, setClients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [form, setForm] = useState(blank)
  const [clinical, setClinical] = useState({ chief_complaint: '', working_diagnosis: '' })
  const [clinicalInitial, setClinicalInitial] = useState({ chief_complaint: '', working_diagnosis: '' })
  const [loadingList, setLoadingList] = useState(true)
  const [loadingForm, setLoadingForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [lastEdit, setLastEdit] = useState(null) // { by, role, at }
  const [fieldMeta, setFieldMeta] = useState({})
  const [query, setQuery] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [error, setError] = useState(null)
  // Fields touched since the last successful save — sent as `changedFields`
  // so the backend can stamp per-field edit tracking (who edited what).
  const [changed, setChanged] = useState([])
  const markChanged = (k) => setChanged((prev) => (prev.includes(k) ? prev : [...prev, k]))
  const savingRef = useRef(false)
  // Deep link (e.g. from the "New student in your directory" notification):
  // ?patientId=<uuid> preselects that student and brings them into view.
  const [searchParams] = useSearchParams()
  const urlPatientId = searchParams.get('patientId') || ''
  // Transient ring-pulse on the deep-linked card so the arrival point is
  // unmissable even when the roster is long.
  const [highlightId, setHighlightId] = useState('')
  // Tracks which deep-link ids already triggered a roster refetch, so a
  // stale cached roster (e.g. already sitting on Intake when the student
  // completes compliance) reloads once instead of looping.
  const deepLinkRetriedRef = useRef(new Set())

  const fetchRoster = () => (isPsychometrician
    ? api.psychometrician.patients().then((d) => ({ clients: d.patients || [] }))
    : api.psychologist.roster())

  useEffect(() => {
    let on = true
    fetchRoster()
      .then((d) => {
        if (on) setClients(d.clients || [])
      })
      .catch(() => {})
      .finally(() => {
        if (on) setLoadingList(false)
      })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPsychometrician])

  useEffect(() => {
    if (!urlPatientId) return
    const found = clients.some((c) => String(c.id) === String(urlPatientId))
    if (!found) {
      // Roster may be stale when the notification is clicked from the Intake
      // page itself (initial load predates the new student). Refetch once per
      // id so the card appears instead of silently doing nothing.
      if (!loadingList && !deepLinkRetriedRef.current.has(urlPatientId)) {
        deepLinkRetriedRef.current.add(urlPatientId)
        fetchRoster()
          .then((d) => setClients(d.clients || []))
          .catch(() => {})
      }
      return
    }
    // Clear any search filter so the deep-linked card is actually visible.
    setQuery('')
    if (String(patientId) !== String(urlPatientId)) setPatientId(urlPatientId)
    setHighlightId(urlPatientId)
    // Highlight is driven by highlightId state; scroll the picked row into
    // view after it renders so the arrival point is obvious. Two passes in
    // case the first fires before the list re-renders.
    // NOTE: scroll the directory list itself (not scrollIntoView) — the page
    // has nested scroll containers, so scrollIntoView also moves the outer
    // page scroll and leaves the card half-cut. Direct list scrolling centers
    // the whole card deterministically.
    const scrollToCard = () => {
      try {
        const el = document.querySelector(
          `[data-patient-id="${CSS.escape(String(urlPatientId))}"]`,
        )
        const list = el?.closest('[data-intake-directory-list]')
        if (el && list) {
          const listRect = list.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          const delta = elRect.top - listRect.top - (list.clientHeight - elRect.height) / 2
          list.scrollTo({ top: list.scrollTop + delta, behavior: 'smooth' })
        } else {
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } catch {
        // older browsers — selection still applies without the scroll
      }
    }
    const t1 = setTimeout(scrollToCard, 150)
    const t2 = setTimeout(scrollToCard, 600)
    const t3 = setTimeout(() => {
      setHighlightId((current) => (String(current) === String(urlPatientId) ? '' : current))
    }, 4000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPatientId, clients, loadingList])

  useEffect(() => {
    if (!patientId) {
      setForm(blank)
      setClinical({ chief_complaint: '', working_diagnosis: '' })
      setClinicalInitial({ chief_complaint: '', working_diagnosis: '' })
      setSavedAt(null)
      setLastEdit(null)
      setFieldMeta({})
      setSetupRequired(false)
      setError(null)
      return
    }
    // Chief complaint / working diagnosis live on the roster record (single
    // source of truth, shared with the Students page) — seed the fields here.
    const selected = clients.find((c) => String(c.id) === String(patientId))
    const seeded = {
      chief_complaint: selected?.chief_complaint || '',
      working_diagnosis: selected?.working_diagnosis || '',
    }
    setClinical(seeded)
    setClinicalInitial(seeded)
    setChanged([])
    let on = true
    setLoadingForm(true)
    setError(null)
    api.psychologist
      .intake(patientId)
      .then((d) => {
        if (!on) return
        if (d.setupRequired) {
          setSetupRequired(true)
          setForm(blank)
          return
        }
        const next = { ...blank }
        for (const k of FIELDS) next[k] = d.intake?.[k] || ''
        setForm(next)
        setSavedAt(d.intake?.updated_at || null)
        setFieldMeta((d.intake && d.intake.field_meta) || {})
        if (d.intake?.updated_by) {
          setLastEdit({
            by: d.intake.updated_by.name || 'Clinician',
            role: d.intake.updated_by.role || null,
            at: d.intake.updated_at || null,
          })
        } else {
          setLastEdit(null)
        }
      })
      .catch((e) => {
        if (on) setError(e.message || 'Could not load the intake record.')
      })
      .finally(() => {
        if (on) setLoadingForm(false)
      })
    return () => {
      on = false
    }
  }, [patientId])

  const set = (k) => (e) => {
    markChanged(k)
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setSavedAt(null)
  }
  const setClinicalField = (k) => (e) => {
    markChanged(k)
    setClinical((c) => ({ ...c, [k]: e.target.value }))
    setSavedAt(null)
  }

  // Shared by the manual Save button and the Google-Form-style autosave.
  // Silent autosaves skip the toast so typing is never interrupted.
  const persist = async (silent = false) => {
    if (!patientId || savingRef.current) return false
    savingRef.current = true
    if (!silent) setSaving(true)
    try {
      // One save persists both records: the intake interview itself plus the
      // roster clinical fields (chief complaint / working diagnosis), which
      // stay shared with the Students page — no duplicate source of truth.
      const res = await api.psychologist.saveIntake(patientId, {
        ...form,
        changedFields: changed,
        // Disambiguates dual-role staff assigned in both capacities for this
        // patient — the backend stamps this capacity (validated as held).
        sourceRole: isPsychometrician ? 'psychometrician' : 'psychologist',
      })
      const clinicalChanged =
        canEditClinical &&
        (clinical.chief_complaint !== clinicalInitial.chief_complaint ||
          clinical.working_diagnosis !== clinicalInitial.working_diagnosis)
      if (clinicalChanged) {
        await api.psychologist.updateRoster(patientId, {
          chief_complaint: clinical.chief_complaint,
          working_diagnosis: clinical.working_diagnosis,
        })
        setClinicalInitial({ ...clinical })
        // Refresh the directory snapshot so reselecting shows fresh values.
        api.psychologist
          .roster()
          .then((d) => setClients(d.clients || []))
          .catch(() => {})
      }
      setChanged([])
      setSavedAt(res.updated_at || new Date().toISOString())
      if (res.updated_by) {
        setLastEdit({
          by: res.updated_by.by || 'Clinician',
          role: res.updated_by.role || null,
          at: res.updated_at || new Date().toISOString(),
        })
      }
      if (res.field_meta) setFieldMeta(res.field_meta)
      if (!silent) toast.success('Intake interview saved.')
      return true
    } catch (e2) {
      if (!silent) setError(e2.message || 'Could not save the intake interview.')
      return false
    } finally {
      savingRef.current = false
      if (!silent) setSaving(false)
    }
  }

  const save = (e) => {
    e.preventDefault()
    if (!patientId) {
      toast.error('Select a student first.')
      return
    }
    setError(null)
    persist(false)
  }

  // Google-Form-style autosave: 2s after the clinician stops typing.
  useEffect(() => {
    if (!patientId || loadingForm || setupRequired) return
    if (changed.length === 0) return
    const timer = setTimeout(() => {
      persist(true)
    }, 2000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, clinical, changed, patientId, loadingForm, setupRequired])

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  // Directory order is always A–Z by "LAST, FIRST M." (never backend order),
  // except the deep-linked student, who stays on top as the recent arrival.
  const visible = pinStudentFirst(
    (q
      ? clients.filter((c) => `${c.name || ''} ${formatLastFirstMI(c)}`.toLowerCase().replace(/,/g, ' ').includes(q))
      : [...clients]
    ).sort(compareStudentsAZ),
    urlPatientId,
  )
  const selected = clients.find((c) => String(c.id) === String(patientId)) || null
  const editedBy = (k) => (fieldMeta && fieldMeta[k]) || null
  const roleLabel = displayRole

  return (
    <>
      <StaffHeader title="Intake Interview" />
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-6 flex flex-col" data-onboarding-key="intake-workspace">
        <PageSubtitle>
          First assessment before treatment — record the patient&apos;s concerns, background, and
          initial observations.
        </PageSubtitle>

        <div className="mt-5 grid flex-1 min-h-0 grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm flex flex-col min-h-0 lg:overflow-hidden lg:sticky lg:top-0 lg:max-h-full" data-onboarding-key="intake-directory">
            <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors shrink-0">Students</div>
            <div className="mt-3 shrink-0">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search students…"
                className="w-full"
              />
            </div>
            {/* p-1.5 breathing room: the deep-link ring + offset extend ~4px
                past the card, and without inner padding the scroll container
                clips them on the first/last rows. */}
            <div data-intake-directory-list key={loadingList ? 'loading' : 'loaded'} className="mt-4 space-y-2 overflow-y-auto min-h-0 max-h-[50vh] lg:max-h-none lg:flex-1 p-1.5 animate-content-fade-in">
              {loadingList ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px] w-full" rounded="rounded-xl" />
                ))
              ) : visible.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {clients.length === 0 ? 'No assigned students yet.' : 'No students match your search.'}
                </div>
              ) : (
                visible.map((c) => {
                  const isActive = String(patientId) === String(c.id)
                  const isDeepLinked = String(highlightId) === String(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-patient-id={c.id}
                      onClick={() => {
                        setPatientId(c.id)
                        setHighlightId('')
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all hover:bg-purple-50/50 dark:hover:bg-slate-800/60 cursor-pointer ${
                        isDeepLinked
                          ? 'border-purple-500 dark:border-purple-400 bg-purple-100 dark:bg-purple-900/40 shadow-md ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 animate-pulse'
                          : isActive
                            ? 'border-purple-300 dark:border-purple-700 bg-purple-100 dark:bg-purple-900/40 shadow-sm'
                            : 'border-transparent'
                      }`}
                    >
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm" />
                      ) : (
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${isActive ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200' : 'bg-purple-50 text-purple-600 dark:bg-slate-800 dark:text-purple-400'}`}>
                          {(formatLastFirstMI(c) || c.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-sm font-semibold ${isActive ? 'text-purple-900 dark:text-purple-200' : 'text-slate-800 dark:text-slate-100'}`}>
                          {formatLastFirstMI(c) || c.name}
                        </div>
                        {c.level && c.level !== 'Not specified' ? (
                          <div className="mt-0.5 text-[11px] text-slate-400">{c.level}</div>
                        ) : null}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <form onSubmit={save} className="min-w-0 flex flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:pb-2 lg:pr-1" data-onboarding-key="intake-form">
            {setupRequired ? (
              <div className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Intake storage is not set up yet. Apply migration 0091_intake_interviews.sql in the Supabase SQL editor first.
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
            ) : null}

            {!patientId ? (
              <div className="rounded-2xl border border-dashed border-purple-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-10 text-center text-sm text-slate-400">
                Select a student from the directory to record their intake interview.
              </div>
            ) : setupRequired ? null : loadingForm ? (
              <Section title="Loading…">
                <Skeleton className="h-10 w-full sm:col-span-2" />
                <Skeleton className="h-24 w-full sm:col-span-2" />
                <Skeleton className="h-24 w-full sm:col-span-2" />
              </Section>
            ) : (
              <div key={loadingForm ? 'loading' : 'loaded'} className="animate-content-fade-in">
                <div className="rounded-2xl border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm flex items-center gap-4">
                  {selected?.photo_url ? (
                    <img src={selected.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-4 ring-purple-100 dark:ring-purple-900/40 shadow-sm" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/60 dark:to-purple-800/40 text-2xl font-bold text-purple-700 dark:text-purple-200 ring-4 ring-purple-100 dark:ring-purple-900/40">
                      {(selected?.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-bold text-purple-950 dark:text-purple-100">
                      {selected?.name || 'Intake Interview'}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {selected?.level && selected.level !== 'Not specified' ? (
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${levelTone[selected.level] || 'bg-slate-100 text-slate-600 dark:text-slate-300'}`}>
                          {selected.level}
                        </span>
                      ) : null}
                      {selected ? <ProgressBar value={selected.progress ?? 0} /> : null}
                    </div>
                  </div>
                  {lastEdit ? (
                    <span className="shrink-0 rounded-full bg-sky-100 dark:bg-sky-900/40 px-3 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300" title={lastEdit.at ? new Date(lastEdit.at).toLocaleString() : ''}>
                      Last edited by {capitalizeName(lastEdit.by)}{lastEdit.role ? ` (${roleLabel(lastEdit.role)})` : ''}
                    </span>
                  ) : savedAt ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      Saved · {new Date(savedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  ) : null}
                </div>
                {isPsychometrician ? (
                  <div className="rounded-md bg-sky-50 px-4 py-2 text-sm text-sky-800">
                    You are co-editing this intake with the psychologist. Your changes autosave, and both sides can see who last edited each field.
                  </div>
                ) : null}
                <Section title="Session">
                  <Labeled label="Date of Interview" edited={editedBy('interview_date')}>
                    <DatePicker
                      value={form.interview_date}
                      onChange={(value) => {
                        markChanged('interview_date')
                        setForm((f) => ({ ...f, interview_date: value }))
                        setSavedAt(null)
                      }}
                      ariaLabel="Date of Interview"
                      className="mt-1"
                    />
                  </Labeled>
                  <Labeled label="Informant / Relationship" edited={editedBy('informant')}>
                    <Text value={form.informant} onChange={set('informant')} placeholder="e.g. Mother, Guardian" />
                  </Labeled>
                </Section>

                <Section title="Presenting Concerns">
                  {canEditClinical ? (
                    <Labeled label="Chief complaint (shared with Student Roster)" full edited={editedBy('chief_complaint')}>
                      <Area rows={2} value={clinical.chief_complaint} onChange={setClinicalField('chief_complaint')} placeholder="Main reason the student came in to consult…" />
                    </Labeled>
                  ) : null}
                  <Labeled label="Main concerns" full edited={editedBy('concerns')}>
                    <Area rows={3} value={form.concerns} onChange={set('concerns')} placeholder="Why is the patient being brought in for consultation?" />
                  </Labeled>
                  <Labeled label="Onset & duration" full edited={editedBy('onset')}>
                    <Area rows={2} value={form.onset} onChange={set('onset')} placeholder="When did the concerns begin and how have they progressed?" />
                  </Labeled>
                </Section>

                <Section title="History & Background">
                  <Labeled label="Background information" full edited={editedBy('background')}>
                    <Area rows={3} value={form.background} onChange={set('background')} placeholder="Relevant history, prior services, schooling…" />
                  </Labeled>
                  <Labeled label="Developmental history" edited={editedBy('developmental')}>
                    <Area rows={3} value={form.developmental} onChange={set('developmental')} placeholder="Milestones, delays…" />
                  </Labeled>
                  <Labeled label="Medical history" edited={editedBy('medical')}>
                    <Area rows={3} value={form.medical} onChange={set('medical')} placeholder="Diagnoses, medications, allergies…" />
                  </Labeled>
                  <Labeled label="Family & social" full edited={editedBy('family')}>
                    <Area rows={2} value={form.family} onChange={set('family')} placeholder="Household, family dynamics, support system…" />
                  </Labeled>
                </Section>

                <Section title="Initial Observations">
                  <Labeled label="Clinician observations" full edited={editedBy('observations')}>
                    <Area rows={3} value={form.observations} onChange={set('observations')} placeholder="Behavior, affect, rapport, engagement during the interview…" />
                  </Labeled>
                </Section>

                {canEditClinical ? (
                  <Section title="Clinical Impression">
                    <Labeled label="Medical diagnosis (shared with Student Roster)" full edited={editedBy('working_diagnosis')}>
                      <Area rows={3} value={clinical.working_diagnosis} onChange={setClinicalField('working_diagnosis')} placeholder="Working medical diagnosis / initial impression while evaluation is ongoing…" />
                    </Labeled>
                  </Section>
                ) : (
                  <div className="rounded-md bg-slate-50 px-4 py-2 text-xs text-slate-500">
                    The roster impression (chief complaint / working diagnosis) is maintained by the psychologist.
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs italic text-slate-400">Autosaves while you type…</span>
                  <Button type="submit" disabled={saving || loadingForm}>
                    {saving ? 'Saving…' : 'Save Intake Interview'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  )
}

export default IntakeInterview
