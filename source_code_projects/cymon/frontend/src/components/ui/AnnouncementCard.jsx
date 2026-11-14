import ImageSlideshow from './ImageSlideshow'

function AnnouncementCard({
  title,
  body,
  date,
  badgeLabel,
  badgeClassName = 'bg-purple-100 text-purple-800 border-purple-200',
  imageUrl,
  images,
  imageAlt,
  className = '',
  onView,
  unread = false,
}) {
  const slideshow = Array.isArray(images) && images.length ? images.filter(Boolean) : (imageUrl ? [imageUrl] : [])
  return (
    <article
      onClick={onView}
      className={`group relative flex h-full w-full flex-col rounded-2xl border border-purple-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md${onView ? ' cursor-pointer' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="relative h-40 sm:h-44 shrink-0 overflow-hidden rounded-xl border border-purple-100/60 bg-slate-100 dark:bg-slate-800">
        {slideshow.length ? (
          <ImageSlideshow
            images={slideshow}
            alt={imageAlt || title}
            className="h-full w-full"
            imgClassName="h-full w-full object-contain object-center transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full flex-col justify-between bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500 via-indigo-600 to-purple-900 p-3.5 sm:p-5 text-white relative overflow-hidden">
            {/* Subtle light leak effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex items-center justify-between relative z-10">
              <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-purple-200/90">ClearMind Note</span>
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-purple-300/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15"
                />
              </svg>
            </div>
            <div className="font-sans text-sm sm:text-base font-extrabold leading-tight text-white relative z-10">Notice & Announcement</div>
          </div>
        )}

        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
          {unread ? (
            <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
              New
            </span>
          ) : null}
          {badgeLabel ? (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-xs backdrop-blur-xs ${badgeClassName}`}
            >
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col pt-4">
        {date ? <span className="mb-1.5 font-mono text-[10px] sm:text-[11px] font-bold tracking-wide text-purple-600/80 dark:text-purple-400/80">{date}</span> : null}
        <h3 className="line-clamp-2 text-[15px] sm:text-base font-extrabold leading-snug text-slate-900 dark:text-slate-100 transition-colors duration-300 group-hover:text-purple-700 dark:group-hover:text-purple-400">
          {title}
        </h3>
        <p
          className="mt-2 break-words text-[12px] sm:text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium transition-colors"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }}
        >
          {body}
        </p>
      </div>
      
      {onView && (
        <div className="mt-3 pt-3 border-t border-purple-50 dark:border-slate-800 flex justify-end transition-colors">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="relative text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 after:absolute after:-inset-4 after:content-['']"
          >
            Read more <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </article>
  )
}

export default AnnouncementCard
