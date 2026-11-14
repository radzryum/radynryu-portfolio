import FormHeading from './FormHeading'
import DatePicker from './DatePicker'
import SignaturePad from './SignaturePad'

function displayName(person) {
  return person?.display_name || person?.name || person?.full_name || person?.displayName || 'NA'
}

function displayProfession(person) {
  return person?.title || person?.profession || 'NA'
}

function displayLicense(person) {
  return person?.license_no || person?.prc_no || person?.prc_number || 'NA'
}

function SignatoryCard({
  title,
  description,
  placeholder,
  options = [],
  value = '',
  onChange,
  signatureValue = '',
  onSignatureChange,
  dateValue = '',
  onDateChange,
  readOnly = false,
  className = '',
  emptyText = 'No signature on file',
  previewProfile = null,
}) {
  const selected = options.find((opt) => String(opt.id) === String(value))
  const profile = previewProfile || selected

  const selectClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-purple-500 dark:focus:ring-purple-900/40 dark:disabled:bg-slate-800 dark:disabled:text-slate-500'

  return (
    <div className={`rounded-2xl border border-purple-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-200">{title}</div>
      <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>

      {readOnly ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-purple-100 bg-purple-50/30 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Name:</span> {displayName(profile)}
            </div>
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Profession:</span> {displayProfession(profile)}
            </div>
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400">PRC No.:</span> {displayLicense(profile)}
            </div>
          </div>

          {/* Signature paper stays white in every theme so the purple ink is always visible. */}
          <div className="rounded-2xl border border-dashed border-purple-200 bg-white px-4 py-8">
            {signatureValue ? (
              <img src={signatureValue} alt={title} className="mx-auto max-h-32 object-contain" />
            ) : (
              <div className="flex min-h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">{emptyText}</div>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">{dateValue ? `Date: ${dateValue}` : 'Date not recorded'}</div>
        </div>
      ) : (
        <div className="space-y-3">
          <select
            className={selectClass}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={readOnly}
          >
            <option value="">{placeholder}</option>
            {options.map((opt) => {
              const optName = displayName(opt)
              const optLicense = displayLicense(opt)
              const optProfession = displayProfession(opt)
              const suffix = optLicense && optLicense !== 'NA' ? ` Â· ${optLicense}` : ''
              const professionSuffix = optProfession && optProfession !== 'NA' ? ` (${optProfession})` : ''
              return (
                <option key={opt.id} value={opt.id}>
                  {`${optName}${professionSuffix}${suffix}`}
                </option>
              )
            })}
          </select>

          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Signature</div>
          <SignaturePad label="" value={signatureValue} onChange={onSignatureChange} />

          <DatePicker
            value={dateValue}
            onChange={(v) => onDateChange?.(v)}
            disabled={readOnly}
            className="w-full"
            ariaLabel={`${title} date`}
          />
        </div>
      )}
    </div>
  )
}

function SignatoriesSection({
  numeral = 'X',
  title = 'Signatories',
  items = [],
  className = '',
  readOnly = false,
}) {
  if (!items.length) return null

  return (
    <section className={`space-y-4 rounded-2xl border border-purple-100 bg-purple-50/40 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 ${className}`}>
      <FormHeading numeral={numeral}>{title}</FormHeading>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {items.map((item) => (
          <SignatoryCard
            key={item.key || item.title}
            {...item}
            readOnly={readOnly || item.readOnly}
            className={item.className || ''}
          />
        ))}
      </div>
    </section>
  )
}

export { SignatoryCard, SignatoriesSection }
export default SignatoriesSection
