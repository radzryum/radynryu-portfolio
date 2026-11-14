import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Megaphone, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from './PageHeader'
import { SkeletonAnnouncementCard } from '../../components/ui/Skeleton'
import { api } from '../../lib/api'
import PageIntro from '../../components/ui/PageIntro'
import AnnouncementCard from '../../components/ui/AnnouncementCard'
import ImageSlideshow from '../../components/ui/ImageSlideshow'
import { announcementImages } from '../../lib/announcementImages'

const TYPE_META = {
  urgent: { label: 'Urgent', cls: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  event: { label: 'Event', cls: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  info: { label: 'Info', cls: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

function AnnouncementPost({ item, meta, onClick, unread = false }) {
  return (
    <article
      onClick={onClick}
      className={`overflow-hidden rounded-xl border bg-white dark:bg-slate-800 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500 active:scale-[0.99] ${unread ? 'border-purple-300 dark:border-purple-600 ring-1 ring-purple-400/50' : 'border-slate-200 dark:border-slate-700'}`}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 px-3.5 py-3 transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 transition-colors">
          <Megaphone size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100 transition-colors">ClearMind Clinic</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">{fmtShort(item.publish_date) || 'Clinic update'}</p>
        </div>
        {unread ? (
          <span className="shrink-0 rounded-full bg-purple-600 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        ) : null}
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      <div className="px-3.5 py-3.5">
        <h3 className="text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100 transition-colors">{item.title}</h3>
        <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3 transition-colors">{item.body}</p>
        {announcementImages(item).length ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 transition-colors">
            <ImageSlideshow
              images={announcementImages(item)}
              alt={item.title}
              imgClassName="max-h-48 w-full object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 px-3.5 py-2.5 flex items-center justify-between transition-colors">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 transition-colors">Clinic announcement</span>
        <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors">Tap to read more &rarr;</span>
      </div>
    </article>
  )
}

function AnnouncementDetailModal({ item, meta, onClose }) {
  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: 'cymonModalFade 0.2s ease-out forwards' }} />

      {/* Modal */}
      <div
        className="relative z-10 w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-colors"
        style={{ animation: 'cymonModalZoom 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Full image / slideshow — object-contain so any image ratio
            (portrait, landscape, square) shows whole, never cropped. */}
        {announcementImages(item).length ? (
          <div className="w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-black" style={{ maxHeight: '50dvh' }}>
            <ImageSlideshow
              images={announcementImages(item)}
              alt={item.title}
              imgClassName="max-h-[50dvh] min-h-[160px] w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-purple-100 dark:from-slate-800 to-violet-100 dark:to-slate-800 shrink-0 transition-colors">
            <Megaphone size={32} className="text-purple-400" />
          </div>
        )}

        {/* Content &mdash; scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Badge + Date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${meta.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            {item.publish_date && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
                <Calendar size={11} />
                {fmtDate(item.publish_date)}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-extrabold leading-tight text-slate-900 dark:text-slate-100 transition-colors">{item.title}</h2>

          {/* Body */}
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line transition-colors">{item.body}</p>

          {/* Clinic footer */}
          <div className="flex items-center gap-2.5 rounded-xl bg-purple-50 dark:bg-slate-800 px-3.5 py-3 mt-2 transition-colors">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 transition-colors">
              <Megaphone size={14} />
            </div>
            <div>
              <p className="text-xs font-bold text-purple-900 dark:text-purple-300 transition-colors">ClearMind Clinic</p>
              <p className="text-[10px] text-purple-500 dark:text-purple-400 transition-colors">Official clinic announcement</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 p-4 transition-colors">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-purple-700 dark:bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-800 dark:hover:bg-purple-700 transition-colors active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const READ_KEY = 'cymon.announcements.read'
const readStoredIds = () => {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || '[]')
  } catch {
    // private mode — treat everything as unread
    return []
  }
}

// Mobile and desktop render the same card twice (stacked list + carousel)
// with only one visible at a time — always target the visible copy.
// `nearest` on both axes scrolls the MINIMUM needed to show the whole card:
// no page jump when the bulletin is already in view, and the carousel never
// strands a card half-cut at the edge (which `center` + mandatory snap did).
const scrollToAnnouncementCard = (id) => {
  const nodes = Array.from(document.querySelectorAll(`[data-ann-card="${id}"]`))
  const visible = nodes.find((el) => el.offsetParent !== null) || nodes[0]
  visible?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

function Announcement() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  // Every unopened card stays highlighted until the user opens it.
  const [readIds, setReadIds] = useState(() => readStoredIds())
  const carouselRef = useRef(null)
  const isUnread = (item) => !readIds.includes(item.id)
  // Bell deep-link (?announcement=<id>): the exact card the user clicked
  // in the notifications dropdown. It scrolls into view and flashes even
  // if it was already opened before.
  const [searchParams] = useSearchParams()
  const focusParam = searchParams.get('announcement')
  const [focusId, setFocusId] = useState(null)
  const didInitialScroll = useRef(false)

  useEffect(() => {
    let on = true
    const load = () => {
      api.myAnnouncements()
        .then((d) => {
          if (!on) return
          const merged = (d.announcements || [])
            .slice()
            .sort((a, b) => new Date(b.publish_date || 0) - new Date(a.publish_date || 0))
          setItems(merged)
          setReadIds(readStoredIds())
        })
        .catch(() => {})
        .finally(() => {
          if (on) setLoading(false)
        })
    }
    load()
    // Freshness: an announcement published while this page is open (the bell
    // already arrives instantly via Realtime) must appear without a refresh.
    const onUpdate = () => load()
    window.addEventListener('focus', onUpdate)
    window.addEventListener('cymon:notification-update', onUpdate)
    return () => {
      on = false
      window.removeEventListener('focus', onUpdate)
      window.removeEventListener('cymon:notification-update', onUpdate)
    }
  }, [])

  useEffect(() => {
    if (items.length === 0) return undefined
    if (focusParam) {
      const target = items.find((item) => String(item.id) === String(focusParam))
      if (!target) return undefined
      setFocusId(target.id)
      const scrollTimer = setTimeout(() => {
        scrollToAnnouncementCard(target.id)
      }, 350)
      const clearTimer = setTimeout(() => {
        setFocusId((current) => (current === target.id ? null : current))
      }, 4400)
      return () => {
        clearTimeout(scrollTimer)
        clearTimeout(clearTimer)
      }
    }
    if (didInitialScroll.current) return undefined
    didInitialScroll.current = true
    const newestUnread = items.find((item) => !readStoredIds().includes(item.id))
    if (newestUnread) {
      const scrollTimer = setTimeout(() => {
        scrollToAnnouncementCard(newestUnread.id)
      }, 350)
      return () => clearTimeout(scrollTimer)
    }
    return undefined
  }, [focusParam, items])

  const scrollPrev = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -340, behavior: 'smooth' })
    }
  }

  const scrollNext = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 340, behavior: 'smooth' })
    }
  }

  const selectedMeta = selected ? (TYPE_META[selected.type] || TYPE_META.info) : null

  const openModal = (item) => {
    try {
      const readAnn = readStoredIds()
      if (!readAnn.includes(item.id)) {
        readAnn.push(item.id)
        localStorage.setItem(READ_KEY, JSON.stringify(readAnn))
        setReadIds(readAnn)
        window.dispatchEvent(new Event('cymon-badge-update'))
      }
    } catch {
      // private mode — opening still works, read state just won't persist
    }
    setSelected(item)
  }

  return (
    <>
      <PageHeader title="Announcement" />
      <div data-onboarding-key="client-announcements-workspace" className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
        <PageIntro className="hidden sm:block" title="Announcements" subtitle="Latest clinic updates, notices, and upcoming events." />

        <section data-onboarding-key="client-announcements-list" className="mt-3.5 rounded-2xl border border-purple-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs sm:p-5 transition-colors">
          <div className="flex items-center justify-between gap-3 border-b border-purple-50 dark:border-slate-800 pb-3 transition-colors">
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-purple-900 dark:text-purple-300 transition-colors">Clinic Bulletin</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs transition-colors">
                {loading ? 'Loading announcements...' : `${items.length} notice${items.length === 1 ? '' : 's'} available`}
              </p>
            </div>

            {items.length > 1 && (
              <div className="hidden items-center gap-1.5 md:flex">
                <button
                  type="button"
                  onClick={scrollPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-200 dark:border-purple-500/50 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-xs transition hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-200 dark:border-purple-500/50 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-xs transition hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  aria-label="Next announcement"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <>
              <div className="mt-4 space-y-3 md:hidden">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonAnnouncementCard key={i} />
                ))}
              </div>
              <div className="mt-4 hidden space-x-4 overflow-hidden md:flex">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonAnnouncementCard key={i} className="h-[360px] w-[280px] shrink-0 sm:w-[340px]" />
                ))}
              </div>
            </>
          ) : items.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-purple-200 dark:border-slate-700 bg-purple-50/40 dark:bg-slate-800 p-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors animate-content-fade-in">
              No active announcements right now. Check back soon!
            </div>
          ) : (
            <div className="mt-3.5 animate-content-fade-in">
              {/* Mobile: stacked list */}
              <div className="space-y-3 md:hidden">
                {items.map((item) => {
                  const meta = TYPE_META[item.type] || TYPE_META.info
                  return (
                    <div key={`m-${item.id}`} data-ann-card={item.id} className={`rounded-xl ${focusId === item.id ? 'announcement-focus' : ''}`}>
                      <AnnouncementPost item={item} meta={meta} onClick={() => openModal(item)} unread={isUnread(item)} />
                    </div>
                  )
                })}
              </div>
              {/* Desktop: horizontal carousel (proximity snap so programmatic
                  scrolls land cleanly instead of fighting a mandatory snap) */}
              <div
                ref={carouselRef}
                className="hidden scroll-smooth snap-x snap-proximity space-x-3.5 overflow-x-auto px-1 py-2 no-scrollbar md:flex sm:space-x-5"
              >
                {items.map((item) => {
                  const meta = TYPE_META[item.type] || TYPE_META.info
                  const unread = isUnread(item)
                  return (
                    <div
                      key={`d-${item.id}`}
                      data-ann-card={item.id}
                      onClick={() => openModal(item)}
                      className={`w-[270px] sm:w-[340px] shrink-0 snap-center flex flex-col cursor-pointer transition-transform duration-300 hover:scale-[1.01] rounded-2xl ${unread ? 'ring-1 ring-purple-400/60 shadow-sm' : ''}${focusId === item.id ? ' announcement-focus' : ''}`}
                    >
                      <AnnouncementCard
                        title={item.title}
                        body={item.body}
                        date={fmtShort(item.publish_date)}
                        badgeLabel={meta.label}
                        badgeClassName={meta.cls}
                        images={announcementImages(item)}
                        unread={unread}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Detail Modal */}
      {selected && selectedMeta && (
        <AnnouncementDetailModal
          item={selected}
          meta={selectedMeta}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

export default Announcement
