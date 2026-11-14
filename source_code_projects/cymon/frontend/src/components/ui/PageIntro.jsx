import PageSubtitle from './PageSubtitle'

function PageIntro({ title, subtitle, className = '' }) {
  return (
    <div className={`mb-4 sm:mb-5 ${className}`}>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-[#311465] dark:text-purple-100 tracking-tight">{title}</h1>
      {subtitle ? <PageSubtitle>{subtitle}</PageSubtitle> : null}
    </div>
  )
}

export default PageIntro
