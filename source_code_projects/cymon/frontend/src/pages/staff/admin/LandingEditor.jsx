import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { toast } from 'react-hot-toast'
import StaffHeader from '../StaffHeader'
import { api } from '../../../lib/api'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Textarea from '../../../components/ui/Textarea'
import { setStagingSections } from './landingPreviewStore'
import { formatPHMobile } from '../../../lib/format'
import {
  Home, Heart, Target, Sparkles, GraduationCap, Database, Phone, Save, RefreshCw, Plus, Trash2, Upload,
  Eye, X, Check, Image as ImageIcon, Loader2, AlertTriangle, Rocket,
} from 'lucide-react'

// The default starting content for each section (mirrors the frontend defaults).
// The admin editor seeds from these so fields show even before anything is saved.
const DEFAULT_SECTIONS = {
  hero: {
    heading: 'Clarity of Mind, Journey to Wellness',
    highlight_word: 'Wellness',
    highlight_color: '#ffffff',
    highlight_color_dark: '#a57aff',
    underline_color: '#8c52ff',
    underline_color_dark: '#8c52ff',
    heading_color: '#3b0764',
    heading_color_dark: '#ffffff',
    heading_size: 'md',
    subheading:
      'Expert, compassionate psychological care. We walk with you on your own pace — restoring peace, clarity, and resilience for children and families.',
    cta_text: 'Get Started',
    images: [
      { key: 'back-1', src: '/hero/back-1.png' },
      { key: 'back-2', src: '/hero/back-2.png' },
      { key: 'back-3', src: '/hero/back-3.png' },
      { key: 'mid-1', src: '/hero/mid-1.png' },
      { key: 'mid-2', src: '/hero/mid-2.png' },
      { key: 'mid-3', src: '/hero/mid-3.png' },
      { key: 'front-1', src: '/hero/front-1.png' },
      { key: 'front-2', src: '/hero/front-2.png' },
      { key: 'front-3', src: '/hero/front-3.png' },
    ],
  },
  about: {
    location_label: 'CABUYAO, LAGUNA',
    heading: 'Inspired by Quiet Strength and Purpose',
    paragraphs: [
      'ClearMind Psychological Services is a private clinic dedicated to providing ethical, evidence-based psychological care. Rooted in humility and empathy, we serve children and families navigating the road to wellness.',
      'Every individual is unique. We honor that through tailored care that empowers growth, resilience, and authentic connection.',
    ],
    images: [
      { key: 'front.jpg', src: '/front.jpg' },
      { key: 'front2.png', src: '/front2.png' },
    ],
  },
  mission: {
    heading: 'Empowerment and Compassion',
    description:
      'To empower individuals and families toward holistic wellness through compassionate, professional, and ethical psychological services — meeting every person where they are.',
    vision_heading: 'Our Vision 2030',
    vision_description:
      'Fostering lifelong growth and a community where every mind is understood, valued, and supported.',
  },
  values: {
    badge: 'Our Values & Philosophy',
    heading: 'The Foundations of ClearMind',
    description: 'Our practice is guided by values that shape how we show up for every client.',
    clear_title: 'CLEAR',
    clear_subtitle: 'Our Core Commitments',
    clear_items: [
      { letter: 'C', title: 'Compassion', description: 'We lead with warmth and empathy in all we do.' },
      { letter: 'L', title: 'Lifelong Growth', description: 'We champion growth at every stage of life.' },
      { letter: 'E', title: 'Empowerment', description: 'We equip clients to become their own advocates.' },
      { letter: 'A', title: 'Authenticity', description: 'We stay true to who we are and serve with honesty.' },
      { letter: 'R', title: 'Resilience', description: 'We help build strength through life’s challenges.' },
    ],
    mind_title: 'MIND',
    mind_subtitle: 'Our Clinical Approach',
    mind_items: [
      { letter: 'M', title: 'Mindfulness', description: 'Present, attentive, and grounded care.' },
      { letter: 'I', title: 'Innovation', description: 'Forward-looking methods backed by evidence.' },
      { letter: 'N', title: 'Nurturing', description: 'A safe, supportive environment to heal.' },
      { letter: 'D', title: 'Dedication', description: 'Committed to every client’s best outcome.' },
    ],
  },
  programs: {
    heading: 'Tailored care designed for your unique mind.',
    description:
      'From initial assessment to specialized therapy, our programs meet each client where they are with research-backed, compassionate care.',
    video_url: '',
    features: [
      { number: '01', badge: 'Intake', title: 'Clinical Intake & Assessment', body: 'A thorough, compassionate first step to understand your story.' },
      { number: '02', badge: 'Speech', title: 'Speech-Language Therapy', body: 'Building communication confidence for everyday life.' },
      { number: '03', badge: 'OT', title: 'Occupational Therapy', body: 'Developing skills for independence and daily function.' },
      { number: '04', badge: 'SPED', title: 'Special Education Support', body: 'Inclusive, individualized support for learning.' },
    ],
  },
  specialties: {
    heading: 'Our Specialties',
    subtext: 'Which tangle of the mind are you holding today?',
    description: 'Focused areas of care delivered with expertise and empathy.',
    items: [
      { id: '01', badge: 'INDIVIDUAL THERAPY', title: 'Feeling lost in a tangle of anxiety or stress?', description: 'Our tailored individual counseling sessions provide gentle guidance to help unspool anxious thoughts and restore inner clarity.', image: '/specialties/individual-therapy.png' },
      { id: '02', badge: 'PEDIATRIC & CHILD', title: 'Concerned about speech or motor progress in your child?', description: 'Early intervention strategies and pediatric evaluations designed to support developmental milestones with empathetic care.', image: '/specialties/pediatric-child.png' },
      { id: '03', badge: 'EVALUATIONS', title: 'Seeking formal psychological testing or school evaluations?', description: 'We provide comprehensive psychometric evaluations to unlock tailored support and classroom integration plans.', image: '/specialties/evaluations.png' },
      { id: '04', badge: 'FAMILY & COUPLES', title: 'Navigating relationship changes or parenting stress?', description: 'Collaborative family and relationship support focused on rebuilding healthy communication and resilient emotional bonds.', image: '/specialties/family-couples.png' },
    ],
  },
  contact: {
    heading: 'Contact Us',
    cabuyao_name: 'Cabuyao',
    cabuyao_address: 'Purok 4, Barangay Mamatid, Cabuyao City, Laguna',
    cabuyao_email: 'clearmindpsy@gmail.com',
    cabuyao_phone: '(049) 532-1234',
    alabang_name: 'Alabang',
    alabang_address: '2F, Commercial Building, Daang Hari, Muntinlupa City',
    alabang_email: 'clearmindalabang@gmail.com',
    alabang_phone: '(02) 8552-5678',
    facebook_url: 'https://www.facebook.com/clearmindpsychologicalservices',
    instagram_url: 'https://www.instagram.com/clearmindpsy',
  },
  footer: {
    brand: 'ClearMind Psychological Services',
    copyright: 'Â© 2026 ClearMind Psychological Services. All rights reserved.',
  },
}

const SECTIONS = [
  { key: 'hero', label: 'Hero', hint: 'Top banner', icon: Home },
  { key: 'about', label: 'About / Story', hint: 'Clinic background', icon: Heart },
  { key: 'mission', label: 'Mission & Vision', hint: 'Purpose & goals', icon: Target },
  { key: 'values', label: 'Core Values', hint: 'CLEAR & MIND', icon: Sparkles },
  { key: 'programs', label: 'Clinical Programs', hint: 'Services offered', icon: GraduationCap },
  { key: 'specialties', label: 'Specialties', hint: 'Areas of care', icon: Sparkles },
  { key: 'contact', label: 'Contact Info', hint: 'Branches & links', icon: Phone },
  { key: 'footer', label: 'Footer', hint: 'Bottom bar', icon: Database },
]

// Friendly labels + placement hints for hero stack images.
const HERO_IMAGE_FIELDS = [
  { key: 'back-1', label: 'Back layer 1', hint: 'Top / background left', defaultCaption: 'Serene Consultation Space 🌿' },
  { key: 'back-2', label: 'Back layer 2', hint: 'Background center', defaultCaption: 'Inner Serenity 🌿' },
  { key: 'back-3', label: 'Back layer 3', hint: 'Background right', defaultCaption: 'Quiet Reflection 🌿' },
  { key: 'mid-1', label: 'Middle layer 1', hint: 'Middle left', defaultCaption: 'Stream of Thoughts 💧' },
  { key: 'mid-2', label: 'Middle layer 2', hint: 'Middle center', defaultCaption: 'Safe Harbor ⛵️' },
  { key: 'mid-3', label: 'Middle layer 3', hint: 'Middle right', defaultCaption: 'Gentle Breathing 🌬' },
  { key: 'front-1', label: 'Front layer 1', hint: 'Front left', defaultCaption: 'Beauty in Chaos ✨' },
  { key: 'front-2', label: 'Front layer 2', hint: 'Front center', defaultCaption: 'Mindful Moments ⏳' },
  { key: 'front-3', label: 'Front layer 3', hint: 'Front right', defaultCaption: 'Roots & Growth 🌱' },
]

const ABOUT_IMAGE_FIELDS = [
  { key: 'front.jpg', label: 'Clinic photo 1', hint: 'Team photo' },
  { key: 'front2.png', label: 'Clinic photo 2', hint: 'Facility photo' },
]

// Deep-merge a CMS section over its defaults. Scalar fields overwrite, but the
// `images` array merges by key so a photo with no DB value still shows the
// current/default image the admin is about to replace (avoids a dialogue that
// only ever says "Upload" with a blank tile).
function mergeSection(current = {}, defaults = {}) {
  const next = { ...defaults, ...current }
  if (Array.isArray(current?.images) || Array.isArray(defaults?.images)) {
    // Gallery images are preserved because saved icons are keyed; defaults fill
    // any slot the saved data never set (e.g. a layer that was never uploaded).
    const byKey = new Map((defaults?.images || []).map((im) => [im.key, im]))
    ;(current?.images || []).forEach((im) => {
      if (im && typeof im === 'object' && im.key != null) byKey.set(im.key, im)
    })
    next.images = Array.from(byKey.values())
  }
  // List items (e.g. specialties) replace the defaults entirely, so a saved
  // item that predates an `image` field keeps showing "No image yet". Match the
  // hero gallery behavior: fill the default image when a saved item has none.
  if (Array.isArray(current?.items) && Array.isArray(defaults?.items)) {
    const byId = new Map(defaults.items.map((d) => [d.id, d]))
    next.items = current.items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const def = byId.get(item.id)
      if (!def) return item
      const merged = { ...def, ...item }
      if (!merged.image && def.image) merged.image = def.image
      return merged
    })
  }
  return next
}

function TextField({ label, hint, value, onChange }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-[13px] font-semibold text-purple-900 dark:text-purple-300 transition-colors">{label}</div>}
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full" />
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  )
}

function LabeledTextarea({ label, hint, value, onChange, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-[13px] font-semibold text-purple-900 dark:text-purple-300 transition-colors">{label}</div>}
      <Textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  )
}

function ColorField({ label, hint, value, onChange }) {
  const presets = ['#ffffff', '#a57aff', '#c4b5fd', '#8c52ff', '#f472b6', '#38bdf8', '#34d399', '#facc15']
  return (
    <div className="space-y-1.5">
      {label && <div className="text-[13px] font-semibold text-purple-900 dark:text-purple-300 transition-colors">{label}</div>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={validHex(value) || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-0.5"
          title={label}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full flex-1 rounded-lg border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-2.5 text-xs text-slate-700 dark:text-slate-200 transition-colors focus:border-purple-400 focus:outline-none"
          placeholder="#ffffff"
        />
      </div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className="h-5 w-5 rounded-full border border-slate-300 transition-transform hover:scale-110"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  )
}

function validHex(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null
}

function FontSizeSelect({ label, value, onChange }) {
  const options = [
    { value: 'sm', label: 'Small', cls: 'text-3xl sm:text-4xl lg:text-5xl' },
    { value: 'md', label: 'Medium (default)', cls: 'text-3xl sm:text-5xl lg:text-6xl' },
    { value: 'lg', label: 'Large', cls: 'text-4xl sm:text-6xl lg:text-7xl' },
  ]
  return (
    <div className="space-y-1.5">
      {label && <div className="text-[13px] font-semibold text-purple-900 dark:text-purple-300 transition-colors">{label}</div>}
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
              value === o.value
                ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-slate-400">Controls how big the banner headline appears.</div>
    </div>
  )
}

function ItemCard({ children, onRemove }) {
  return (
    <div className="group relative rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-3.5 shadow-sm transition-all duration-200 hover:border-purple-300 hover:shadow-md">
      <button
        type="button"
        onClick={onRemove}
        title="Remove this item"
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white dark:bg-slate-900 transition-colors text-rose-600 opacity-0 shadow-sm transition-all duration-200 hover:bg-rose-600 hover:text-white focus:opacity-100 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
      {children}
    </div>
  )
}

function ImageUpload({ label, hint, value, onUpload, onRemove, previewClassName = 'h-24 w-full object-cover rounded-lg' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [zoom, setZoom] = useState(false)
  // Local preview of the file the admin just picked, so the thumbnail always
  // renders instantly even before the upload round-trips (the server URL may
  // briefly show a broken image).
  const [localValue, setLocalValue] = useState(null)

  useEffect(() => {
    if (zoom) {
      document.body.style.overflow = 'hidden'
      const onKey = (e) => {
        if (e.key === 'Escape') setZoom(false)
      }
      window.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', onKey)
      }
    }
  }, [zoom])

  // Clears the local preview whenever the persisted value changes externally
  // (e.g. after a restore), so a stale picked-file preview never overrides the
  // restored image.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setLocalValue(null)
    setError(null)
  }

  // Guaranteed-renderable source: prefer the local file preview, else the
  // persisted URL (bundled or uploaded public URL).
  const shown = localValue || value

  const processFile = async (file) => {
    if (!file) return
    // Validate: images only, under 5MB, and non-empty dimensions.
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large. Please use one under 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      // Show the picked file immediately; keep it on screen even if the server
      // upload later fails.
      setLocalValue(reader.result)
      setBusy(true)
      setError(null)
      try {
        await onUpload(reader.result)
        toast.success(`${label} updated.`)
      } catch (err) {
        setError(err.message || 'Upload failed. Please try again.')
      } finally {
        setBusy(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0])
  }

  return (
    <>
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-xl border p-3 transition-all duration-200 ${
        dragOver ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-200 dark:ring-purple-500/50' : 'border-purple-100 dark:border-slate-700 bg-purple-50/30 dark:bg-slate-800 hover:border-purple-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {shown ? (
            <button
              type="button"
              onClick={() => setZoom(true)}
              title="Click to view full image"
              className={`group block cursor-zoom-in overflow-hidden ${previewClassName} border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50 shadow-sm transition-transform duration-200 hover:scale-[1.03]`}
            >
              <img src={shown} alt={label} className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover:bg-black/30 group-hover:opacity-100">
                <Eye size={16} className="text-white" />
              </span>
            </button>
          ) : (
            <div className={`${previewClassName} flex flex-col items-center justify-center gap-1 border border-dashed border-purple-300 bg-purple-50/40 text-slate-400`}>
              <ImageIcon size={18} />
              <span className="text-[10px] text-center leading-tight">No photo yet</span>
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 transition-colors/70">
              <Loader2 size={20} className="animate-spin text-purple-600" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-[13px] font-semibold text-purple-900 dark:text-purple-300 transition-colors">{label}</div>
            {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-purple-700 active:scale-95">
              <Upload size={12} /> {busy ? 'Uploading...' : shown ? 'Replace' : 'Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { processFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {shown && (
              <button type="button" onClick={() => { setLocalValue(null); onRemove() }} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white dark:bg-slate-900 transition-colors px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-all duration-200 hover:bg-rose-50 active:scale-95">
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400">Tip: PNG / JPG / WebP, up to 5 MB. You can also drag &amp; drop a file here.</div>
        </div>
      </div>
      {error && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-600"><AlertTriangle size={12} /> {error}</div>}
    </div>

      {shown && zoom && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoom(false)}
        >
          <div className="relative flex max-h-full w-full max-w-4xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3 pr-12">
              <div className="text-xs font-bold text-white/90">{label}{hint ? ` — ${hint}` : ''}</div>
            </div>
            <button
              type="button"
              onClick={() => setZoom(false)}
              aria-label="Close image viewer"
              title="Close"
              className="absolute -top-2 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-slate-900 shadow-xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <X size={18} />
            </button>
            <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-black/40">
              <img src={shown} alt={label} className="max-h-[78vh] w-auto rounded-lg object-contain shadow-2xl" />
            </div>
            <div className="mt-2 text-center text-[10px] text-white/60">
              {localValue
                ? 'This is the image you just picked (not saved yet). Replacing it below will change it after you publish.'
                : 'This is the image currently shown on the website. Replacing it below changes it after you publish.'}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function FieldCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-purple-100 bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm transition-all duration-200 hover:border-purple-200 dark:border-slate-700 transition-colors hover:shadow-md">
      {title && (
        <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-purple-800 dark:text-purple-300 transition-colors">
          {Icon && <Icon size={15} className="text-purple-500" />}
          {title}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SectionEditor({ sectionKey, data, onChange, uploadImage }) {
  const set = (path, value) => {
    onChange((prev) => {
      const next = { ...prev }
      const keys = path.split('.')
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...(cur[keys[i]] || {}) }
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
      return next
    })
  }
  const setImage = (name) => async (dataUrl) => {
    const uploaded = await uploadImage(dataUrl)
    onChange((prev) => {
      const existing = (prev.images || []).find((i) => i.key === name) || { key: name }
      return { ...prev, images: [...(prev.images || []).filter((i) => i.key !== name), { ...existing, src: uploaded }] }
    })
  }
  const removeImage = (name) => () =>
    onChange((prev) => ({ ...prev, images: (prev.images || []).filter((i) => i.key !== name) }))
  
  const setImageCaption = (name) => (caption) => {
    onChange((prev) => {
      const existing = (prev.images || []).find((i) => i.key === name) || { key: name }
      return { ...prev, images: [...(prev.images || []).filter((i) => i.key !== name), { ...existing, caption }] }
    })
  }
  const setArrItem = (arrPath, index, key, value) => {
    onChange((prev) => {
      const arr = [...(prev[arrPath] || [])]
      arr[index] = { ...(arr[index] || {}), [key]: value }
      return { ...prev, [arrPath]: arr }
    })
  }
  const pushArr = (arrPath, emptyItem) => {
    onChange((prev) => ({ ...prev, [arrPath]: [...(prev[arrPath] || []), emptyItem] }))
  }
  const removeArr = (arrPath, index) => {
    onChange((prev) => ({ ...prev, [arrPath]: (prev[arrPath] || []).filter((_, i) => i !== index) }))
  }

  if (sectionKey === 'hero') {
    return (
      <div className="space-y-4">
        <FieldCard title="Main Banner Text">
          <TextField label="Headline" hint="The main title visitors see first." value={data.heading} onChange={(v) => set('heading', v)} />
          <LabeledTextarea label="Subheading" hint="A short sentence under the headline." value={data.subheading} onChange={(v) => set('subheading', v)} />
          <TextField label="Button text" hint="The label of the main button (e.g. Get Started)." value={data.cta_text} onChange={(v) => set('cta_text', v)} />
        </FieldCard>

        <FieldCard title="Highlighted Word & Style">
          <div className="rounded-lg border border-purple-100 dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800/40 transition-colors p-3 text-[11px] text-slate-600 dark:text-slate-300">
            The last word of your headline is shown <span className="font-semibold text-purple-700 dark:text-purple-300 transition-colors">highlighted with a graphic underline</span>.
            Set exactly which word should be highlighted, or leave the highlighted word blank to auto-highlight the last word.
          </div>
          <TextField label="Highlighted word" hint="The word drawn in accent color with the underline (e.g. Wellness). Leave blank to auto-detect from the headline." value={data.highlight_word} onChange={(v) => set('highlight_word', v)} />
          
          <div className="mt-4 mb-2 text-[13px] font-bold text-purple-800 dark:text-purple-300">Light Mode Colors</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ColorField label="Highlight color" hint="Accent word color" value={data.highlight_color} onChange={(v) => set('highlight_color', v)} />
            <ColorField label="Underline color" hint="Graphic underline" value={data.underline_color} onChange={(v) => set('underline_color', v)} />
            <ColorField label="Headline color" hint="Main text color" value={data.heading_color} onChange={(v) => set('heading_color', v)} />
          </div>

          <div className="mt-4 mb-2 text-[13px] font-bold text-purple-800 dark:text-purple-300">Dark Mode Colors</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ColorField label="Highlight color" hint="Dark mode accent" value={data.highlight_color_dark} onChange={(v) => set('highlight_color_dark', v)} />
            <ColorField label="Underline color" hint="Dark mode underline" value={data.underline_color_dark} onChange={(v) => set('underline_color_dark', v)} />
            <ColorField label="Headline color" hint="Dark mode text" value={data.heading_color_dark} onChange={(v) => set('heading_color_dark', v)} />
          </div>

          <div className="mt-4">
            <FontSizeSelect label="Headline size" value={data.heading_size} onChange={(v) => set('heading_size', v)} />
          </div>
        </FieldCard>

        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-purple-800 dark:text-purple-300 transition-colors"><ImageIcon size={15} className="text-purple-500" /> Banner Photos</div>
          <p className="mb-3 text-[11px] text-slate-400">These layered photos appear behind the banner text. Upload photos for the layers you want to show.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HERO_IMAGE_FIELDS.map((f) => {
              const imgObj = (data.images || []).find((img) => img.key === f.key)
              const url = imgObj?.src
              const caption = imgObj?.caption !== undefined ? imgObj.caption : f.defaultCaption
              return (
                <div key={f.key} className="flex flex-col gap-3 rounded-lg border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 transition-colors p-3 shadow-sm">
                  <ImageUpload
                    label={f.label}
                    hint={f.hint}
                    value={url}
                    previewClassName="h-16 w-20 object-cover rounded-lg"
                    onUpload={setImage(f.key)}
                    onRemove={removeImage(f.key)}
                  />
                  <div className="pt-2 border-t border-purple-50 dark:border-slate-700">
                    <TextField 
                      label="Caption & Emoji" 
                      hint="Appears handwritten below the photo" 
                      value={caption} 
                      onChange={setImageCaption(f.key)} 
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (sectionKey === 'about') {
    return (
      <div className="space-y-4">
        <FieldCard title="Clinic Story">
          <TextField label="Location label" hint="Shown above the heading (e.g. CABUYAO, LAGUNA)." value={data.location_label} onChange={(v) => set('location_label', v)} />
          <TextField label="Heading" hint="The title of the About section." value={data.heading} onChange={(v) => set('heading', v)} />
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-purple-900">Story paragraphs</div>
            <div className="space-y-2">
              {(data.paragraphs || []).map((p, i) => (
                <ItemCard key={i} onRemove={() => onChange((prev) => ({ ...prev, paragraphs: (prev.paragraphs || []).filter((_, x) => x !== i) }))}>
                  <Textarea rows={3} value={p} onChange={(e) => {
                    const arr = [...(data.paragraphs || [])]
                    arr[i] = e.target.value
                    onChange((prev) => ({ ...prev, paragraphs: arr }))
                  }} />
                </ItemCard>
              ))}
              <Button variant="secondary" size="sm" onClick={() => pushArr('paragraphs', '')}>
                <Plus size={14} /> Add Paragraph
              </Button>
            </div>
          </div>
        </FieldCard>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-purple-800 dark:text-purple-300 transition-colors"><ImageIcon size={15} className="text-purple-500" /> Clinic Photos</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ABOUT_IMAGE_FIELDS.map((f) => {
              const url = (data.images || []).find((img) => img.key === f.key)?.src
              return (
                <ImageUpload
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  value={url}
                  previewClassName="h-24 w-32 object-cover rounded-lg"
                  onUpload={setImage(f.key)}
                  onRemove={removeImage(f.key)}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (sectionKey === 'mission') {
    return (
      <div className="space-y-4">
        <FieldCard title="Our Mission">
          <TextField label="Mission heading" value={data.heading} onChange={(v) => set('heading', v)} />
          <LabeledTextarea label="Mission description" value={data.description} onChange={(v) => set('description', v)} />
        </FieldCard>
        <FieldCard title="Our Vision">
          <TextField label="Vision badge" hint="Small label over the vision (e.g. Our Vision 2030)." value={data.vision_heading} onChange={(v) => set('vision_heading', v)} />
          <LabeledTextarea label="Vision description" value={data.vision_description} onChange={(v) => set('vision_description', v)} />
        </FieldCard>
      </div>
    )
  }

  if (sectionKey === 'values') {
    const renderList = (key, title, subtitle) => (
      <FieldCard title={`${title} (${subtitle})`}>
        <TextField label={`${title} heading`} value={data[key + '_title']} onChange={(v) => set(key + '_title', v)} />
        <TextField label={`${title} subtitle`} value={data[key + '_subtitle']} onChange={(v) => set(key + '_subtitle', v)} />
        <div className="space-y-2">
          {((data[key + '_items']) || []).map((item, i) => (
            <ItemCard key={i} onRemove={() => removeArr(key + '_items', i)}>
              <div className="grid grid-cols-[3.5rem_1fr] gap-2">
                <Input placeholder="Letter" value={item.letter || ''} onChange={(e) => setArrItem(key + '_items', i, 'letter', e.target.value)} />
                <Input placeholder="Title" value={item.title || ''} onChange={(e) => setArrItem(key + '_items', i, 'title', e.target.value)} />
              </div>
              <div className="mt-2">
                <Input placeholder="Description" value={item.description || ''} onChange={(e) => setArrItem(key + '_items', i, 'description', e.target.value)} />
              </div>
            </ItemCard>
          ))}
          <Button variant="secondary" size="sm" onClick={() => pushArr(key + '_items', { letter: '', title: '', description: '' })}>
            <Plus size={14} /> Add Item
          </Button>
        </div>
      </FieldCard>
    )
    return (
      <div className="space-y-4">
        <FieldCard title="Section Intro">
          <TextField label="Badge" hint="Small label at the top (e.g. Our Values & Philosophy)." value={data.badge} onChange={(v) => set('badge', v)} />
          <TextField label="Heading" value={data.heading} onChange={(v) => set('heading', v)} />
          <LabeledTextarea label="Description" value={data.description} onChange={(v) => set('description', v)} />
        </FieldCard>
        {renderList('clear', 'CLEAR', 'Core Commitments')}
        {renderList('mind', 'MIND', 'Clinical Approach')}
      </div>
    )
  }

  if (sectionKey === 'programs') {
    return (
      <div className="space-y-4">
        <FieldCard title="Section Intro">
          <TextField label="Heading" value={data.heading} onChange={(v) => set('heading', v)} />
          <LabeledTextarea label="Description" value={data.description} onChange={(v) => set('description', v)} />
          <TextField label="Video link (optional)" hint="Paste a Facebook or YouTube embed link to show a video." value={data.video_url} onChange={(v) => set('video_url', v)} />
        </FieldCard>
        <FieldCard title="Program Cards">
          <p className="-mt-1 text-[11px] text-slate-400">Each card shows one service you provide.</p>
          <div className="space-y-2">
            {(data.features || []).map((f, i) => (
              <ItemCard key={i} onRemove={() => removeArr('features', i)}>
                <div className="grid grid-cols-[3.5rem_5.5rem_1fr] gap-2">
                  <Input placeholder="No." value={f.number || ''} onChange={(e) => setArrItem('features', i, 'number', e.target.value)} />
                  <Input placeholder="Badge" value={f.badge || ''} onChange={(e) => setArrItem('features', i, 'badge', e.target.value)} />
                  <Input placeholder="Title" value={f.title || ''} onChange={(e) => setArrItem('features', i, 'title', e.target.value)} />
                </div>
                <div className="mt-2">
                  <Input placeholder="Short description" value={f.body || ''} onChange={(e) => setArrItem('features', i, 'body', e.target.value)} />
                </div>
              </ItemCard>
            ))}
            <Button variant="secondary" size="sm" onClick={() => pushArr('features', { number: '', badge: '', title: '', body: '' })}>
              <Plus size={14} /> Add Program Card
            </Button>
          </div>
        </FieldCard>
      </div>
    )
  }

  if (sectionKey === 'specialties') {
    const uploadSpecialtyImage = (index) => async (dataUrl) => {
      const uploaded = await uploadImage(dataUrl)
      onChange((prev) => {
        const arr = [...(prev.items || [])]
        arr[index] = { ...(arr[index] || {}), image: uploaded }
        return { ...prev, items: arr }
      })
    }
    const removeSpecialtyImage = (index) => () => {
      onChange((prev) => {
        const arr = [...(prev.items || [])]
        arr[index] = { ...(arr[index] || {}), image: '' }
        return { ...prev, items: arr }
      })
    }
    return (
      <div className="space-y-4">
        <FieldCard title="Section Intro">
          <TextField label="Heading" hint="Small label shown above the specialty cards." value={data.heading} onChange={(v) => set('heading', v)} />
          <TextField label="Tagline" hint="The big line under the heading. The last word is highlighted." value={data.subtext} onChange={(v) => set('subtext', v)} />
          <LabeledTextarea label="Description" value={data.description} onChange={(v) => set('description', v)} />
        </FieldCard>
        <div>
          <div className="mb-2 text-[13px] font-bold text-purple-800 dark:text-purple-300 transition-colors">Specialty Items</div>
          <p className="mb-3 text-[11px] text-slate-400">Add, edit, and re-position the rotating specialty cards. Each has a circular photo you can upload.</p>
          <div className="space-y-3">
            {(data.items || []).map((item, i) => (
              <ItemCard key={i} onRemove={() => removeArr('items', i)}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ImageUpload
                    label="Card photo"
                    hint="Circular photo for this specialty."
                    value={item.image || ''}
                    previewClassName="h-20 w-20 object-cover rounded-full"
                    onUpload={uploadSpecialtyImage(i)}
                    onRemove={removeSpecialtyImage(i)}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
                      <Input placeholder="Badge" value={item.badge || ''} onChange={(e) => setArrItem('items', i, 'badge', e.target.value)} />
                      <Input placeholder="Title" value={item.title || ''} onChange={(e) => setArrItem('items', i, 'title', e.target.value)} />
                    </div>
                    <Textarea rows={2} placeholder="Description" value={item.description || ''} onChange={(e) => setArrItem('items', i, 'description', e.target.value)} />
                  </div>
                </div>
              </ItemCard>
            ))}
            <Button variant="secondary" size="sm" onClick={() => pushArr('items', { badge: '', title: '', description: '', image: '' })}>
              <Plus size={14} /> Add Specialty
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (sectionKey === 'contact') {
    const branch = (prefix, defaultName) => (
      <FieldCard title={`${defaultName} Branch`}>
        <TextField label="Branch name" value={data[prefix + '_name']} onChange={(v) => set(prefix + '_name', v)} />
        <LabeledTextarea label="Address" value={data[prefix + '_address']} onChange={(v) => set(prefix + '_address', v)} rows={2} />
        <TextField label="Email" value={data[prefix + '_email']} onChange={(v) => set(prefix + '_email', v)} />
        <TextField label="Phone" value={data[prefix + '_phone']} onChange={(v) => set(prefix + '_phone', formatPHMobile(v))} />
      </FieldCard>
    )
    return (
      <div className="space-y-4">
        <FieldCard title="Section Intro">
          <TextField label="Section heading" value={data.heading} onChange={(v) => set('heading', v)} />
        </FieldCard>
        {branch('cabuyao', 'Cabuyao')}
        {branch('alabang', 'Alabang')}
        <FieldCard title="Social Links">
          <TextField label="Facebook URL" value={data.facebook_url} onChange={(v) => set('facebook_url', v)} />
          <TextField label="Instagram URL" value={data.instagram_url} onChange={(v) => set('instagram_url', v)} />
        </FieldCard>
      </div>
    )
  }

  if (sectionKey === 'footer') {
    return (
      <div className="space-y-4">
        <FieldCard title="Footer">
          <TextField label="Brand name" value={data.brand} onChange={(v) => set('brand', v)} />
          <TextField label="Copyright text" value={data.copyright} onChange={(v) => set('copyright', v)} />
        </FieldCard>
      </div>
    )
  }

  return <div className="text-sm text-slate-500 dark:text-slate-400 transition-colors">No editable fields for this section.</div>
}

function LandingEditor() {
  const navigate = useNavigate()
  const [sections, setSections] = useState(null)
  const [active, setActive] = useState('hero')
  // Directional tab transition: content slides down when moving to a lower
  // tab, up when moving to an upper one. Keyed remount replays it per tab.
  const [slideDir, setSlideDir] = useState('down')
  const selectSection = (key) => {
    const next = SECTIONS.findIndex((s) => s.key === key)
    const prev = SECTIONS.findIndex((s) => s.key === active)
    if (next !== -1 && prev !== -1 && next !== prev) {
      setSlideDir(next > prev ? 'down' : 'up')
    }
    setActive(key)
  }
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedAt, setSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)

  // Recursively fill empty image fields in `target` from matching fields in `source`.
  // Items in arrays are matched by badge+title composite first, then by index.
  const patchMissingImages = (target, source) => {
    if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return target
    if (Array.isArray(target)) {
      // Build a lookup from source by badge+title so items without id still match.
      const byComposite = new Map()
      ;(Array.isArray(source) ? source : []).forEach((si, i) => {
        if (!si || typeof si !== 'object') return
        const comp = `${(si.badge || '').trim()}|||${(si.title || '').trim()}`
        if (comp !== '|||') byComposite.set(comp, si)
      })
      return target.map((item, i) => {
        if (!item || typeof item !== 'object') return item
        const comp = `${(item.badge || '').trim()}|||${(item.title || '').trim()}`
        const srcItem = byComposite.get(comp) || (Array.isArray(source) ? source[i] : undefined)
        return patchMissingImages(item, srcItem)
      })
    }
    const out = { ...target }
    for (const key of Object.keys(out)) {
      const srcVal = source[key]
      if (/image$/i.test(key) && typeof out[key] === 'string' && !out[key] && typeof srcVal === 'string' && srcVal) {
        // Empty image in admin data → use the live published image
        out[key] = srcVal
      } else if (out[key] && typeof out[key] === 'object' && srcVal && typeof srcVal === 'object') {
        out[key] = patchMissingImages(out[key], srcVal)
      }
    }
    return out
  }

  useEffect(() => {
    let on = true
    // Fetch admin (draft+live merged) and public (live only) in parallel.
    // The public endpoint always has the real image URLs; use it to fill any
    // empty image fields left by a stale draft in the admin data.
    Promise.all([
      api.admin.landing(),
      api.publicLanding('').catch(() => ({ sections: {} })),
    ]).then(([adminData, publicData]) => {
      if (!on) return
      const liveSections = publicData?.sections || {}
      const merged = {}
      Object.keys(DEFAULT_SECTIONS).forEach((key) => {
        let section = mergeSection(adminData.sections?.[key], DEFAULT_SECTIONS[key])
        // Fill any missing images from the live published content.
        if (liveSections[key]) {
          section = patchMissingImages(section, liveSections[key])
        }
        merged[key] = section
      })
      setSections(merged)
    }).catch(() => {
      if (on) setSections(DEFAULT_SECTIONS)
    }).finally(() => {
      if (on) setLoading(false)
    })
    return () => { on = false }
  }, [])

  const activeSection = SECTIONS.find((s) => s.key === active)

  const updateSection = (fn) => {
    setDirty(true)
    setSections((prev) => ({ ...prev, [active]: fn(prev[active]) }))
  }

  const uploadImage = async (dataUrl) => {
    const { url } = await api.admin.uploadLandingImage(dataUrl)
    return url
  }

  // A 502/503 or fetch network error is usually a transient server hiccup
  // (e.g. a cold start on Vercel). Retry once before surfacing a user error.
  const retryTransient = async (fn) => {
    try {
      return await fn()
    } catch (err) {
      if (err?.status === 502 || err?.status === 503 || err instanceof TypeError) {
        return fn()
      }
      throw err
    }
  }

  // Save writes a DRAFT: it persists your edits but visitors still see the last
  // published content. Nothing on the live site changes.
  const handleSave = async () => {
    setSaving(true)
    try {
      await retryTransient(() => api.admin.saveLanding({ [active]: sections[active] }))
      setDirty(false)
      setSavedAt(new Date())
      toast.success(`${activeSection.label} saved as draft. ${
        dirty ? 'Publish to reflect these changes on the live site.' : ''
      }`)
    } catch (err) {
      const transient = err?.status === 502 || err?.status === 503
      toast.error(
        transient
          ? 'The server hiccuped — please try saving again.'
          : (err.message || 'Failed to save.')
      )
    } finally {
      setSaving(false)
    }
  }

  // Publish makes the current edits LIVE on the landing page.
  const handlePublish = async () => {
    setPublishing(true)
    try {
      await retryTransient(() => api.admin.publishLanding({ [active]: sections[active] }))
      setDirty(false)
      setSavedAt(new Date())
      toast.success(`${activeSection.label} published — your landing page now shows these changes.`)
    } catch (err) {
      const transient = err?.status === 502 || err?.status === 503
      toast.error(
        transient
          ? 'The server hiccuped — please try publishing again.'
          : (err.message || 'Failed to publish.')
      )
    } finally {
      setPublishing(false)
    }
  }

  // Restore clears the saved DRAFT for this section and reverts the editor to
  // the section's last published (live) state — undoing the most recent change
  // (e.g. a replaced image) instead of resetting to the bundled defaults.
  const handleRestore = async () => {
    try {
      await retryTransient(() => api.admin.resetLandingSection(active))
      const [adminData, publicData] = await Promise.all([
        api.admin.landing(),
        api.publicLanding('').catch(() => ({ sections: {} })),
      ])
      const liveSections = publicData?.sections || {}
      let section = mergeSection(adminData.sections?.[active], DEFAULT_SECTIONS[active])
      if (liveSections[active]) section = patchMissingImages(section, liveSections[active])
      setSections((prev) => ({ ...prev, [active]: section }))
      setDirty(true)
      setSavedAt(null)
      toast.success(`Restored the ${activeSection.label} section to its last published state.`)
    } catch (err) {
      const transient = err?.status === 502 || err?.status === 503
      toast.error(
        transient
          ? 'The server hiccuped — please try restoring again.'
          : (err.message || 'Failed to restore.')
      )
    }
  }

  const previewSections = useMemo(() => {
    if (!sections) return {}
    const m = {}
    Object.keys(DEFAULT_SECTIONS).forEach((key) => {
      m[key] = mergeSection(sections[key], DEFAULT_SECTIONS[key])
    })
    return m
  }, [sections])

  const handlePreview = () => {
    setStagingSections(previewSections)
    navigate('/admin/landing/preview')
  }

  if (loading) {
    return (
      <>
        <StaffHeader title="Content Manager" />
        
        {/* Skeleton Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-purple-100 bg-white dark:bg-slate-900 transition-colors/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-8" data-onboarding-key="landing-toolbar">
          <div className="space-y-2">
            <div className="skeleton h-6 w-56 rounded-md" />
            <div className="skeleton hidden h-3 w-80 rounded-md sm:block" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-9 w-24 rounded-xl" />
            <div className="skeleton h-10 w-28 rounded-xl" />
          </div>
        </div>

        {/* Skeleton Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors/50 relative" data-onboarding-key="landing-workspace">
          <div className="mx-auto w-full max-w-[1200px] flex flex-col lg:flex-row-reverse lg:items-start gap-8">
            {/* Right Sidebar */}
          <div className="w-full lg:w-64 shrink-0 space-y-1.5 lg:sticky lg:top-4" data-onboarding-key="landing-sections">
              <div className="mb-2 ml-2 h-3 w-24 rounded skeleton" />
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="skeleton h-12 w-full rounded-2xl" />
              ))}
            </div>

            {/* Main Editor Card */}
            <div className="flex-1 min-w-0">
              <div className="skeleton h-[500px] w-full rounded-3xl" />
            </div>
          </div>
        </div>
      </>
    )
  }

  // Flex column (not a plain div): the editor workspace below is
  // `flex-1 overflow-y-auto`, which only scrolls when its parent is a
  // height-constrained flex column. A plain wrapper grows unbounded and
  // the form gets clipped with no scrollbar.
  return (
    <div key="landing-loaded" className="flex min-h-0 flex-1 flex-col animate-content-fade-in">
      <StaffHeader title="Content Manager" />

      {/* Sticky preview / save / publish toolbar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-purple-100 bg-white dark:bg-slate-900 transition-colors/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-purple-950 dark:text-purple-100 transition-colors sm:text-xl tracking-tight">Website Content Manager</h1>
          <p className="hidden truncate text-[11px] text-slate-500 dark:text-slate-400 transition-colors sm:block">
            Save keeps your edits as a draft — Publish makes them live on the landing page.
            {savedAt ? <span className="font-medium text-emerald-600 ml-1">Last save {savedAt.toLocaleTimeString()}.</span> : ''}
          </p>
          {dirty && (
            <p className="flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-0.5">
              <AlertTriangle size={12} /> Unsaved changes
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border-2 border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-4 py-2 text-xs font-bold text-purple-700 transition-all hover:border-purple-300 hover:bg-purple-50 active:scale-95"
            onClick={handlePreview}
          >
            <Eye size={14} /> Preview
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border-2 border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-4 py-2 text-xs font-bold text-purple-700 transition-all hover:border-purple-300 hover:bg-purple-50 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            onClick={handleSave}
            disabled={saving || publishing || !sections}
          >
            {saving ? (
              <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Saving...</span>
            ) : (
              <><Save size={14} /> Save</>
            )}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-200 dark:shadow-none transition-all hover:bg-purple-800 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            onClick={handlePublish}
            disabled={publishing || saving || !sections}
          >
            {publishing ? (
              <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Publishing...</span>
            ) : (
              <><Rocket size={14} /> Publish</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 transition-colors/50 relative">
        <div className="mx-auto w-full max-w-[1200px] flex flex-col lg:flex-row-reverse lg:items-start gap-8">
          {/* Right Sidebar: Section tabs */}
          <div className="w-full lg:w-64 shrink-0 space-y-1.5 lg:sticky lg:top-4">
            <div className="mb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Website Sections
            </div>
            {SECTIONS.map((s) => {
              const Icon = s.icon
              const isActive = s.key === active
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => selectSection(s.key)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/50'
                      : 'bg-white dark:bg-slate-900 transition-colors text-slate-700 dark:text-slate-200 transition-colors shadow-sm border border-slate-100 dark:border-slate-800 transition-colors hover:border-purple-200 dark:border-slate-700 transition-colors hover:shadow-md'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                      isActive
                        ? 'bg-white/20 text-white backdrop-blur-sm'
                        : 'bg-purple-50 dark:bg-slate-800 text-purple-500 dark:text-purple-400 group-hover:bg-purple-100 group-hover:text-purple-600 dark:group-hover:bg-slate-700 dark:group-hover:text-purple-300 transition-colors'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'animate-pulse' : ''} style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold tracking-tight">{s.label}</div>
                    <div className={`truncate text-[9px] ${isActive ? 'text-purple-100' : 'text-slate-400'}`}>
                      {s.hint}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right Area: Editor card */}
          <div className="flex-1 min-w-0">
            {sections && (
              <div key={active} className={`rounded-3xl border border-purple-100/60 bg-white dark:bg-slate-900 transition-colors shadow-xl shadow-purple-900/5 backdrop-blur-xl ${slideDir === 'down' ? 'animate-[contentSlideDown_0.3s_cubic-bezier(0.16,1,0.3,1)_both]' : 'animate-[contentSlideUp_0.3s_cubic-bezier(0.16,1,0.3,1)_both]'}`}>
                <div className="flex items-center justify-between rounded-t-3xl border-b border-purple-50 dark:border-slate-800/50 bg-gradient-to-r from-purple-50/50 dark:from-slate-800/80 to-white dark:to-slate-900 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = activeSection.icon
                      return (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100/50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-1 ring-purple-100 dark:ring-purple-700/50 transition-colors">
                          <Icon size={18} />
                        </span>
                      )
                    })()}
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-purple-950 dark:text-purple-100 transition-colors">Editing: {activeSection.label}</h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 transition-colors">{activeSection.hint}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestore}
                    title="Undo the last change and revert this section to its last published state"
                    className="flex items-center gap-1.5 rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm transition-all duration-200 hover:border-purple-300 hover:bg-purple-50 hover:shadow active:scale-95"
                  >
                    <RefreshCw size={14} /> Restore
                  </button>
                </div>
                <div className="p-5 sm:p-8">
                  <SectionEditor
                    sectionKey={active}
                    data={sections[active]}
                    onChange={updateSection}
                    uploadImage={uploadImage}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-b-3xl border-t border-slate-100 dark:border-slate-800 transition-colors bg-slate-50 dark:bg-slate-950 transition-colors/50 px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${dirty ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      <Check size={12} />
                    </span>
                    {dirty
                      ? 'You have unsaved edits — Save to keep a draft, Publish to make them live.'
                      : 'All current edits saved.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingEditor
