import { useEffect, useMemo, useState, useImperativeHandle } from 'react'
import Button from '../../../components/ui/Button'
import Checkbox from '../../../components/ui/Checkbox'
import DatePicker from '../../../components/ui/DatePicker'
import FormHeading from '../../../components/ui/FormHeading'
import Input from '../../../components/ui/Input'
import SignaturePad from '../../../components/ui/SignaturePad'
import { SPED_CLAUSES, SPED_HOUSE_RULES } from '../../../lib/waiverClauses'
import { capitalizeName, formatPHMobile, isValidPHMobile } from '../../../lib/format'

const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const cleanText = (value, limit) => String(value || '').slice(0, limit)
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, '')
const statusTone = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800'
  if (status === 'submitted') return 'bg-sky-100 text-sky-800'
  if (status === 'overdue') return 'bg-rose-100 text-rose-800'
  if (status === 'not_started') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 transition-colors'
  return 'bg-amber-100 text-amber-800'
}

function ComplianceAnswerForm({ row, onSubmit, ref }) {
  const clauses = SPED_CLAUSES
  const rules = SPED_HOUSE_RULES
  const stored = row.provisions_agreed || {}
  const storedAcknowledgements = stored.acknowledgements || {}

  const isAdmission = row.code === 'CMPS:SE-FO-01'
  const isClientSubmitted = row.status === 'submitted' || row.status === 'approved'

  const requiredKeys = useMemo(
    () => isAdmission ? [] : [
      ...clauses.map((_, index) => `clause_${index}`),
      ...rules.map((_, index) => `rule_${index}`),
    ],
    [clauses, rules, isAdmission],
  )

  const [acknowledgements, setAcknowledgements] = useState(() => {
    if (isClientSubmitted) {
      return Object.fromEntries(requiredKeys.map((key) => [key, true]))
    }
    return storedAcknowledgements
  })
  const [form, setForm] = useState({
    parent_name: stored.parent_name || row.parent || '',
    child_name: stored.child_name || row.student || '',
    parent_contact: stored.parent_contact || '',
    parent_date: stored.parent_date?.slice?.(0, 10) || today(),
    signature_image: stored.signature_image || null,
    // Representative names come from hand-typed staff records, so a lowercase
    // display_name would leak into the printed waiver. Normalize on load.
    rep_name: capitalizeName(stored.rep_name || row.treating_psychometrician_name || ''),
    rep_contact: stored.rep_contact || '',
    rep_date: stored.rep_date?.slice?.(0, 10) || today(),
    rep_signature_image: stored.rep_signature_image || null,
  })
  const [notes, setNotes] = useState(row.answer_notes || row.notes || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const nextStored = row.provisions_agreed || {}
    const isNowSubmitted = row.status === 'submitted' || row.status === 'approved'
    setAcknowledgements(isNowSubmitted ? Object.fromEntries(requiredKeys.map((key) => [key, true])) : (nextStored.acknowledgements || {}))
    setForm({
      parent_name: nextStored.parent_name || row.parent || '',
      child_name: nextStored.child_name || row.student || '',
      parent_contact: nextStored.parent_contact || '',
      parent_date: nextStored.parent_date?.slice?.(0, 10) || today(),
      signature_image: nextStored.signature_image || null,
      rep_name: capitalizeName(nextStored.rep_name || row.treating_psychometrician_name || ''),
      rep_contact: nextStored.rep_contact || '',
      rep_date: nextStored.rep_date?.slice?.(0, 10) || today(),
      rep_signature_image: nextStored.rep_signature_image || null,
    })
    setNotes(row.answer_notes || row.notes || '')
    setError('')
  }, [row, requiredKeys])

  const setField = (key, value, limit = 100) => {
    setForm((current) => ({ ...current, [key]: limit ? cleanText(value, limit) : value }))
  }

  const toggle = (key) => {
    setAcknowledgements((current) => ({ ...current, [key]: !current[key] }))
  }

  const acknowledgeAll = () => {
    setAcknowledgements(Object.fromEntries(requiredKeys.map((key) => [key, true])))
  }

  const save = () => {
    setError('')
    const unacknowledgedKey = requiredKeys.find((key) => acknowledgements[key] !== true)
    if (unacknowledgedKey) {
      setError('Please acknowledge every provision and house rule.')
      document.getElementById(`ack-${unacknowledgedKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const requiredFields = [
      ['parent_name', 'Parent / guardian name'],
      ['child_name', 'Student name'],
      ['parent_contact', 'Parent contact number'],
      ['parent_date', 'Parent signature date'],
      ['rep_name', 'CMPS representative name'],
      ['rep_contact', 'CMPS representative contact number'],
      ['rep_date', 'CMPS representative signature date'],
    ]
    
    // For admission form, the client parent contact number was skipped. Let's not fail on it.
    if (isAdmission) {
      const idx = requiredFields.findIndex(f => f[0] === 'parent_contact')
      if (idx !== -1) requiredFields.splice(idx, 1)
    }

    
      const phones = [
        ['Parent contact number', 'parent_contact', form.parent_contact],
        ['CMPS representative contact number', 'rep_contact', form.rep_contact]
      ]
      for (const [label, fieldKey, num] of phones) {
        if (num && !isValidPHMobile(num)) {
          setError(`${label} must be a valid Philippine mobile number (e.g. 0917 123 4567).`)
          const el = document.getElementById(`field-${fieldKey}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
          }
          return
        }
      }
      
      const missing = requiredFields.find(([key]) => !String(form[key] || '').trim())
    if (missing) {
      setError(`${missing[1]} is required.`)
      const el = document.getElementById(`field-${missing[0]}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
      }
      return
    }
    if (!form.signature_image) {
      setError('Parent / Guardian signature is required.')
      document.getElementById('field-signature_image')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!form.rep_signature_image) {
      setError('CMPS representative signature is required.')
      document.getElementById('field-rep_signature_image')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    onSubmit({
      status: 'approved',
      notes: notes.trim(),
      house_rules_agreed: true,
      signature_text: form.parent_name.trim(),
      provisions_agreed: {
        ...form,
        parent_name: form.parent_name.trim(),
        child_name: form.child_name.trim(),
        parent_contact: form.parent_contact.trim(),
        rep_name: form.rep_name.trim(),
        rep_contact: form.rep_contact.trim(),
        acknowledgements,
      },
    })
  }

  useImperativeHandle(ref, () => ({ save }))

  const clauseBlocks = clauses.map((clause, index) => ({
    ...clause,
    key: `clause_${index}`,
    title: `${clause.numeral ? `${clause.numeral}. ` : ''}${clause.title}`,
  }))
  const ruleBlocks = rules.map((rule, index) => ({
    ...rule,
    key: `rule_${index}`,
    title: rule.title,
  }))

  const completed = requiredKeys.filter((key) => acknowledgements[key] === true).length
  const isComplete = completed === requiredKeys.length && requiredKeys.length > 0
  const renderBody = (blocks) =>
    blocks.map((block) => {
      const content = Array.isArray(block.body)
        ? block.body
            .map((item) => {
              if (typeof item === 'string') return stripHtml(item)
              if (item.p) return stripHtml(item.p)
              if (item.list) return item.list.join(', ')
              return ''
            })
            .join(' ')
        : block.text
      const key = block.key
      const acknowledged = acknowledgements[key] === true
      return (
        <article id={`ack-${key}`} key={key} className={`rounded-xl border p-4 transition-colors ${acknowledged ? 'border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/30' : 'border-slate-200 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors'}`}>
          <div className="text-[13px] font-bold text-slate-800 dark:text-slate-100 transition-colors">{block.title}</div>
          <div className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 transition-colors">{content}</div>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox
              label={isClientSubmitted ? "Client has read and acknowledged" : "Read, understood, and acknowledged"}
              checked={acknowledged}
              onChange={() => toggle(key)}
              disabled={isClientSubmitted}
            />
          </div>
        </article>
      )
    })

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #compliance-answer-print, #compliance-answer-print * { visibility: visible !important; }
          #compliance-answer-print {
            position: relative !important;
            width: 8.5in !important;
            min-height: 13in !important;
            margin: 0 !important;
            background-color: #fff !important;
            background-image: url('/cmps-form-template.png') !important;
          }
        }
      `}</style>
      <div id="compliance-answer-print" className="cmps-print-document cmps-print-page mx-auto max-w-4xl space-y-5">
      <section className="sticky top-0 z-20 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-bold text-purple-900">{row.doc}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
              {row.code} · {row.student}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusTone(row.status)}`}>
              {row.label || row.status}
            </span>
            {!isAdmission && (
              <div className="text-sm font-semibold text-purple-700">
                {completed}/{requiredKeys.length} acknowledged
              </div>
            )}
          </div>
        </div>
        {!isAdmission && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-purple-100">
            <div
              className="h-full rounded-full bg-purple-700 transition-all"
              style={{ width: `${requiredKeys.length ? (completed / requiredKeys.length) * 100 : 0}%` }}
            />
          </div>
        )}
      </section>

      {!isAdmission && (
        <>
          <section className="space-y-3 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <FormHeading numeral="1">Provisions &amp; Agreements</FormHeading>
              {!isClientSubmitted && (
                <button
                  type="button"
                  onClick={acknowledgeAll}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                >
                  Acknowledge all
                </button>
              )}
            </div>
            {renderBody(clauseBlocks)}
          </section>

          <section className="space-y-3 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <FormHeading numeral="2">Clinic House Rules</FormHeading>
            {renderBody(ruleBlocks)}
          </section>
        </>
      )}

      <section className="space-y-4 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
        <FormHeading numeral={isAdmission ? "1" : "3"}>Signatures &amp; Acknowledgement</FormHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="field-parent_name"
            label="Parent / Guardian Full Name"
            tone="purple"
            maxLength={100}
            value={form.parent_name}
            onChange={(event) => setField('parent_name', event.target.value)}
            disabled={isClientSubmitted}
          />
          <Input
            id="field-child_name"
            label="Student Full Name"
            tone="purple"
            maxLength={100}
            value={form.child_name}
            onChange={(event) => setField('child_name', event.target.value)}
            disabled={isClientSubmitted}
          />
          <Input
            id="field-parent_contact"
            label="Parent Contact Number"
            tone="purple"
            maxLength={13}
            inputMode="numeric"
            placeholder="09** *** ****"
            value={form.parent_contact}
            onChange={(event) => setField('parent_contact', formatPHMobile(event.target.value), 13)}
            disabled={isClientSubmitted}
          />
          <div id="field-parent_date" className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet dark:text-purple-400">Date</span>
            <DatePicker
              value={form.parent_date}
              onChange={(value) => setField('parent_date', value, 10)}
              disabled={isClientSubmitted}
              ariaLabel="Parent signature date"
            />
          </div>
        </div>
        <div id="field-signature_image">
          <SignaturePad
            label="Parent / Guardian Signature"
            value={form.signature_image}
            onChange={(value) => setField('signature_image', value, 0)}
            disabled={isClientSubmitted}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
        <FormHeading numeral="4">CMPS Representative</FormHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="field-rep_name"
            label="Representative Name"
            tone="purple"
            maxLength={100}
            value={form.rep_name}
            onChange={(event) => setField('rep_name', event.target.value)}
          />
          <Input
            id="field-rep_contact"
            label="Contact Number"
            tone="purple"
            maxLength={13}
            inputMode="numeric"
            placeholder="09** *** ****"
            value={form.rep_contact}
            onChange={(event) => setField('rep_contact', formatPHMobile(event.target.value), 13)}
          />
          <div id="field-rep_date" className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet dark:text-purple-400">Date</span>
            <DatePicker
              value={form.rep_date}
              onChange={(value) => setField('rep_date', value, 10)}
              ariaLabel="Representative signature date"
            />
          </div>
        </div>
        <div id="field-rep_signature_image">
          <SignaturePad
            label="CMPS Representative Signature"
            value={form.rep_signature_image}
            onChange={(value) => setField('rep_signature_image', value, 0)}
          />
        </div>
      </section>

      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
      </div>
    </>
  )
}

export default ComplianceAnswerForm
