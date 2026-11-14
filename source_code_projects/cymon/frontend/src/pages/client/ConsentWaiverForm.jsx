import { useState } from 'react'
import FormShell from '../../components/ui/FormShell'
import DatePicker from '../../components/ui/DatePicker'
import FormHeading from '../../components/ui/FormHeading'
import FormBrandHeader from '../../components/ui/FormBrandHeader'
import Checkbox from '../../components/ui/Checkbox'
import SignaturePad from '../../components/ui/SignaturePad'
import Button from '../../components/ui/Button'
import ClientSubmissionConfirmation from '../../components/ui/ClientSubmissionConfirmation'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { api } from '../../lib/api'
import { toast } from 'react-hot-toast'
import { formatPHMobile, isValidPHMobile } from '../../lib/format'
import { SPED_CLAUSES, SPED_HOUSE_RULES } from '../../lib/waiverClauses'

const CLAUSES = SPED_CLAUSES
const HOUSE_RULES = SPED_HOUSE_RULES
const FORM_CODE = 'CMPS:SE-FO-02 rev.0 02192026'

function ConsentWaiverForm({ onClose }) {
  const [checked, setChecked] = useState({})
  const [parentName, setParentName] = useState('')
  const [childName, setChildName] = useState('')
  const [parentContact, setParentContact] = useState('')
  const [repName, setRepName] = useState('')
  const [repContact, setRepContact] = useState('')
  const [parentSig, setParentSig] = useState(null)
  const [parentDate, setParentDate] = useState('')
  const [repSig, setRepSig] = useState(null)
  const [repDate, setRepDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const totalItems = CLAUSES.length + HOUSE_RULES.length
  const doneItems = Object.values(checked).filter(Boolean).length

  const toggle = (i) => setChecked((c) => ({ ...c, [i]: !c[i] }))

  const handleSubmit = () => {
    setError(null)
    if (doneItems < totalItems) {
      setError('Please read and acknowledge all sections before submitting.')
      return
    }
    
      if (parentContact && !isValidPHMobile(parentContact)) {
        setError('Parent contact must be a valid Philippine mobile number (e.g. 0917 123 4567).')
        return
      }
      if (repContact && !isValidPHMobile(repContact)) {
        setError('CMPS rep contact must be a valid Philippine mobile number (e.g. 0917 123 4567).')
        return
      }
      if (!parentSig) {
      setError('Parent/guardian e-signature is required.')
      return
    }

    setConfirmingSubmit(true)
  }

  const submitWaiver = async () => {
    setSubmitting(true)
    try {
      await api.client.submitWaiver('CMPS:SE-FO-02', {
        provisions_agreed: { ...checked },
        house_rules_agreed: true,
        parent_name: parentName,
        child_name: childName,
        signature_text: parentName,
        parent_contact: parentContact,
        parent_sig: parentSig,
        parent_date: parentDate,
        rep_name: repName,
        rep_contact: repContact,
        rep_sig: repSig,
        rep_date: repDate,
      })
      toast.success('Consent and waiver form submitted successfully.')
      setConfirmingSubmit(false)
      onClose()
    } catch (e) {
      setConfirmingSubmit(false)
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setChecked({})
    setParentName(''); setChildName(''); setParentContact(''); setRepName(''); setRepContact('')
    setParentSig(null); setParentDate(''); setRepSig(null); setRepDate('')
    setConfirmingReset(false)
  }

  const clauseSection = (clauses, offset) =>
    clauses.map((c, idx) => {
      const i = offset + idx
      return (
        <section
          key={c.title}
          className="break-inside-avoid rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors"
        >
          <FormHeading numeral={c.numeral}>{c.title}</FormHeading>
          {c.body.map((p, j) => (
            <p key={j} className="mb-2 text-[13.5px] leading-6 text-slate-700 dark:text-slate-300 transition-colors">
              {p}
            </p>
          ))}
          <div className="mt-3 flex rounded-xl bg-[#F5F1FA] dark:bg-slate-800/50 px-3 py-2 transition-colors">
            <Checkbox
              checked={!!checked[i]}
              onChange={() => toggle(i)}
              label={`I have read, understood, and agree to the terms as cited in ${c.numeral ? `Item ${c.numeral}.` : 'this document.'}`}
              className="text-xs font-semibold text-[#38224F] dark:text-purple-300 transition-colors"
            />
          </div>
        </section>
      )
    })

  const getPages = () => [
    <div key="page-1" className="space-y-4">
      <FormBrandHeader code={FORM_CODE} />
      <div className="text-center pt-1">
        <div className="text-[23px] font-semibold text-[#38224F] dark:text-purple-300 transition-colors" style={{ fontFamily: 'Fraunces, serif' }}>
          Special Education (SPED) Program
        </div>
        <div className="text-[13px] text-slate-500 dark:text-slate-400 transition-colors">Parent/Caregiver Consent and Waiver Form</div>
      </div>

      <div className="rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <span className="font-semibold text-[#8B6BAE] dark:text-purple-400 transition-colors">Acknowledgment status</span>
          <span>{doneItems}/{totalItems} items acknowledged</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
          <div className={`h-full rounded-full transition-all duration-500 ${doneItems >= totalItems ? 'bg-emerald-500' : 'bg-purple-700 dark:bg-purple-500'}`} style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} />
        </div>
        {doneItems >= totalItems ? <div className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors">✓ All sections have been read and acknowledged</div> : null}
      </div>
      {clauseSection(CLAUSES.slice(0, 4), 0)}
    </div>,
    <div key="page-2" className="space-y-4">
      {clauseSection(CLAUSES.slice(4), 4)}
    </div>,
    <div key="page-3" className="space-y-4">
      <FormHeading numeral="">Cymon&rsquo;s House Rules</FormHeading>
      {clauseSection(HOUSE_RULES.map((r, i) => ({ numeral: `${i + 10}`, title: r.title, body: [r.text] })), CLAUSES.length)}

      <h2 className="mt-6 text-center text-base font-bold uppercase tracking-wide text-[#8B6BAE] dark:text-purple-400 transition-colors">
        Parent/Caregiver Acknowledgement Form
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300 transition-colors">
        I, <strong>{parentName || '______________________'}</strong>, the parent/legal guardian of{' '}
        <strong>{childName || '______________________'}</strong>, hereby voluntarily enroll my child
        in the Special Education (SPED) Program of{' '}
        <span className="font-bold underline">CLEARMIND PSYCHOLOGICAL SERVICES</span>.
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300 transition-colors">
        By signing below, I affirm that I have read and understood the contents of this consent and waiver form and voluntarily agree to its terms.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E4DCEF] dark:border-slate-800 bg-[#FCFAFF] dark:bg-slate-900/50 p-4 transition-colors">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Parent / Guardian</div>
          <input type="text" placeholder="Full Name" className="mb-2 w-full rounded-md border border-[#E4DCEF] dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/80 px-2.5 py-1.5 text-sm transition-colors" value={parentName} onChange={(e) => setParentName(e.target.value)} />
          <input type="tel" placeholder="09** *** ****" inputMode="numeric" maxLength={13} className="mb-2 w-full rounded-md border border-[#E4DCEF] dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/80 px-2.5 py-1.5 text-sm transition-colors" value={parentContact} onChange={(e) => setParentContact(formatPHMobile(e.target.value))} />
          <SignaturePad label="Signature" value={parentSig} onChange={setParentSig} />
          <DatePicker className="mt-2 w-full" value={parentDate} onChange={(v) => setParentDate(v)} ariaLabel="Parent signing date" />
        </div>
        <div className="rounded-xl border border-[#E4DCEF] dark:border-slate-800 bg-[#FCFAFF] dark:bg-slate-900/50 p-4 transition-colors">
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">CMPS Representative</div>
          <input type="text" placeholder="Representative Name" className="mb-2 w-full rounded-md border border-[#E4DCEF] dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/80 px-2.5 py-1.5 text-sm transition-colors" value={repName} onChange={(e) => setRepName(e.target.value)} />
          <input type="tel" placeholder="09** *** ****" inputMode="numeric" maxLength={13} className="mb-2 w-full rounded-md border border-[#E4DCEF] dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/80 px-2.5 py-1.5 text-sm transition-colors" value={repContact} onChange={(e) => setRepContact(formatPHMobile(e.target.value))} />
          <SignaturePad label="Signature" value={repSig} onChange={setRepSig} />
          <DatePicker className="mt-2 w-full" value={repDate} onChange={(v) => setRepDate(v)} ariaLabel="Representative signing date" />
        </div>
      </div>

      {error ? <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 transition-colors">{error}</div> : null}

      <div className="flex items-center justify-end gap-3 mt-4 print:hidden">
        <Button variant="outline" disabled>Save form to enable official PDF</Button>
        <Button variant="outline" onClick={() => setConfirmingReset(true)}>↺ Reset form</Button>
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Acknowledgement'}</Button>
      </div>
    </div>,
  ]

  return (
    <>
      <ClientSubmissionConfirmation
        open={confirmingSubmit}
        onCancel={() => setConfirmingSubmit(false)}
        onConfirm={submitWaiver}
        submitting={submitting}
        title="Confirm SPED consent submission"
        confirmLabel="Yes, submit consent"
      />
      {confirmingReset ? (
        <ConfirmDialog
          title="Reset Form?"
          message="Are you sure you want to clear all responses and patient info?"
          confirmLabel="Yes"
          cancelLabel="No"
          tone="red"
          onClose={() => setConfirmingReset(false)}
          onConfirm={resetAll}
        />
      ) : null}
      <FormShell
        title="Special Education (SPED) Program"
        subtitle="Parent/Caregiver Consent and Waiver Form"
        code="CMPS:SE-FO-02 rev.0 02192026"
        confidential={false}
        onClose={onClose}
        multiPage={true}
      >
        {getPages()}
      </FormShell>
    </>
  )
}

export default ConsentWaiverForm

