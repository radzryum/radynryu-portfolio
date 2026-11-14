// Compact pagination footer for dashboard card lists.
function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const btn =
    'rounded-md border border-purple-200 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50 dark:border-purple-900/60 dark:text-purple-300 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn}>
        Prev
      </button>
      <span className="min-w-20 rounded-md bg-purple-50 px-3 py-1.5 text-center text-sm font-medium text-purple-700 dark:bg-slate-800 dark:text-purple-300">
        {page} / {pages}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={btn}>
        Next
      </button>
    </div>
  )
}

export default Pagination
