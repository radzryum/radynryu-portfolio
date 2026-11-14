import { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from './PageHeader'
import PageIntro from '../../components/ui/PageIntro'
import Skeleton from '../../components/ui/Skeleton'
import WaiverTrackerCard from './WaiverTrackerCard'
import { api } from '../../lib/api'
import useRealtimeRefresh from '../../hooks/useRealtimeRefresh'
import { AuthContext } from '../../auth/AuthContext'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

const EXPECTED_FORMS = [
  { code: 'CMPS:SE-FO-01', title: 'Student Admission Form', description: 'Personal info, parents details, diagnosis, disability, enrollment program selection.' },
  { code: 'CMPS:SE-FO-02', title: 'SPED Consent and Waiver', description: 'Parent / caregiver consent for the Special Education Program.' },
]

function Waivers() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile } = useContext(AuthContext) || {}
  const userId = profile?.id

  // loading starts true for the initial fetch; realtime refetches must not
  // re-trigger the full-page skeleton, so load() only ever clears it.
  const load = useCallback(() => {
    api.client.waivers()
      .then((waiversData) => {
        const apiForms = waiversData?.forms || []
        const mapped = EXPECTED_FORMS.map((ef) => {
          const apiF = apiForms.find((af) => af.code === ef.code)
          return {
            ...ef,
            status: apiF?.status || 'not_started',
            review_comment: apiF?.review_comment || null,
            due_date: apiF?.due_date || null,
          }
        })
        setForms(mapped)
      })
      .catch((err) => {
        console.error('Failed to load waivers:', err)
        const fallback = EXPECTED_FORMS.map((ef) => ({
          ...ef,
          status: 'not_started',
          due_date: null,
        }))
        setForms(fallback)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Live-refresh waiver statuses. waiver_submissions carries no clinic
  // column and this page's payload has no patient uuid, so there is no
  // narrow filter to build — delivery relies on its caregiver-owns_patient
  // RLS policy (own-patient rows only); the view stays server-truth via
  // load(). No form input lives on this page, so no pristine guard is
  // needed (the signing form is the separate WaiverDetail route).
  useRealtimeRefresh(userId, userId ? [
    { table: 'waiver_submissions' },
  ] : [], load)

  return (
    <>
      <PageHeader title="Consents & Waivers" />
      <div data-onboarding-key="client-waivers-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        <PageIntro
          className="hidden sm:block"
          title="Consents & Waivers"
          subtitle="Required forms, waivers, and submission status."
        />
        <WaiverSummary loading={loading} forms={forms} />
        <div data-onboarding-key="client-waivers-list" key={loading ? 'loading' : 'loaded'} className="grid w-full grid-cols-1 gap-3.5 sm:gap-5 lg:grid-cols-2 animate-content-fade-in">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 transition-colors">
                <Skeleton className="h-5 w-2/3" rounded="rounded-md" />
                <Skeleton className="mt-2 h-3 w-full" rounded="rounded-md" />
                <Skeleton className="mt-4 h-24 w-full" rounded="rounded-xl" />
              </div>
            ))
          ) : forms.length === 0 ? (
            <div className="rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors">
              No waivers or forms scheduled.
            </div>
          ) : (
            forms.map((f) => <WaiverTrackerCard key={f.code} form={f} />)
          )}
        </div>
      </div>
    </>
  )
}

function WaiverSummary({ loading, forms }) {
  const navigate = useNavigate()
  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 transition-colors">
        <Skeleton className="h-5 w-1/2" rounded="rounded-md" />
        <Skeleton className="mt-3 h-2.5 w-full" rounded="rounded-full" />
      </div>
    )
  }
  const done = forms.filter((f) => f.status === 'approved').length
  const total = forms.length
  const pct = total ? Math.round((done / total) * 100) : 0
  const next = forms.find((f) => f.status !== 'approved' && f.status !== 'submitted')
  return (
    <div className="w-full rounded-2xl border border-purple-100 dark:border-slate-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/40 dark:to-slate-900 p-4 sm:p-5 shadow-xs transition-colors animate-content-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200 transition-colors">
          {done === total && total > 0
            ? 'All documents completed'
            : `${done} of ${total} documents completed`}
        </p>
        <span className="text-[11px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 transition-colors">{pct}%</span>
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-purple-100 dark:bg-slate-800 transition-colors" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Documents completed">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      {next ? (
        <button
          type="button"
          onClick={() => navigate(`/client/waivers/${encodeURIComponent(next.code)}`)}
          className="mt-3.5 w-full rounded-lg bg-purple-600 dark:bg-purple-500 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-purple-700 dark:hover:bg-purple-400 cursor-pointer shadow-xs transition-colors text-center"
        >
          Continue: {next.title}
        </button>
      ) : (
        <p className="mt-3 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 transition-colors">
          {total > 0 ? 'Submitted documents are with the clinic team for review.' : 'No waivers or forms scheduled.'}
        </p>
      )}
    </div>
  )
}

export default Waivers
