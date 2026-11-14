import { useContext, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import SearchBar from '../../../components/ui/SearchBar'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import DatePicker from '../../../components/ui/DatePicker'
import SpedIepForm from './SpedIepForm'
import { AuthContext } from '../../../auth/AuthContext'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'
import { compareStudentsAZ, formatLastFirstMI } from '../../../lib/format'

const STATUS_META = {
  completed: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'In Progress', tone: 'bg-sky-100 text-sky-700' },
  planned: { label: 'Planned', tone: 'bg-amber-100 text-amber-700' },
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '')
const PAGE_SIZE = 5

const blankPlan = { patient_id: '', title: '', plan_date: '', status: 'planned', notes: '' }

function NewInterventionModal({ patients, onClose, onCreated }) {
  const [f, setF] = useState(blankPlan)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (!f.patient_id || !f.title) {
      setErr('Please choose a client and enter a plan title.')
      return
    }
    setBusy(true)
    try {
      await api.psychologist.addIntervention(f)
      onCreated()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New Intervention Plan"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-200 transition-colors">
            Cancel
          </button>
          <Button type="submit" form="new-intervention-form" size="lg" disabled={busy}>
            {busy ? 'Saving…' : 'Create Plan'}
          </Button>
        </div>
      }
    >
      <form id="new-intervention-form" onSubmit={submit} className="space-y-4">
        <Select label="Client" value={f.patient_id} onChange={set('patient_id')}>
          <option value="">Select a client…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{formatLastFirstMI(p) || p.name}</option>
          ))}
        </Select>
        <Input label="Plan Title" tone="purple" value={f.title} onChange={set('title')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet dark:text-purple-400">Plan Date</span>
            <DatePicker value={f.plan_date} onChange={(value) => setF((s) => ({ ...s, plan_date: value }))} ariaLabel="Plan Date" />
          </div>
          <Select label="Status" value={f.status} onChange={set('status')}>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
        <label className="block text-sm">
          <div className="font-semibold text-purple-700">Notes</div>
          <textarea
            rows={3}
            value={f.notes}
            onChange={set('notes')}
            className="mt-1 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 px-3 py-2 text-sm"
            placeholder="Goals, procedures, and approach…"
          />
        </label>
        {err ? <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div> : null}
      </form>
    </Modal>
  )
}

function Interventions() {
  const { profile } = useContext(AuthContext) ?? {}
  const [items, setItems] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [showForm, setShowForm] = useState(false)
  const [openForm, setOpenForm] = useState(false)

  const load = () =>
    api.psychologist
      .interventions()
      .then((d) => {
        setItems(d.items)
        setPatients(d.patients || [])
      })
      .catch(() => {})

  useEffect(() => {
    let on = true
    load().finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
  }, [])

  // Live-refresh the plans when they change elsewhere. interventions carries
  // no clinic_id column, so it subscribes unfiltered — RLS still delivers
  // only own-clinic assigned rows.
  const clinicId = profile?.clinic_id
  useRealtimeRefresh(
    profile?.id,
    clinicId
      ? [
          { table: 'patients', filter: `clinic_id=eq.${clinicId}` },
          { table: 'interventions' },
        ]
      : [],
    () => {
      load()
    },
  )

  const q = query.trim().toLowerCase().replace(/,/g, ' ')
  // Directory order is always A–Z by "LAST, FIRST M." (never backend order).
  const visible = (q
    ? items.filter((i) => `${i.name || ''} ${formatLastFirstMI(i)}`.toLowerCase().replace(/,/g, ' ').includes(q) || (i.title || '').toLowerCase().includes(q))
    : [...items]
  ).sort(compareStudentsAZ)
  const paged = visible.slice(0, shown)

  return (
    <>
      <StaffHeader title="Interventions" />
      <div className="flex-1 overflow-y-auto p-6">
        <section className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Master&apos;s Level Intervention</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
                All assigned clients with current Support Level and milestone completion
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenForm(true)}
                className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                Open SPED IEP Form
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                + New Plan
              </button>
            </div>
          </div>

          <div className="mt-4">
            <SearchBar
              value={query}
              onChange={(v) => {
                setQuery(v)
                setShown(PAGE_SIZE)
              }}
              placeholder="Search interventions by client or title…"
            />
          </div>
        </section>

        <div key={loading ? 'loading' : 'loaded'} className="mt-5 flex flex-col gap-4 animate-content-fade-in">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" rounded="rounded-2xl" />
            ))
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 text-sm text-slate-500 dark:text-slate-400 transition-colors">
              {q ? 'No interventions match your search.' : 'No intervention plans yet.'}
            </div>
          ) : null}
          {!loading && paged.map((i) => {
            const meta = STATUS_META[i.status] || STATUS_META.planned
            return (
            <article key={i.id} className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">{formatLastFirstMI(i) || i.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{i.title} · {fmtDate(i.date)}</div>
                  <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 transition-colors">{i.count} procedures documented</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>
                  {meta.label}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800">
                  View / Edit
                </button>
                <button className="rounded-md border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">
                  Export
                </button>
              </div>
            </article>
            )
          })}
        </div>

        {!loading && shown < visible.length ? (
          <div className="mt-5 text-center">
            <button
              onClick={() => setShown((s) => s + PAGE_SIZE)}
              className="rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              Click to View More
            </button>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <NewInterventionModal
          patients={patients}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            toast.success('Intervention plan created.')
            setShowForm(false)
            load()
          }}
        />
      ) : null}

      {openForm ? <SpedIepForm onClose={() => setOpenForm(false)} /> : null}
    </>
  )
}

export default Interventions
