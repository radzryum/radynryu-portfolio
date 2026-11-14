import { useEffect, useRef, useState } from 'react'
import StaffHeader from '../StaffHeader'
import Skeleton from '../../../components/ui/Skeleton'
import PageSubtitle from '../../../components/ui/PageSubtitle'
import Pagination from '../../../components/ui/Pagination'
import SearchBar from '../../../components/ui/SearchBar'
import Modal from '../../../components/ui/Modal'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import DeleteModal from '../../../components/ui/DeleteModal'
import Checkbox from '../../../components/ui/Checkbox'
import Radio from '../../../components/ui/Radio'
import AnimatedSelect from '../../../components/ui/AnimatedSelect'
import DatePicker from '../../../components/ui/DatePicker'
import { shortBranchName, branchOptionLabel } from '../../../lib/branches'
import { formatLastFirstMI } from '../../../lib/format'
import { useAuth } from '../../../auth/useAuth'
import useRealtimeRefresh from '../../../hooks/useRealtimeRefresh'
import { api } from '../../../lib/api'
import ImageSlideshow from '../../../components/ui/ImageSlideshow'
import { announcementImages } from '../../../lib/announcementImages'

// Slideshow images for one announcement (existing URLs + fresh uploads).
const MAX_IMAGES = 5

const typeMeta = {
  urgent: { label: 'URGENT', cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 transition-colors' },
  event: { label: 'EVENT', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors' },
  info: { label: 'INFO', cls: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 transition-colors' },
}

const priorityMeta = {
  normal: { label: 'Normal', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors' },
  important: { label: 'Important', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 transition-colors' },
  urgent: { label: 'Urgent', cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 transition-colors' },
}

// Audience targeting who is allowed to see the announcement.
const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'public', label: 'Public (Promotions & Events)' },
  { value: 'all_employees', label: 'All Employees' },
  { value: 'all_mhp', label: 'All MHP' },
  { value: 'all_clients', label: 'All Clients / Parents' },
  { value: 'psychologist', label: 'Psychologists' },
  { value: 'psychometrician', label: 'Psychometricians' },
]

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const formatDotDate = (d) => {
  if (!d) return ''
  const date = new Date(d)
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}.${date.getFullYear()}`
}

const TypeChip = ({ active, label, color, onClick }) => (
  <Radio
    checked={active}
    onChange={onClick}
    label={label}
    colorClass={`${color} border-transparent`}
    unselectedClass="bg-white dark:bg-slate-900 transition-colors border-purple-200 dark:border-slate-700 transition-colors text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800"
    className="rounded-md px-3 py-1 text-xs font-medium"
  />
)

// Edit-modal footer. Modal injects its animated handleClose as onClose, so
// Cancel fades out smoothly instead of vanishing instantly (same pattern
// as VoiceModalFooter in the client journal).
function EditAnnouncementFooter({ onClose, onSave, saving }) {
  return (
    <div className="flex justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="rounded-xl border border-slate-200 dark:border-slate-800 transition-colors px-6 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-950 transition-colors transition-all active:scale-[0.98] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? 'Saving Changes…' : 'Save Changes'}
      </button>
    </div>
  )
}

function Announcements() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const [published, setPublished] = useState([])
  const [patients, setPatients] = useState([])
  const [employees, setEmployees] = useState([])
  const [deliveryType, setDeliveryType] = useState('broadcast') // 'broadcast' or 'targeted'
  const [targetId, setTargetId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState('urgent')
  const [priority, setPriority] = useState('normal')
  const [audience, setAudience] = useState(['all'])
  const [publishDate, setPublishDate] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [body, setBody] = useState('')
  // { key, data (data-URL for fresh uploads), url (preview src), name, existing }
  const [images, setImages] = useState([])
  const [removedUrls, setRemovedUrls] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [publishedTitle, setPublishedTitle] = useState('')
  const [publishedBranches, setPublishedBranches] = useState(1)
  const [publishedEmails, setPublishedEmails] = useState({ sent: 0, total: 0 })
  const [page, setPage] = useState(1)
  const imageInputRef = useRef(null)
  const pageSize = 3
  // Super Admin branch scope: '' = all branches, otherwise a clinic_id.
  // Regular admins are locked to their own branch server-side.
  // publishBranchId is the publish target in the composer.
  const [branchFilter, setBranchFilter] = useState('')
  const [branchOptions, setBranchOptions] = useState([])
  const [publishBranchId, setPublishBranchId] = useState('')

  const load = (branch = branchFilter) => api.admin.announcements(branch).then((d) => setPublished(d.announcements || [])).catch(() => { })

  // Live-refresh the published list when another admin posts or edits.
  const announcementScope = branchFilter || profile?.clinic_id || ''
  const announcementSubs = announcementScope
    ? [{ table: 'announcements', filter: `clinic_id=eq.${announcementScope}` }]
    : (isSuperAdmin ? [{ table: 'announcements' }] : [])
  useRealtimeRefresh(profile?.id, announcementSubs, () => {
    load()
  })
  useEffect(() => {
    let on = true
    Promise.all([
      load(),
      api.admin.patients().then((d) => {
        if (on) setPatients(d.patients || [])
      }).catch(() => { }),
      api.admin.employees().then((d) => {
        if (on) setEmployees(d.employees || [])
      }).catch(() => { })
    ]).finally(() => {
      if (on) setLoading(false)
    })
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter])

  useEffect(() => {
    api.admin.clinic()
      .then((data) => {
        if (data?.clinic?.id) setPublishBranchId((prev) => prev || data.clinic.id)
      })
      .catch(() => {})
    if (profile?.role === 'super_admin') {
      api.admin.clinics()
        .then((data) => setBranchOptions(data?.clinics || []))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAudience = (v) => {
    setAudience((prev) => {
      if (v === 'all') return ['all']
      const next = prev.filter((a) => a !== 'all')
      return next.includes(v) ? next.filter((a) => a !== v) : [...next, v]
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setType('urgent')
    setPriority('normal')
    setAudience(['all'])
    setPublishDate('')
    setExpiresOn('')
    setTargetId('')
    setStudentSearch('')
    setDeliveryType('broadcast')
    setImages([])
    setRemovedUrls([])
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

  const startEdit = (p) => {
    setError(null)
    setEditingId(p.id)
    setTitle(p.title || '')
    setBody(p.body || '')
    setType(p.type || 'info')
    setPriority(p.priority || 'normal')
    setAudience(p.audience && p.audience.length ? p.audience : ['all'])
    setPublishDate(toInputDate(p.publish_date))
    setExpiresOn(toInputDate(p.expires_on))
    setTargetId(p.patient_id || p.employee_id || '')
    const targetedPatient = p.patient_id ? patients.find(pat => pat.id === p.patient_id) : null
    const targetedEmployee = p.employee_id ? employees.find(emp => emp.id === p.employee_id) : null
    if (targetedPatient) {
      setStudentSearch(`${formatLastFirstMI(targetedPatient) || targetedPatient.name} (ID: ${targetedPatient.patient_id})`)
    } else if (targetedEmployee) {
      setStudentSearch(`${formatLastFirstMI(targetedEmployee) || targetedEmployee.name} (Clinician)`)
    } else {
      setStudentSearch('')
    }
    setDeliveryType(p.patient_id || p.employee_id ? 'targeted' : 'broadcast')
    setImages(
      announcementImages(p).map((url, i) => ({ key: `existing-${i}-${url}`, data: '', url, name: 'Existing image', existing: true }))
    )
    setRemovedUrls([])
  }

  const openImagePicker = () => imageInputRef.current?.click()

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = MAX_IMAGES - images.length
    if (files.length > remaining) {
      setError(`You can attach up to ${MAX_IMAGES} images. ${remaining} more slot${remaining === 1 ? '' : 's'} left.`)
      e.target.value = ''
      return
    }
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setError('Please upload PNG, JPEG, or WEBP images only.')
        e.target.value = ''
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" is over 5 MB. Each image must be under 5 MB.`)
        e.target.value = ''
        return
      }
    }
    const reads = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ file, dataUrl: String(reader.result || '') })
          reader.readAsDataURL(file)
        })
    )
    Promise.all(reads).then((done) => {
      setError(null)
      setImages((prev) => [
        ...prev,
        ...done.map(({ file, dataUrl }, i) => ({
          key: `new-${Date.now()}-${i}-${file.name}`,
          data: dataUrl,
          url: dataUrl,
          name: file.name,
          existing: false,
        })),
      ])
    })
    e.target.value = ''
  }

  const removeImageAt = (index) => {
    setImages((prev) => {
      const target = prev[index]
      if (target?.existing && target.url) {
        setRemovedUrls((gone) => (gone.includes(target.url) ? gone : [...gone, target.url]))
      }
      return prev.filter((_, i) => i !== index)
    })
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const validateForm = () => {
    if (!title || !body) return 'Title and message body are required.'
    if (deliveryType === 'targeted' && !targetId) return 'Please select a specific student or clinician for targeted announcement.'
    return null
  }

  const handleSaveClick = () => {
    setError(null)
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setShowPublishConfirm(true)
  }

  const handleSave = async () => {
    setError(null)
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    
    // Determine if the selected ID is a patient or employee
    const isPatient = patients.some(p => p.id === targetId)
    const isEmployee = employees.some(e => e.id === targetId)

    setSubmitting(true)
    const payload = {
      title,
      type,
      priority,
      audience: deliveryType === 'targeted' ? ['all_clients'] : (audience.length ? audience : ['all']),
      body,
      publish_date: publishDate || undefined,
      expires_on: expiresOn || undefined,
      patient_id: deliveryType === 'targeted' && isPatient ? targetId : null,
      employee_id: deliveryType === 'targeted' && isEmployee ? targetId : null,
      // Branch scoping: only a Super Admin may publish to another branch
      // (create only — a published notice never moves branches on edit).
      ...(!editingId && isSuperAdmin && publishBranchId ? { clinic_id: publishBranchId } : {}),
    }
    const freshUploads = images.filter((img) => !img.existing && img.data).map((img) => img.data)
    if (freshUploads.length) payload.images = freshUploads
    if (removedUrls.length) payload.remove_image_urls = removedUrls
    try {
      if (editingId) {
        await api.admin.updateAnnouncement(editingId, payload)
      } else {
        const created = await api.admin.createAnnouncement(payload)
        setPublishedTitle(title)
        setPublishedBranches(Number(created?.branches) || 1)
        setPublishedEmails({
          sent: Number(created?.emailsSent) || 0,
          total: Number(created?.emailsTotal) || 0,
        })
        setShowSuccessModal(true)
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await api.admin.deleteAnnouncement(id)
      if (editingId === id) resetForm()
      await load()
      // NOTE: do NOT clear deletingAnnouncement here — the modal owns its
      // lifecycle (loading → success check → auto-close). Clearing it
      // unmounts the modal mid-flight so the success animation never plays.
    } catch (err) {
      setError(err.message)
      throw err // For DeleteModal to catch
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(published.length / pageSize))
  const paginatedPublished = published.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const formContent = (
    <>
      {isSuperAdmin && branchOptions.length > 1 && !editingId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800">
          <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Publish to:</span>
          <select
            aria-label="Publish to branch"
            className="ml-auto rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            value={publishBranchId}
            onChange={(e) => setPublishBranchId(e.target.value)}
          >
            <option value="all" className="bg-white font-bold text-purple-700">All Branches</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id} className="bg-white text-slate-700">{branchOptionLabel(b)}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <div className="text-xs font-semibold tracking-wider text-purple-700">ANNOUNCEMENT TITLE *</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. World Down Syndrome Day"
          className="no-caps mt-1 h-10 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-900/50 px-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-900 dark:text-slate-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold tracking-wider text-purple-700">DELIVERY TYPE</div>
        <div className="relative mt-1 flex w-full items-center rounded-full border border-purple-800 bg-white dark:bg-slate-900 transition-colors p-0.5 shadow-inner">
          <div
            className={`absolute bottom-0.5 top-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-purple-800 transition-transform duration-300 ease-out shadow-sm ${
              deliveryType === 'broadcast' ? 'translate-x-0' : 'translate-x-full'
            }`}
          />
          <button
            type="button"
            onClick={() => setDeliveryType('broadcast')}
            className={`relative z-10 flex w-1/2 items-center justify-center rounded-full py-2.5 text-center text-[13px] font-bold tracking-wide transition-colors duration-300 ${
              deliveryType === 'broadcast' ? 'text-white' : 'text-purple-900 hover:bg-purple-50 dark:text-purple-200 dark:hover:bg-slate-800'
            }`}
          >
            Group Announcement
          </button>
          <button
            type="button"
            onClick={() => setDeliveryType('targeted')}
            className={`relative z-10 flex w-1/2 items-center justify-center rounded-full py-2.5 text-center text-[13px] font-bold tracking-wide transition-colors duration-300 ${
              deliveryType === 'targeted' ? 'text-white' : 'text-purple-900 hover:bg-purple-50 dark:text-purple-200 dark:hover:bg-slate-800'
            }`}
          >
            Direct Notice
          </button>
        </div>
      </div>

      <div className="relative grid" style={{ gridTemplateColumns: '1fr' }}>
        <div
          className={`col-start-1 row-start-1 transition-all duration-300 ease-in-out ${
            deliveryType === 'broadcast' ? 'z-10 translate-y-0 opacity-100' : 'pointer-events-none z-0 -translate-y-4 opacity-0'
          }`}
        >
          <div className="text-xs font-semibold tracking-wider text-purple-700">AUDIENCE</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">Choose who can see this announcement.</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {AUDIENCES.map((a) => (
              <Checkbox
                key={a.value}
                checked={audience.includes(a.value)}
                onChange={() => toggleAudience(a.value)}
                label={a.label}
                className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-900/50 px-3 py-2 transition-colors hover:bg-purple-100/30 dark:hover:bg-slate-800"
              />
            ))}
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 transition-all duration-300 ease-in-out ${
            deliveryType === 'targeted' ? 'z-10 translate-y-0 opacity-100' : 'pointer-events-none z-0 translate-y-4 opacity-0'
          }`}
        >
          <div className="text-xs font-semibold tracking-wider text-purple-700">TARGET STUDENT OR CLINICIAN *</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
            Select the student or clinician. The announcement will only be delivered to them (or their caregiver).
          </div>
          <div className="relative mt-2">
            <SearchBar
              value={studentSearch}
              onChange={(val) => {
                setStudentSearch(val)
                setShowStudentDropdown(true)
                if (targetId) setTargetId('')
              }}
              onFocus={() => setShowStudentDropdown(true)}
              onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
              placeholder="Search by name, student ID, or clinician..."
            />
            {showStudentDropdown && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-slate-900 transition-colors py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {[...patients.map((p) => ({ ...p, isEmployee: false })), ...employees.map((e) => ({ ...e, isEmployee: true }))]
                  .filter(
                    (p) =>
                      `${p.name || ''} ${formatLastFirstMI(p)}`.toLowerCase().replace(/,/g, ' ').includes(studentSearch.toLowerCase().replace(/,/g, ' ')) ||
                      (p.patient_id && String(p.patient_id).toLowerCase().includes(studentSearch.toLowerCase()))
                  )
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 text-slate-900 dark:text-slate-100 hover:bg-purple-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        setTargetId(p.id)
                        setStudentSearch(p.isEmployee ? `${formatLastFirstMI(p) || p.name} (Clinician)` : `${formatLastFirstMI(p) || p.name} (ID: ${p.patient_id})`)
                        setShowStudentDropdown(false)
                      }}
                    >
                      {p.photo_url || p.avatar_url ? (
                        <img
                          src={p.photo_url || p.avatar_url}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-purple-100"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 shadow-sm ring-1 ring-purple-200">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {formatLastFirstMI(p) || p.name}
                          {p.isEmployee && (
                            <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                              CLINICIAN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                          {p.isEmployee ? p.position || 'Staff' : `ID: ${p.patient_id}`}
                        </div>
                      </div>
                    </li>
                  ))}
                {[...patients, ...employees].filter(
                  (p) =>
                    `${p.name || ''} ${formatLastFirstMI(p)}`.toLowerCase().replace(/,/g, ' ').includes(studentSearch.toLowerCase().replace(/,/g, ' ')) ||
                    (p.patient_id && String(p.patient_id).toLowerCase().includes(studentSearch.toLowerCase()))
                ).length === 0 && <li className="px-3 py-2 text-slate-500 dark:text-slate-400 transition-colors">No results found.</li>}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold tracking-wider text-purple-700">TYPE</div>
        <div className="mt-1 flex flex-wrap gap-2">
          <TypeChip active={type === 'urgent'} onClick={() => setType('urgent')} label="Urgent" color="bg-rose-100 text-rose-700" />
          <TypeChip active={type === 'event'} onClick={() => setType('event')} label="Event" color="bg-amber-100 text-amber-700" />
          <TypeChip active={type === 'info'} onClick={() => setType('info')} label="General Info" color="bg-sky-100 text-sky-700" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold tracking-wider text-purple-700">PRIORITY</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {Object.entries(priorityMeta).map(([val, meta]) => (
            <TypeChip
              key={val}
              active={priority === val}
              onClick={() => setPriority(val)}
              label={meta.label}
              color={meta.cls}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wider text-purple-700">PUBLISH DATE</div>
          <DatePicker
            value={publishDate}
            onChange={(v) => setPublishDate(v)}
            className="mt-1"
            ariaLabel="Publish date"
          />
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wider text-purple-700">EXPIRES ON</div>
          <DatePicker
            value={expiresOn}
            onChange={(v) => setExpiresOn(v)}
            className="mt-1"
            ariaLabel="Expires on"
          />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold tracking-wider text-purple-700">MESSAGE BODY *</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Type the full announcement message here"
          className="no-caps mt-1 w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 dark:bg-slate-900/50 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-900 dark:text-slate-100"
        />
        <div className="mt-1 text-right text-[10px] font-medium text-slate-500 dark:text-slate-400 transition-colors">
          {body.length} characters
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold tracking-wider text-purple-700">
          ATTACH PROMOTIONAL IMAGES <span className="text-slate-400">(Optional, up to {MAX_IMAGES})</span>
        </div>
        <div className="mt-1 rounded-md border-2 border-dashed border-purple-300 dark:border-slate-700 bg-purple-50 dark:bg-slate-900/50 p-4 text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-slate-600 dark:text-slate-300 transition-colors">
                {images.length ? `${images.length} image${images.length === 1 ? '' : 's'} attached` : 'Click to upload flyers or promo banners'}
              </div>
              <div>JPG, PNG, or WEBP up to 5MB each · users can swipe through them</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openImagePicker}
                disabled={images.length >= MAX_IMAGES}
                className="rounded-md border border-purple-300 dark:border-slate-600 bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Upload Images
              </button>
            </div>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleImageChange}
          />
          {images.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((img, i) => (
                <div key={img.key} className="relative overflow-hidden rounded-lg border border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <img src={img.url} alt={img.name || `Image ${i + 1}`} className="h-28 w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
                    {i + 1}/{images.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeImageAt(i)}
                    aria-label={`Remove image ${i + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-rose-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
      ) : null}
    </>
  )

  const previewCardContent = (
    <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-800 transition-colors p-4 shadow-md pointer-events-none w-full max-w-sm mx-auto">
      {/* Image & Badge */}
      <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100">
        {images.length ? (
          <ImageSlideshow
            images={images.map((img) => img.url)}
            alt={title}
            className="h-full w-full"
            imgClassName="h-44 w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
            No Image Uploaded
          </div>
        )}
        <div className="absolute right-2 top-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${(typeMeta[type] || typeMeta.info).cls}`}>
            {(typeMeta[type] || typeMeta.info).label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 flex flex-col px-1">
        <div className="text-xs font-bold tracking-widest text-[#a855f7]">
          {publishDate ? formatDotDate(publishDate) : formatDotDate(new Date().toISOString())}
        </div>
        <h3 className="mt-1 text-[17px] font-extrabold leading-tight text-slate-900 dark:text-white break-words">
          {title || 'Announcement Title'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 transition-colors whitespace-pre-wrap break-words">
          {body || 'Message body will appear here...'}
        </p>
      </div>

      {/* Tags */}
      <div className="mt-4 flex flex-wrap items-center gap-2 px-1">
        <span className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${(priorityMeta[priority] || priorityMeta.normal).cls}`}>
          {(priorityMeta[priority] || priorityMeta.normal).label}
        </span>
        {deliveryType === 'targeted' ? (
          <span className="rounded-lg bg-rose-50 dark:bg-rose-900/40 px-3 py-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
            Specific: {
              formatLastFirstMI(patients.find((x) => x.id === targetId) || employees.find((x) => x.id === targetId)) ||
              patients.find((x) => x.id === targetId)?.name ||
              employees.find((x) => x.id === targetId)?.name ||
              'User'
            }
          </span>
        ) : (
          (audience || ['all']).map((a) => (
            <span key={a} className="rounded-lg bg-purple-50 dark:bg-purple-900/40 px-3 py-1.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
              {AUDIENCES.find((x) => x.value === a)?.label || a}
            </span>
          ))
        )}
      </div>
      
      {/* Mock Actions (Preview only) */}
      <div className="mt-5 flex gap-2 px-1 opacity-50">
        <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors px-4 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400">Edit</div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 px-4 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">Delete</div>
      </div>
    </div>
  )

  return (
    <>
      <StaffHeader title="Announcements" />
      <div className="flex-1 overflow-y-auto p-6" data-onboarding-key="announcements-workspace">
        <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-300 transition-colors">Announcements</h1>
        <PageSubtitle>Create and manage posts for the Parent Portal</PageSubtitle>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
            <header className="bg-purple-700 px-5 py-3 text-white">
              <div className="text-lg font-bold">New Announcement</div>
              <div className="text-xs opacity-80">Publish to all or specific audience</div>
            </header>
            {!editingId ? (
              <form className="space-y-4 p-5">
                {formContent}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="rounded-md border border-purple-300 px-5 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                  >
                    Live Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveClick}
                    disabled={submitting}
                    data-onboarding-key="announcement-publish"
                    className="flex-1 rounded-md bg-purple-700 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Publishing' : 'Publish Announcement'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex h-[400px] flex-col items-center justify-center p-8 text-center bg-purple-50/30">
                <div className="mb-4 rounded-full bg-purple-100 p-4 text-purple-600">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-purple-900">Editing Announcement</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 transition-colors max-w-[250px]">
                  You are currently editing <strong>{title || 'an announcement'}</strong> in the popup window.
                </p>
              </div>
            )}
          </section>

          <aside className="rounded-2xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-purple-800 dark:text-purple-300 transition-colors">PUBLISHED</div>
              {isSuperAdmin && branchOptions.length > 1 ? (
                <AnimatedSelect
                  value={branchFilter || 'all'}
                  onChange={(val) => {
                    setBranchFilter(val === 'all' ? '' : val)
                    setPage(1)
                  }}
                  options={[
                    { value: 'all', label: 'All Branches' },
                    ...branchOptions.map((b) => ({ value: b.id, label: shortBranchName(b) })),
                  ]}
                />
              ) : null}
            </div>
            <ul key={loading ? 'loading' : 'loaded'} className="mt-3 space-y-3 animate-content-fade-in">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <li key={`s${i}`}>
                    <Skeleton className="h-20 w-full" rounded="rounded-md" />
                  </li>
                ))
                : null}
              {!loading && published.length === 0 ? (
                <li className="text-xs text-slate-500 dark:text-slate-400 transition-colors">No announcements yet.</li>
              ) : null}
              {!loading &&
                paginatedPublished.map((p) => (
                  <li
                    key={p.id}
                    className={`flex flex-col rounded-2xl border bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm transition ${editingId === p.id ? 'border-purple-500 ring-2 ring-purple-300' : 'border-slate-200 dark:border-slate-800 transition-colors hover:border-purple-300'}`}
                  >
                    {/* Image & Badge */}
                    <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                      {announcementImages(p).length ? (
                        <ImageSlideshow
                          images={announcementImages(p)}
                          alt={p.title}
                          className="h-full w-full"
                          imgClassName="h-44 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">
                          No Image
                        </div>
                      )}
                      <div className="absolute right-2 top-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${(typeMeta[p.type] || typeMeta.info).cls}`}>
                          {(typeMeta[p.type] || typeMeta.info).label}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="mt-4 flex flex-col px-1">
                      <div className="text-xs font-bold tracking-widest text-[#a855f7]">
                        {formatDotDate(p.publish_date)}
                      </div>
                      <h3 className="mt-1 text-[17px] font-extrabold leading-tight text-slate-900 dark:text-white transition-colors">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300 transition-colors line-clamp-3">
                        {p.body}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="mt-4 flex flex-wrap items-center gap-2 px-1">
                      {isSuperAdmin && p.clinic_name ? (
                        <span className="rounded-lg bg-purple-100 px-3 py-1.5 text-[11px] font-bold text-purple-800">
                          {shortBranchName({ code: p.clinic_code, name: p.clinic_name })}
                        </span>
                      ) : null}
                      <span className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${(priorityMeta[p.priority] || priorityMeta.normal).cls}`}>
                        {(priorityMeta[p.priority] || priorityMeta.normal).label}
                      </span>
                      {p.patient_id ? (
                        <span className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700">
                          Specific: {formatLastFirstMI(patients.find((x) => x.id === p.patient_id)) || patients.find((x) => x.id === p.patient_id)?.name || 'Student'}
                        </span>
                      ) : p.employee_id ? (
                        <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">
                          Specific: {formatLastFirstMI(employees.find((x) => x.id === p.employee_id)) || employees.find((x) => x.id === p.employee_id)?.display_name || employees.find((x) => x.id === p.employee_id)?.name || 'Employee'}
                        </span>
                      ) : (
                        (p.audience || ['all']).map((a) => (
                          <span key={a} className="rounded-lg bg-purple-50 px-3 py-1.5 text-[11px] font-medium text-purple-700">
                            {AUDIENCES.find((x) => x.value === a)?.label || a}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-5 flex gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors px-4 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAnnouncement(p)}
                        className="rounded-xl border border-rose-200 px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {!loading && published.length > 0 ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={published.length}
                onPage={setPage}
              />
            ) : null}
          </aside>
        </div>
      </div>
      
      {editingId ? (
        <Modal
          title="Edit Announcement"
          onClose={resetForm}
          maxWidth="max-w-5xl"
          footer={<EditAnnouncementFooter onSave={handleSaveClick} saving={submitting} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px] h-[70vh] overflow-hidden">
            <div className="overflow-y-auto border-r border-slate-100 dark:border-slate-800 transition-colors p-4 pt-1">
              <form className="space-y-4">
                {formContent}
              </form>
            </div>
            <div className="overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors/50 p-6 flex flex-col items-center">
              <div className="text-xs font-bold tracking-widest text-purple-700 mb-6 w-full max-w-sm flex items-center justify-between">
                <span>LIVE PREVIEW</span>
                <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
              </div>
              {previewCardContent}
            </div>
          </div>
        </Modal>
      ) : null}

      {showPublishConfirm ? (
        <ConfirmDialog
          title={editingId ? 'Save Changes?' : 'Publish Announcement?'}
          message={editingId
            ? `Are you sure you want to save changes to "${title}"?`
            : `Are you sure you want to publish "${title}" to the selected audience?`}
          confirmLabel="Yes"
          cancelLabel="No"
          busy={submitting}
          onClose={() => {
            if (!submitting) setShowPublishConfirm(false)
          }}
          onConfirm={async () => {
            setShowPublishConfirm(false)
            await handleSave()
          }}
        />
      ) : null}

      {deletingAnnouncement ? (
        <DeleteModal
          title="Delete Announcement?"
          text="Are you sure you want to delete this announcement? This action is permanent."
          itemName={deletingAnnouncement.title}
          onClose={() => setDeletingAnnouncement(null)}
          onConfirm={() => handleDelete(deletingAnnouncement.id)}
        />
      ) : null}

      {showPreviewModal ? (
        <Modal title="Live Preview" onClose={() => setShowPreviewModal(false)} maxWidth="max-w-md">
          <div className="bg-slate-50 dark:bg-slate-950 transition-colors/50 p-6 flex flex-col items-center">
            {previewCardContent}
          </div>
          <div className="flex justify-end p-4 border-t border-slate-100 dark:border-slate-800 transition-colors bg-white dark:bg-slate-900 transition-colors">
            <button
              onClick={() => setShowPreviewModal(false)}
              className="rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 transition-all active:scale-[0.98]"
            >
              Close Preview
            </button>
          </div>
        </Modal>
      ) : null}

      {showSuccessModal ? (
        <Modal title="" onClose={() => setShowSuccessModal(false)} maxWidth="max-w-sm">
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-20 w-20 rounded-full bg-green-100 animate-ping opacity-30" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-200">
                <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Announcement Published!</h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 transition-colors">
                <span className="font-semibold text-purple-700">&ldquo;{publishedTitle}&rdquo;</span> has been successfully published{publishedBranches > 1 ? ` to ${publishedBranches} branches` : ''} and is now visible to the intended audience.
              </p>
            </div>
            <div className="mt-1 w-full rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-left text-xs text-green-700">
              <div className="flex items-center gap-1.5 font-semibold">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14v-4H9l3-7v4h2l-3 7z"/></svg>
                Recipients will see this in their Announcements tab
              </div>
              <div className="mt-1.5">
                {publishedEmails.total === 0 ? (
                  <span>No email addresses to notify for this audience.</span>
                ) : publishedEmails.sent >= publishedEmails.total ? (
                  <span>Emails delivered to {publishedEmails.sent} of {publishedEmails.total} recipient{publishedEmails.total === 1 ? '' : 's'}.</span>
                ) : (
                  <span className="font-semibold text-amber-700">Only {publishedEmails.sent} of {publishedEmails.total} emails went through — check the server log ([email]) for details.</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-1 w-full rounded-xl bg-purple-700 py-3 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:bg-purple-800 transition-all active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

export default Announcements
