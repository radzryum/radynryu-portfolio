import { useNavigate } from 'react-router-dom'
import Landing from '../../Landing'
import { ArrowLeft } from 'lucide-react'
import { stagingSections } from './landingPreviewStore'

// Full-viewport live preview of the landing page with the editor's current
// (unsaved) edits. Rendered as a real page — NOT inside a fixed-height modal —
// so all the page's scroll effects, vh/dvh units, and IntersectionObserver
// animations behave exactly like the live site. The editor stores its current
// sections in the shared store before navigating here.
function LandingPreviewPage() {
  const navigate = useNavigate()
  const sections = stagingSections()

  return (
    <div className="min-h-screen bg-[#120c1d]">
      {/* Floating back-to-editor bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 transition-colors/95 px-4 py-2 text-xs font-semibold text-purple-900 shadow-xl ring-1 ring-black/10 backdrop-blur">
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400 transition-colors">Live preview of your content —</span>
          <span className="text-slate-500 dark:text-slate-400 transition-colors">nothing is saved until you publish.</span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3.5 py-1.5 text-white transition-all duration-200 hover:bg-purple-700 active:scale-95"
          >
            <ArrowLeft size={14} /> Back to Content Manager
          </button>
        </div>
      </div>

      {sections ? (
        <Landing sectionsOverride={sections} />
      ) : (
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-sm rounded-2xl border border-purple-300/40 bg-white dark:bg-slate-900 transition-colors p-8 text-center">
            <p className="text-sm font-bold text-purple-900">No preview content found</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 transition-colors">
              Open the Content Manager and press Preview to load your current edits here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/landing')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
            >
              <ArrowLeft size={14} /> Go to Content Manager
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LandingPreviewPage
