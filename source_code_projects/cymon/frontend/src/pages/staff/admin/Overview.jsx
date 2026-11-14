import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffHeader from '../StaffHeader'
import Skeleton, { SkeletonStatCard } from '../../../components/ui/Skeleton'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import { shortBranchName } from '../../../lib/branches'
import { useAuth } from '../../../auth/useAuth'
import { api } from '../../../lib/api'
import { Users, FileCheck, Calendar as CalendarIcon } from 'lucide-react'

// Recharts is heavy and only used by the chart panels below the fold, so it
// loads in its own chunk after the metric cards have painted (LCP).
const OverviewCharts = lazy(() => import('./OverviewCharts'))

const SEVERITY_META = {
  info: { label: 'INFO', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  warn: { label: 'WARNING', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  alert: { label: 'ALERT', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  warning: { label: 'WARNING', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { label: 'CRITICAL', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

const MetricCard = ({ title, value, subtitle, onClick, actionLabel = 'Open' }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full relative overflow-hidden rounded-3xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300"
  >
    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-purple-50 to-fuchsia-50 opacity-50 blur-xl transition-opacity group-hover:opacity-100" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-widest text-purple-400">{title}</div>
        <div className="mt-2 text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100 transition-colors">{value}</div>
        {subtitle ? <div className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">{subtitle}</div> : null}
      </div>
      {onClick ? (
        <span className="rounded-full border border-purple-100 bg-white dark:bg-slate-900 transition-colors px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 shadow-sm transition-colors group-hover:border-purple-300 group-hover:bg-purple-50">
          {actionLabel}
        </span>
      ) : null}
    </div>
  </button>
)

export const Panel = ({ title, subtitle, icon: Icon, children, className = '' }) => (
  <section className={`rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors/60 bg-white dark:bg-slate-900 transition-colors p-6 shadow-sm ${className}`}>
    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 transition-colors pb-4">
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 transition-colors">
          <Icon size={20} />
        </div>
      )}
      <div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">{subtitle}</div> : null}
      </div>
    </div>
    <div>{children}</div>
  </section>
)

// Skeleton stand-ins for the lazily loaded chart panels.
const ChartsSkeleton = () => (
  <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <Panel title="Student Distribution" subtitle="Breakdown of student statuses" icon={Users}>
      <div className="flex h-64 items-center justify-center">
        <Skeleton className="h-48 w-48" rounded="rounded-full" />
      </div>
    </Panel>
    <Panel title="Compliance Health" subtitle="Waivers & documents status" icon={FileCheck}>
      <div className="flex h-64 items-center justify-center">
        <Skeleton className="h-48 w-48" rounded="rounded-full" />
      </div>
    </Panel>
    <Panel title="Upcoming Schedule" subtitle="Sessions in the next 7 days" icon={CalendarIcon}>
      <div className="flex h-64 w-full items-end justify-center gap-6 pb-2">
        <Skeleton className="h-24 w-20" rounded="rounded-t-md" />
        <Skeleton className="h-40 w-20" rounded="rounded-t-md" />
      </div>
    </Panel>
  </div>
)

function Overview() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api.admin
      .overview(branchFilter)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [branchFilter])

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((d) => setBranchOptions(d?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const snapshot = data?.snapshot || {}
  const students = snapshot.students || {}
  const staff = snapshot.staff || {}
  const compliance = snapshot.compliance || {}
  const schedule = snapshot.schedule || {}
  const recentAudit = (data?.recentAudit || data?.activity || []).slice(0, 4)

  const stats = useMemo(
    () => [
      {
        title: 'Students',
        value: students.active ?? data?.stats?.totalActive ?? '—',
        subtitle: `${students.newThisMonth ?? 0} new this month · ${students.pending ?? data?.stats?.pendingAdmissions ?? 0} pending`,
        onClick: () => navigate('/admin/patients'),
      },
      {
        title: 'Staff',
        value: staff.total ?? '—',
        subtitle: `${staff.total ?? 0} total staff`,
        onClick: () => navigate('/admin/employees'),
      },
      {
        title: 'Compliance',
        value: compliance.needsAction ?? data?.stats?.waiversMissing ?? '—',
        subtitle: `${compliance.overdue ?? 0} overdue · ${compliance.pendingSignature ?? 0} pending signature`,
        onClick: () => navigate('/admin/compliance'),
      },
    ],
    [
      compliance.needsAction,
      compliance.overdue,
      compliance.pendingSignature,
      data?.stats?.pendingAdmissions,
      data?.stats?.totalActive,
      data?.stats?.waiversMissing,
      navigate,
      staff.total,
      students.active,
      students.newThisMonth,
      students.pending,
    ]
  )

  // --- Chart Data Formatting ---
  const inactiveStudents = Math.max(0, (students.total || 0) - (students.active || 0) - (students.pending || 0));
  
  const studentData = [
    { name: 'Active', value: students.active || 0, color: '#8b5cf6' }, // purple-500
    { name: 'Pending', value: students.pending || 0, color: '#f59e0b' }, // amber-500
    { name: 'Inactive', value: inactiveStudents, color: '#64748b' }, // slate-500
  ].filter(d => d.value > 0);

  const complianceData = [
    { name: 'Approved', value: compliance.approved || 0, color: '#10b981' }, // emerald-500
    { name: 'Submitted', value: compliance.submitted || 0, color: '#0ea5e9' }, // sky-500
    { name: 'Pending Sig', value: compliance.pendingSignature || 0, color: '#f59e0b' }, // amber-500
    { name: 'Overdue', value: compliance.overdue || 0, color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  const scheduleData = [
    { name: 'Group', Upcoming: schedule.group || 0, fill: '#8b5cf6' },
    { name: 'Individual', Upcoming: schedule.individual || 0, fill: '#ec4899' },
  ];

  return (
    <>
      <StaffHeader title="Dashboard Overview" />

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors/50 p-4 sm:p-8" data-onboarding-key="overview-workspace">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 transition-colors">Dashboard Overview</h1>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 transition-colors max-w-3xl">
              A real-time snapshot of clinic operations, student enrollment, compliance status, and upcoming appointments.
            </div>
          </div>
          {isSuperAdmin && branchOptions.length > 1 ? (
            <AnimatedSelect
              value={branchFilter || 'all'}
              onChange={(val) => setBranchFilter(val === 'all' ? '' : val)}
              options={[
                { value: 'all', label: 'All Branches' },
                ...branchOptions.map((b) => ({ value: b.id, label: shortBranchName(b) })),
              ]}
            />
          ) : null}
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 shadow-sm">{error}</div>
        ) : null}

        <div key={loading ? 'metrics-loading' : 'metrics-loaded'} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 animate-content-fade-in" data-onboarding-key="overview-metrics">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <SkeletonStatCard key={`metric-${i}`} />
              ))
            : stats.map((card) => (
                <MetricCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  subtitle={card.subtitle}
                  onClick={card.onClick}
                />
              ))}
        </div>

        {loading ? (
          <ChartsSkeleton />
        ) : !error && (
          <div key="charts-loaded" className="animate-content-fade-in">
          <Suspense fallback={<ChartsSkeleton />}>
            <OverviewCharts
              studentData={studentData}
              complianceData={complianceData}
              scheduleData={scheduleData}
            />
          </Suspense>
          </div>
        )}

        <div className="mt-8" data-onboarding-key="overview-audit">
          <Panel title="Recent Audit Trail" subtitle="A short log of the latest state-changing activity.">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 space-y-2">
                    <Skeleton className="h-4 w-full" rounded="rounded-md" />
                    <Skeleton className="h-3 w-2/3" rounded="rounded-md" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-14" rounded="rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentAudit.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors/50 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors animate-content-fade-in">
                No audit activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3 animate-content-fade-in">
                {recentAudit.map((entry) => {
                  const sev = SEVERITY_META[entry.severity] || SEVERITY_META.info
                  return (
                    <div key={entry.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors/60 bg-white dark:bg-slate-900 transition-colors p-4 transition-all hover:border-purple-200 dark:border-slate-700 transition-colors hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors">{entry.summary}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">
                            <span className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5">
                              {entry.actor || 'System'}
                            </span>
                            <span>·</span>
                            <span>{fmtDateTime(entry.created_at)}</span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm ${sev.cls}`}
                        >
                          {sev.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

export default Overview
