import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Slideshow for announcement images: users can go next / previous with a
// basic slide transition. Falls back to a single static image when only
// one is provided.
function ImageSlideshow({ images = [], alt = '', className = '', imgClassName = '' }) {
  const [index, setIndex] = useState(0)
  const list = (Array.isArray(images) ? images : []).filter(Boolean)
  if (list.length === 0) return null
  if (list.length === 1) {
    return (
      <img src={list[0]} alt={alt} className={imgClassName} />
    )
  }
  const go = (dir) => setIndex((i) => (i + dir + list.length) % list.length)
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="flex h-full w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {list.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={`${alt} (${i + 1} of ${list.length})`}
            aria-hidden={i !== index}
            draggable={false}
            className={`${imgClassName} w-full shrink-0 grow-0 basis-full`}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous image"
        onClick={(e) => { e.stopPropagation(); go(-1) }}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next image"
        onClick={(e) => { e.stopPropagation(); go(1) }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5">
        {list.map((src, i) => (
          <button
            key={src + i}
            type="button"
            aria-label={`Go to image ${i + 1}`}
            onClick={(e) => { e.stopPropagation(); setIndex(i) }}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'}`}
          />
        ))}
      </div>
      {/* Bottom-right: stays clear of the card badge and the modal close
          button, which both live at the top-right. */}
      <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
        {index + 1} / {list.length}
      </div>
    </div>
  )
}

export default ImageSlideshow
