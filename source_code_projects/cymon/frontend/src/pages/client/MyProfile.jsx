import { useEffect, useState } from 'react'
import PageHeader from './PageHeader'
import { api } from '../../lib/api'
import { passwordError } from '../../lib/password'
import PasswordChecklist from '../../components/ui/PasswordChecklist'
import Skeleton from '../../components/ui/Skeleton'
import ClientSubmissionConfirmation from '../../components/ui/ClientSubmissionConfirmation'

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-white">
    {children}
  </span>
)

const Field = ({ label, value, tone = 'default', loading = false }) => {
  const displayValue = (!loading && (value == null || value === '')) ? 'Not specified' : value
  return (
    <div>
      <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      {loading ? (
        <Skeleton className="mt-1 h-4 w-24" />
      ) : (
        <div
          className={[
            'text-xs sm:text-sm font-semibold transition-opacity duration-300',
            (value == null || value === '') ? 'text-slate-400 dark:text-slate-500 italic font-normal' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-purple-900 dark:text-purple-300',
          ].join(' ')}
        >
          {displayValue}
        </div>
      )}
    </div>
  )
}

const Card = ({ title, action, children }) => (
  <section className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-xs border border-purple-100/60 dark:border-slate-800 transition-colors duration-300">
    <div className="flex items-center justify-between border-b border-purple-50 dark:border-slate-800 pb-2.5">
      <div className="text-xs sm:text-sm font-bold text-purple-800 dark:text-purple-300">{title}</div>
      {action}
    </div>
    <div className="pt-3">{children}</div>
  </section>
)

const SettingsRow = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between border-b border-purple-50 dark:border-slate-800 py-2.5 last:border-0">
    <div>
      <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
      <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
    </div>
    {action}
  </div>
)

const PasswordField = ({ label, value, onChange, visible, onToggle, placeholder }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        // Passwords must be typed, not pasted or dropped in — matches the
        // shared Input primitive so confirm fields prove what was typed.
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        title="For security, please type your password instead of pasting it."
        className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-14 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-0 rounded-r-lg border-l border-slate-200 dark:border-slate-700 px-3 text-xs font-bold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 transition-colors"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  </div>
)

const longDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null
const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null

// System-generated logins (noemail_...@placeholder.local) must never be shown
// to families — render them as unspecified instead.
const isPlaceholderEmail = (email) =>
  !email || email.startsWith('noemail_') || email.endsWith('@placeholder.local')

const initialsOf = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

function MyProfile() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwVisible, setPwVisible] = useState({ current: false, next: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)
  const [confirmingPasswordChange, setConfirmingPasswordChange] = useState(false)

  useEffect(() => {
    api.client
      .getPatient()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <>
        <PageHeader title="My Profile" />
        <div className="flex-1 p-3.5 sm:p-6">
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800 border border-amber-200">{error}</div>
        </div>
      </>
    )
  }

  const { patient, clinical, guardian, guardians, emergency, clinic } = data || {}
  const sexLabel = patient?.sex ? patient.sex[0].toUpperCase() + patient.sex.slice(1) : null
  const mother = (guardians || []).find((g) => g.relationship === 'Mother')
  const father = (guardians || []).find((g) => g.relationship === 'Father')

  const changePassword = () => {
    setPwMsg(null)
    const err = passwordError(pw.next)
    if (err) {
      setPwMsg({ type: 'error', text: err })
      return
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setConfirmingPasswordChange(true)
  }

  const confirmPasswordChange = async () => {
    setPwSaving(true)
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.next })
      setPw({ current: '', next: '', confirm: '' })
      setPwVisible({ current: false, next: false, confirm: false })
      setPwOpen(false)
      setConfirmingPasswordChange(false)
      setPwMsg({ type: 'success', text: 'Password updated.' })
    } catch (e) {
      setConfirmingPasswordChange(false)
      setPwMsg({ type: 'error', text: e.message })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <>
      <ClientSubmissionConfirmation
        open={confirmingPasswordChange}
        onCancel={() => setConfirmingPasswordChange(false)}
        onConfirm={confirmPasswordChange}
        submitting={pwSaving}
        title="Confirm password update"
        confirmLabel="Yes, update password"
      />
      <PageHeader title="My Profile" />
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-purple-800 dark:from-[#2a1065] dark:to-[#3b1a7a] transition-colors duration-300 p-4 sm:p-6 text-white shadow-xs">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-20 h-32 w-32 rounded-full bg-white/5" />
          <div className="relative flex flex-row items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 text-base sm:text-xl font-bold">
              {loading ? (
                ''
              ) : patient?.photo_url ? (
                <img src={patient.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(patient?.full_name)
              )}
            </div>
            {loading ? (
              <div>
                <div className="h-6 w-36 rounded-md bg-white/25 animate-pulse" />
                <div className="mt-2 h-3 w-24 rounded bg-white/20 animate-pulse" />
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="text-lg sm:text-2xl font-bold truncate">{patient?.full_name}</div>
                <div className="text-[10px] sm:text-xs opacity-80 font-medium">Patient ID: {patient?.patient_id}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {clinical?.iep_level ? <Pill>{clinical.iep_level}</Pill> : null}
                  {clinic?.name ? <Pill>{clinic.name}</Pill> : null}
                  {clinical?.treating_psychologist_name ? (
                    <Pill>{clinical.treating_psychologist_name}</Pill>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="rounded-xl bg-purple-50/80 dark:bg-purple-900/30 px-3.5 py-2.5 text-xs text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-800/50 transition-colors">
          To update your personal details, please contact the ClearMind clinic administration.
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:gap-5 lg:grid-cols-2">
          <Card title="Personal Information">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <Field loading={loading} label="Full Name" value={patient?.full_name} />
              <Field loading={loading} label="Patient ID" value={patient?.patient_id} />
              <Field loading={loading} label="Date of Birth" value={longDate(patient?.date_of_birth)} />
              <Field loading={loading} label="Age" value={patient?.age != null ? `${patient.age} years old` : null} />
              <Field loading={loading} label="Sex" value={sexLabel} />
              <Field loading={loading} label="Nickname" value={patient?.nick_name} />
              <Field loading={loading} label="Place of Birth" value={patient?.place_of_birth} />
              <Field loading={loading} label="Citizenship" value={patient?.citizenship} />
              <Field loading={loading} label="Religion" value={patient?.religion} />
              <Field loading={loading} label="Contact" value={patient?.contact_number} />
              <Field loading={loading} label="Present Address" value={patient?.home_address} />
              <Field loading={loading} label="Permanent Address" value={patient?.permanent_address || 'Same as present address'} />
            </div>
          </Card>

          <Card title="Clinical Information">
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <Field loading={loading} label="Chief Complaint" value={clinical?.chief_complaint} />
              <Field loading={loading} label="Working Diagnosis" value={clinical?.working_diagnosis} />
              <Field
                loading={loading}
                label="Diagnosis"
                value={clinical?.primary_diagnosis || clinical?.working_diagnosis}
              />
              <Field loading={loading} label="Secondary Diagnosis" value={clinical?.secondary_diagnosis} />
              <Field loading={loading} label="Allergies" value={clinical?.allergies} />
              <Field loading={loading} label="IEP Level" value={clinical?.iep_level} />
              <Field loading={loading} label="Assigned Psychologist" value={clinical?.treating_psychologist_name} />
              <Field loading={loading} label="Assigned Psychometrician" value={clinical?.treating_psychometrician_name} />
              <Field loading={loading} label="Clinic" value={clinic?.name} />
              <Field loading={loading} label="Date Enrolled" value={shortDate(clinical?.date_enrolled) || shortDate(patient?.created_at)} />
              <Field loading={loading} label="Last Assessment" value={shortDate(clinical?.last_assessment_at)} />
              <Field loading={loading} label="Next Review" value={shortDate(clinical?.next_review_at)} />
            </div>
          </Card>

          <Card title="Guardian & Emergency Contact">
            <div className="space-y-3.5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Mother / Guardian</div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <Field loading={loading} label="Name" value={mother?.full_name || guardian?.full_name} />
                <Field loading={loading} label="Occupation" value={mother?.occupation || guardian?.occupation} />
                <Field loading={loading} label="Contact" value={mother?.contact_number || guardian?.contact_number} />
                <Field loading={loading} label="Email" value={mother?.email || guardian?.email} />
              </div>
              <div className="border-t border-purple-50 dark:border-slate-800 pt-2.5 transition-colors">
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Father / Guardian</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <Field loading={loading} label="Name" value={father?.full_name} />
                <Field loading={loading} label="Occupation" value={father?.occupation} />
                <Field loading={loading} label="Contact" value={father?.contact_number} />
                <Field loading={loading} label="Email" value={father?.email} />
              </div>
              <div className="border-t border-purple-50 dark:border-slate-800 pt-2.5 transition-colors">
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Emergency Contact</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <Field loading={loading} label="Name" value={emergency?.full_name} />
                <Field loading={loading} label="Relationship" value={emergency?.relationship} />
                <Field loading={loading} label="Contact" value={emergency?.contact_number} />
              </div>
            </div>
          </Card>

          <Card title="Account Settings">
            <div className="border-b border-purple-50 dark:border-slate-800 pb-3 transition-colors">
              <Field
                loading={loading}
                label="Account Email"
                value={isPlaceholderEmail(data?.caregiver?.email) ? '' : data?.caregiver?.email}
              />
            </div>
            <SettingsRow
              title="Change Password"
              subtitle="Keep your account secure"
              action={
                <button
                  onClick={() => {
                    setPwMsg(null)
                    setPwOpen((o) => !o)
                  }}
                  className="rounded-lg border border-purple-200 dark:border-purple-700 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  {pwOpen ? 'Close' : 'Change'}
                </button>
              }
            />
            {pwOpen ? (
              <div className="space-y-3 border-b border-purple-50 dark:border-slate-800 py-3 transition-colors">
                <PasswordField
                  label="Current Password"
                  value={pw.current}
                  onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                  visible={pwVisible.current}
                  onToggle={() => setPwVisible((p) => ({ ...p, current: !p.current }))}
                  placeholder="Enter current password"
                />
                <PasswordField
                  label="New Password"
                  value={pw.next}
                  onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                  visible={pwVisible.next}
                  onToggle={() => setPwVisible((p) => ({ ...p, next: !p.next }))}
                  placeholder="Enter new password"
                />
                <PasswordChecklist password={pw.next} />
                <PasswordField
                  label="Confirm New Password"
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  visible={pwVisible.confirm}
                  onToggle={() => setPwVisible((p) => ({ ...p, confirm: !p.confirm }))}
                  placeholder="Repeat the new password"
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={changePassword}
                    disabled={pwSaving}
                    className="w-full sm:w-auto rounded-lg bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-60 cursor-pointer shadow-xs"
                  >
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            ) : null}
            {pwMsg ? (
              <div
                className={[
                  'mt-2 text-xs font-medium',
                  pwMsg.type === 'error' ? 'text-red-600' : 'text-emerald-600',
                ].join(' ')}
              >
                {pwMsg.text}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  )
}

export default MyProfile
