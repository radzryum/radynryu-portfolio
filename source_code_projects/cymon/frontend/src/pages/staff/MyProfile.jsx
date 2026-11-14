import { useEffect, useState, useRef } from 'react'
import { toast } from 'react-hot-toast'
import StaffHeader from './StaffHeader'
import { api } from '../../lib/api'
import { passwordError } from '../../lib/password'
import PasswordChecklist from '../../components/ui/PasswordChecklist'
import { capitalizeName } from '../../lib/format'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../auth/useAuth'

const MAX = {
  displayName: 50,
  password: 64,
}

const PasswordField = ({ label, value, onChange, visible, onToggle, error, ...props }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-violet">{label}</label>
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        // Passwords must be typed, not pasted or dropped in — matches the
        // shared Input primitive so confirm fields prove what was typed.
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        title="For security, please type your password instead of pasting it."
        className="h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 px-3 pr-20 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-colors focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/30"
        {...props}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute inset-y-0 right-2 my-auto rounded-md px-2 text-xs font-semibold text-purple-700 dark:text-purple-400 transition-colors hover:bg-white dark:hover:bg-slate-700 hover:text-purple-900 dark:hover:text-purple-300"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
    {error ? <div className="text-xs text-red-600">{error}</div> : null}
  </div>
)

function MyProfile() {
  const { profile, reloadProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileErrors, setProfileErrors] = useState({})
  const [viewerImage, setViewerImage] = useState(null)

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [avatarData, setAvatarData] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const avatarInputRef = useRef(null)
  const [licenseData, setLicenseData] = useState('')
  const licenseInputRef = useRef(null)

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showLicenseForm, setShowLicenseForm] = useState(false)
  const [licenseSaving, setLicenseSaving] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [pwErrors, setPwErrors] = useState({})
  const [showPwSuccessModal, setShowPwSuccessModal] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setAvatarPreview(profile.avatar_url || '')
    }
  }, [profile])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()

    const nextErrors = {}

    if (canEditIdentity) {
      const cleanDisplayName = displayName.trim()
      if (!cleanDisplayName) {
        nextErrors.displayName = 'Display name is required.'
      } else if (cleanDisplayName.length > MAX.displayName) {
        nextErrors.displayName = `Display name must be ${MAX.displayName} characters or fewer.`
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setProfileErrors(nextErrors)
      return
    }

    setProfileErrors({})
    setSaving(true)
    try {
      const payload = {}
      if (canEditIdentity) {
        payload.displayName = displayName.trim()
      }
      if (avatarData) {
        payload.avatar = avatarData
      }
      await api.updateProfile(payload)
      toast.success('Profile updated successfully.')
      setAvatarData('')
      setIsEditingProfile(false)
      await reloadProfile()
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, or WEBP image.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarData(String(reader.result || ''))
      setAvatarPreview(String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const handleLicenseChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, or WEBP image.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLicenseData(String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveLicense = async () => {
    if (!licenseData || licenseSaving) return
    setLicenseSaving(true)
    try {
      await api.updateProfile({ licenseId: licenseData })
      toast.success('License photo updated successfully.')
      setLicenseData('')
      if (licenseInputRef.current) licenseInputRef.current.value = ''
      setShowLicenseForm(false)
      await reloadProfile()
    } catch (err) {
      toast.error(err.message || 'Failed to update license photo.')
    } finally {
      setLicenseSaving(false)
    }
  }
  const handleChangePassword = async (e) => {
    e.preventDefault()

    const nextErrors = {}
    if (!pw.current) nextErrors.current = 'Current password is required.'
    if (!pw.next) nextErrors.next = 'New password is required.'
    else {
      const err = passwordError(pw.next)
      if (err) nextErrors.next = err
    }    if (!pw.confirm) nextErrors.confirm = 'Please confirm the new password.'
    else if (pw.next !== pw.confirm) nextErrors.confirm = 'New passwords do not match.'

    if (Object.keys(nextErrors).length > 0) {
      setPwErrors(nextErrors)
      return
    }

    setPwErrors({})
    setPwSaving(true)
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.next })
      setPw({ current: '', next: '', confirm: '' })
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setShowPwSuccessModal(true)
    } catch (err) {
      toast.error(err.message || 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }

  const roleLabel = profile?.role ? profile.role.toUpperCase().replace('_', ' ') : 'STAFF'
  // Role checks follow EVERY held role (primary + additional): a super admin
  // who is also a psychologist has both an Employee ID/Position (admin side)
  // and a License/Profession (clinical side). Primary-role-only checks hid
  // whole sections of this card.
  const heldRoles = [profile?.role, ...(profile?.extra_roles || [])].filter(Boolean)
  const hasAdminRole = heldRoles.includes('admin') || heldRoles.includes('super_admin')
  const hasStaffRole = heldRoles.includes('psychologist') || heldRoles.includes('psychometrician')
  const isStaff = hasStaffRole
  // Identity fields (display name) are admin-only server-side, gated on the
  // PRIMARY role to match PUT /profile — staff holding admin as an extra
  // role must not see a field they can't save.
  const canEditIdentity = profile?.role === 'admin' || profile?.role === 'super_admin'
  // display_name is hand-typed at registration and may be lowercase —
  // capitalize at the display layer (matches every other staff surface).
  const fullName = capitalizeName([profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') || profile?.display_name) || '—'
  const roleNames = [profile?.role, ...(profile?.extra_roles || [])]
    .filter(Boolean)
    .map((r) => r.toUpperCase().replace('_', ' '))
    .join(' • ')

  return (
    <>
      <StaffHeader title="My Profile Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 to-purple-900 dark:from-[#2a1065] dark:to-[#3b1a7a] p-8 text-white shadow-lg animate-slide-down-fade" style={{ animationDelay: '0.05s' }}>
            <div className="pointer-events-none absolute -right-12 -top-24 h-65 w-65 rounded-full bg-purple-500/20" />
            <div className="pointer-events-none absolute -right-20 -bottom-18 h-60 w-60 rounded-full bg-purple-600/20" />
            <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div
                className="group relative flex h-32 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white dark:bg-slate-900 transition-colors/10 text-4xl font-bold shadow-xl transition-all duration-300 hover:border-white/40 hover:shadow-2xl"
                onClick={() => profile?.avatar_url && setViewerImage(profile.avatar_url)}
              >
                {profile?.avatar_url ? (
                  <>
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </>
                ) : profile?.display_name ? (
                  profile.display_name.slice(0, 2).toUpperCase()
                ) : (
                  'ST'
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white/95">{profile?.display_name}</h1>
                {/* Every held role gets a pill — the old single primary-role
                    label hid multi-role staff's other roles. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {(heldRoles.length ? heldRoles : ['staff']).map((r) => (
                    <span key={r} className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
                      {String(r).toUpperCase().replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">

            {/* Left Column: Basic Information */}
            <div className="relative overflow-hidden space-y-6 rounded-2xl bg-gradient-to-br from-purple-700 to-purple-900 dark:from-[#2a1065] dark:to-[#3b1a7a] p-6 text-white shadow-lg lg:col-span-1 animate-slide-down-fade" style={{ animationDelay: '0.15s' }}>
              <div className="relative z-10 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Basic Information</h2>
                  <p className="mt-0.5 text-xs text-purple-200">The core details saved during registration.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Full Name</div>
                    <div className="text-sm font-medium text-white">{fullName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Email</div>
                    <div className="text-sm font-medium text-white">{profile?.email || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Role(s)</div>
                    <div className="text-sm font-medium text-white">{roleNames || roleLabel}</div>
                  </div>
                  {hasAdminRole ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Employee ID</div>
                      <div className="text-sm font-medium text-white">{profile?.employee_id || '—'}</div>
                    </div>
                  ) : null}
                  {hasAdminRole ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Position</div>
                      <div className="text-sm font-medium text-white">{profile?.position || '—'}</div>
                    </div>
                  ) : null}
                  {hasStaffRole ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">PRC License No.</div>
                      <div className="text-sm font-medium text-white">{profile?.license_no || '—'}</div>
                    </div>
                  ) : null}
                  {hasStaffRole ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">Profession</div>
                      <div className="text-sm font-medium text-white">{profile?.title || '—'}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right Column: Editable Forms */}
            <div className="space-y-6 lg:col-span-2">

              {/* Edit Profile Details Card */}
              <div className="space-y-4 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-6 shadow-sm animate-slide-down-fade" style={{ animationDelay: '0.25s' }}>

                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile((v) => !v)}
                    className="flex w-full cursor-pointer items-center justify-between text-left focus:outline-none"
                  >
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">
                        {canEditIdentity ? 'Edit Profile Details' : 'Edit Profile Picture'}
                        <span className="rounded border border-purple-200 dark:border-slate-700 transition-colors/50 bg-purple-100/70 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          {isEditingProfile ? 'Hide Form' : 'Edit Profile'}
                        </span>
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 transition-colors">
                        {canEditIdentity ? 'Update your display name and profile image.' : 'Update your profile picture.'}
                      </p>
                    </div>
                    <svg
                      className={`h-5 w-5 transform text-purple-700 transition-transform duration-200 ${isEditingProfile ? 'rotate-180' : ''
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className={`grid transition-all duration-300 ease-in-out ${isEditingProfile ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <form onSubmit={handleUpdateProfile} className="space-y-6 pt-2">
                        <div className="flex flex-col gap-6 py-4 sm:flex-row sm:items-center rounded-xl bg-purple-50/50 dark:bg-slate-800/50 p-4 border border-purple-100 dark:border-slate-700 transition-colors">
                        <div
                          className="group relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-white bg-purple-100 text-2xl font-bold text-purple-400 shadow-md transition-all hover:border-purple-200 dark:border-slate-700 transition-colors hover:shadow-lg"
                          onClick={() => avatarPreview && setViewerImage(avatarPreview)}
                        >
                          {avatarPreview ? (
                            <>
                              <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            displayName ? displayName.slice(0, 2).toUpperCase() : 'ST'
                          )}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={avatarInputRef} onChange={handleAvatarChange} />
                            <Button type="button" variant="secondary" onClick={() => avatarInputRef.current?.click()} className="group bg-white dark:bg-slate-900 transition-colors hover:bg-purple-50">
                              <svg className="mr-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Upload Picture
                            </Button>
                            {avatarData && (
                              <button
                                type="button"
                                onClick={() => { setAvatarData(''); setAvatarPreview(profile?.avatar_url || '') }}
                                className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                            Recommended: Square image, max 5MB (PNG, JPG, WEBP).
                          </p>
                        </div>
                      </div>

                      {canEditIdentity && (
                        <>
                          <Input
                            label="Display Name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value.slice(0, MAX.displayName))}
                            placeholder="e.g. Dr. John Doe"
                            maxLength={MAX.displayName}
                          />
                          {profileErrors.displayName ? <div className="text-xs text-red-600">{profileErrors.displayName}</div> : null}
                        </>
                      )}

                      <div className="pt-2 flex gap-3">
                        <Button type="button" variant="secondary" className="w-full" onClick={() => setIsEditingProfile(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" className="w-full" disabled={saving}>
                          {saving ? (canEditIdentity ? 'Saving Details…' : 'Saving…') : (canEditIdentity ? 'Save Details' : 'Save')}
                        </Button>
                      </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Licensed ID Card */}
              {isStaff ? (
                <div className="space-y-4 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-6 shadow-sm animate-slide-down-fade" style={{ animationDelay: '0.3s' }}>
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setShowLicenseForm((v) => !v)}
                      className="flex w-full cursor-pointer items-center justify-between text-left focus:outline-none"
                    >
                      <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">
                          Professional Licensed ID
                          <span className="rounded border border-purple-200 dark:border-slate-700 transition-colors/50 bg-purple-100/70 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                            {showLicenseForm ? 'Hide Form' : 'Edit ID'}
                          </span>
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 transition-colors">Update your PRC license photo (visible to admins too).</p>
                      </div>
                      <svg
                        className={`h-5 w-5 transform text-purple-700 transition-transform duration-200 ${showLicenseForm ? 'rotate-180' : ''
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <div className={`grid transition-all duration-300 ease-in-out ${showLicenseForm ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="space-y-4 border-t border-purple-100 dark:border-slate-800 transition-colors pt-4">
                          {profile?.license_id_url && !licenseData ? (
                            <div>
                              <a
                                href={profile.license_id_url}
                                target="_blank"
                                rel="noreferrer"
                                title="Open full-size license photo"
                                className="block overflow-hidden rounded-xl border border-purple-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                              >
                                <img
                                  src={profile.license_id_url}
                                  alt="Current PRC license ID"
                                  className="h-auto w-full object-contain"
                                  style={{ maxHeight: '280px' }}
                                />
                              </a>
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Current uploaded ID — click to open full size.</div>
                            </div>
                          ) : null}
                          {licenseData ? (
                            <div>
                              <div className="overflow-hidden rounded-xl border border-emerald-200 bg-slate-50">
                                <img
                                  src={licenseData}
                                  alt="New license photo preview"
                                  className="h-auto w-full object-contain"
                                  style={{ maxHeight: '280px' }}
                                />
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-emerald-600">New photo preview — press Save to keep it.</div>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-3">
                            <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={licenseInputRef} onChange={handleLicenseChange} />
                            <Button type="button" variant="secondary" onClick={() => licenseInputRef.current?.click()}>
                              {profile?.license_id_url || licenseData ? 'Replace License Photo' : 'Upload License Photo'}
                            </Button>
                            {licenseData ? (
                              <>
                                <span className="text-xs font-semibold text-emerald-600">New photo selected.</span>
                                <button
                                  type="button"
                                  onClick={() => { setLicenseData(''); if (licenseInputRef.current) licenseInputRef.current.value = '' }}
                                  className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                                >
                                  Remove
                                </button>
                              </>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                            PNG, JPG, or WEBP, max 5MB.
                          </p>
                          <div className="pt-2 flex gap-3">
                            <Button type="button" variant="secondary" className="w-full" onClick={() => { setShowLicenseForm(false); setLicenseData('') }}>
                              Cancel
                            </Button>
                            <Button type="button" className="w-full" disabled={licenseSaving || !licenseData} onClick={handleSaveLicense}>
                              {licenseSaving ? 'Saving…' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Change Password Card */}
              <div className="space-y-4 rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-6 shadow-sm animate-slide-down-fade" style={{ animationDelay: '0.35s' }}>
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm((v) => !v)}
                    className="flex w-full cursor-pointer items-center justify-between text-left focus:outline-none"
                  >
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">
                        Change Password
                        <span className="rounded border border-purple-200 dark:border-slate-700 transition-colors/50 bg-purple-100/70 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          {showPasswordForm ? 'Hide Form' : 'Expand Form'}
                        </span>
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 transition-colors">Manage your credentials and security settings.</p>
                    </div>
                    <svg
                      className={`h-5 w-5 transform text-purple-700 transition-transform duration-200 ${showPasswordForm ? 'rotate-180' : ''
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className={`grid transition-all duration-300 ease-in-out ${showPasswordForm ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <form onSubmit={handleChangePassword} className="space-y-4 border-t border-purple-100 dark:border-slate-800 transition-colors pt-4">
                      <PasswordField
                        label="Current Password"
                        value={pw.current}
                        onChange={(e) => setPw((prev) => ({ ...prev, current: e.target.value }))}
                        visible={showCurrentPassword}
                        onToggle={() => setShowCurrentPassword((v) => !v)}
                        error={pwErrors.current}
                        placeholder="Enter current password"
                        maxLength={MAX.password}
                      />
                      <PasswordField
                        label="New Password"
                        value={pw.next}
                        onChange={(e) => setPw((prev) => ({ ...prev, next: e.target.value }))}
                        visible={showNewPassword}
                        onToggle={() => setShowNewPassword((v) => !v)}
                        error={pwErrors.next}
                        placeholder="Enter new password"
                        maxLength={MAX.password}
                      />
                      <PasswordChecklist password={pw.next} />
                      <PasswordField
                        label="Confirm New Password"
                        value={pw.confirm}
                        onChange={(e) => setPw((prev) => ({ ...prev, confirm: e.target.value }))}
                        visible={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((v) => !v)}
                        error={pwErrors.confirm}
                        placeholder="Repeat the new password"
                        maxLength={MAX.password}
                      />
                      <div className="pt-2">
                        <Button type="submit" className="w-full" variant="secondary" disabled={pwSaving}>
                          {pwSaving ? 'Updating Password…' : 'Update Password'}
                        </Button>
                      </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
          onClick={() => setViewerImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={viewerImage} alt="Profile Full Size" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-4 ring-white/10" />
            <button
              onClick={() => setViewerImage(null)}
              className="absolute -top-4 -right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-900 transition-colors text-slate-900 shadow-xl transition-transform hover:scale-110 hover:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showPwSuccessModal && (
        <Modal
          title=""
          maxWidth="max-w-sm"
          onClose={() => setShowPwSuccessModal(false)}
          footer={
            <Button className="w-full" onClick={() => setShowPwSuccessModal(false)}>
              Back to Profile
            </Button>
          }
        >
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-6">
            <style>{`
              @keyframes checkmark {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes draw-check {
                0% { stroke-dasharray: 48, 48; stroke-dashoffset: 48; }
                100% { stroke-dasharray: 48, 48; stroke-dashoffset: 0; }
              }
            `}</style>
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100/80 shadow-inner" style={{ animation: 'checkmark 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
              <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" style={{ animation: 'draw-check 0.4s ease-out 0.2s forwards', strokeDasharray: '48, 48', strokeDashoffset: '48' }} />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">Password Changed</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 transition-colors">Your account password has been updated successfully. Please use your new password next time you log in.</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default MyProfile
