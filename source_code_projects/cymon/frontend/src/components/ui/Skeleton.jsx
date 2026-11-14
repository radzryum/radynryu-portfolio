// Polished shimmer skeleton components. Purple-tinted for the ClearMind theme.
//
// Primitives:
//   <Skeleton />              - basic bar (size with className)
//   <SkeletonCircle />        - circular avatar placeholder
//   <SkeletonText />          - stacked text lines
//   <SkeletonText as="rows" /> - table row blocks
//
// Composites (page-ready):
//   <SkeletonCard />          - card with header + body lines
//   <SkeletonStatCard />      - stat card (icon + number + label)
//   <SkeletonTableRow />      - single table row with avatar + cells
//   <SkeletonNavItem />       - sidebar nav item
//   <SkeletonCalendarDay />   - calendar day block
//   <SkeletonAnnouncementCard /> - announcement card
//   <SkeletonPageHeader />    - page header with title + subtitle

function Skeleton({ className = '', rounded = 'rounded-md', style }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton ${rounded} ${className}`}
      style={style}
    />
  )
}

function SkeletonCircle({ size = 40, className = '' }) {
  return <Skeleton className={`${className}`} rounded="rounded-full" style={{ width: size, height: size, minWidth: size }} />
}

export function SkeletonText({ lines = 3, as = 'text', className = '' }) {
  if (as === 'rows') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" rounded="rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/5' : i === 0 ? 'w-full' : 'w-[85%]'}`}
        />
      ))}
    </div>
  )
}

// ─── Composite skeletons ──────────────────────────────────────────────

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors p-5 shadow-xs ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonCircle size={36} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" rounded="rounded-md" />
          <Skeleton className="h-3 w-1/2" rounded="rounded-md" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  )
}

export function SkeletonStatCard({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors p-5 shadow-xs ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10" rounded="rounded-xl" />
        <Skeleton className="h-3 w-20" rounded="rounded-md" />
      </div>
      <Skeleton className="h-8 w-16 mb-2" rounded="rounded-lg" />
      <Skeleton className="h-2.5 w-28" rounded="rounded-md" />
    </div>
  )
}

export function SkeletonTableRow({ cells = 4, hasAvatar = true, className = '' }) {
  return (
    <tr className={`border-b border-purple-50 ${className}`}>
      {hasAvatar && (
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={36} />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" rounded="rounded-md" />
              <Skeleton className="h-2.5 w-20" rounded="rounded-md" />
            </div>
          </div>
        </td>
      )}
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Skeleton className="h-3.5 w-20" rounded="rounded-md" />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonNavItem({ collapsed = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${className}`}>
      <Skeleton className="h-5 w-5" rounded="rounded-lg" />
      {!collapsed && <Skeleton className="h-3.5 w-24" rounded="rounded-md" />}
    </div>
  )
}

export function SkeletonCalendarDay({ className = '' }) {
  return (
    <div className={`rounded-xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors p-3 space-y-2 ${className}`}>
      <Skeleton className="h-3 w-8" rounded="rounded-md" />
      <Skeleton className="h-8 w-full" rounded="rounded-lg" />
      <Skeleton className="h-2.5 w-16" rounded="rounded-md" />
    </div>
  )
}

export function SkeletonAnnouncementCard({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-colors ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" rounded="rounded-md" />
          <Skeleton className="h-2.5 w-1/3" rounded="rounded-md" />
        </div>
      </div>
      <Skeleton className="h-40 w-full mb-3" rounded="rounded-xl" />
      <SkeletonText lines={2} />
    </div>
  )
}

export function SkeletonPageHeader({ className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      <Skeleton className="h-8 w-48" rounded="rounded-lg" />
      <Skeleton className="h-4 w-72" rounded="rounded-md" />
    </div>
  )
}

// Mirrors the waiver/consent detail form: status card, label/value line
// rows grouped in sections, acknowledgment checkbox cards, and the
// two-up signature boxes — so loading looks like the form itself.
export function SkeletonWaiverDetail({ className = '' }) {
  const lineRow = (key, valueWidth) => (
    <div key={key} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(210px,260px)_1fr] sm:items-center sm:gap-3 py-0.5">
      <Skeleton className="h-3 w-32" rounded="rounded" />
      <Skeleton className={`h-5 ${valueWidth}`} rounded="rounded" />
    </div>
  )
  const checkRow = (key) => (
    <div key={key} className="flex items-start gap-3 rounded-xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors">
      <Skeleton className="h-5 w-5 shrink-0" rounded="rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-full" rounded="rounded-md" />
        <Skeleton className="h-3 w-4/5" rounded="rounded-md" />
      </div>
    </div>
  )
  const signBox = (key) => (
    <div key={key} className="rounded-md border border-slate-900/20 dark:border-slate-700 p-3">
      <Skeleton className="h-2.5 w-40" rounded="rounded" />
      <Skeleton className="mt-2 min-h-24 w-full" rounded="rounded" />
      <Skeleton className="mx-auto mt-2 h-3 w-32" rounded="rounded-md" />
    </div>
  )
  return (
    <div className={`space-y-5 ${className}`} aria-hidden="true">
      <div className="rounded-2xl border border-[#E4DCEF] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors">
        <div className="mb-2 flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-36" rounded="rounded-md" />
          <Skeleton className="h-3 w-24" rounded="rounded-md" />
        </div>
        <Skeleton className="h-2 w-full" rounded="rounded-full" />
      </div>
      <section className="space-y-2">
        <Skeleton className="h-4 w-44" rounded="rounded-md" />
        <div>{[0, 1, 2, 3, 4, 5].map((i) => lineRow(i, i % 3 === 2 ? 'w-3/5' : 'w-full'))}</div>
      </section>
      <section className="space-y-2">
        <Skeleton className="h-4 w-36" rounded="rounded-md" />
        <div>{[0, 1, 2, 3].map((i) => lineRow(`b-${i}`, i % 2 ? 'w-4/5' : 'w-full'))}</div>
      </section>
      <div className="space-y-3">{[0, 1, 2].map((i) => checkRow(i))}</div>
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => signBox(i))}</div>
    </div>
  )
}

export function SkeletonDashboard({ statCount = 4, className = '' }) {
  return (
    <div className={`space-y-6 ${className}`}>
      <SkeletonPageHeader />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: statCount }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}

export function SkeletonStudentDirectoryItem({ className = '' }) {
  // Simple full-width shimmer bar. Deliberately neutral (no avatar/text
  // shapes) so it fits any directory row while data loads.
  return (
    <Skeleton className={`h-[72px] w-full ${className}`} rounded="rounded-xl" />
  )
}

export default Skeleton
