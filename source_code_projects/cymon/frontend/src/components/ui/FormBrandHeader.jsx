function FormBrandHeader({ code }) {
  return (
    <header className="cmps-screen-brand-header flex flex-wrap items-start justify-between gap-3 border-b border-[#E4DCEF] pb-4 dark:border-purple-900/50">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-700 to-purple-500 text-white"
          style={{ fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: '17px' }}
        >
          CM
        </div>
        <div>
          <div
            className="text-[18px] font-semibold text-[#38224F] dark:text-purple-100"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            ClearMind Psychological Services
          </div>
          <div className="mt-0.5 text-[11.5px] italic text-[#8B6BAE] dark:text-purple-300/80">
            Clarity of Mind, Journey to Wellness.
          </div>
        </div>
      </div>

      <div className="text-right text-[11.5px] leading-6 text-slate-500 dark:text-slate-400">
        Blk 1 Lot 7 Palmsville Subdivision<br />
        Brgy. Banlic, Cabuyao City, Laguna 4025<br />
        clearmind.psychservices@gmail.com Â· (+639)92-916-4078<br />
        {code ? (
          <span className="font-mono text-[10px] tracking-wide text-[#8B6BAE]">{code}</span>
        ) : null}
      </div>
    </header>
  )
}

export default FormBrandHeader
