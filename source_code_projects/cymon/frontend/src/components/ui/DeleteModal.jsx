import { useState } from 'react'
import { toast } from 'react-hot-toast'

export default function DeleteModal({ title = 'Delete Item?', text = 'Are you sure you want to permanently delete this item?', itemName, onConfirm, onClose }) {
  const [phase, setPhase] = useState('confirm')

  const doDelete = async () => {
    setPhase('loading')
    try {
      await onConfirm()
      setPhase('success')
      setTimeout(onClose, 1800)
    } catch (err) {
      setPhase('confirm')
      toast.error(err.message || 'Failed to delete')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76, 29, 149, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <style>{`
        @keyframes em-spin { to { transform: rotate(360deg); } }
        @keyframes em-scale-in { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes em-fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes em-check { from { stroke-dashoffset: 50; } to { stroke-dashoffset: 0; } }
      `}</style>
      <div className="bg-white dark:bg-slate-900" style={{
        borderRadius: '28px', padding: '40px', maxWidth: '420px', width: '92%',
        textAlign: 'center', boxShadow: '0 40px 80px rgba(88, 28, 135, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.1)',
        animation: 'em-fade-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {phase === 'confirm' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              {text} {itemName ? <strong className="text-slate-900 dark:text-slate-100">{itemName}</strong> : null}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 transition-all duration-200 active:scale-[0.98]">Cancel</button>
              <button onClick={doDelete} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-200 active:scale-[0.98]">Delete</button>
            </div>
          </>
        ) : phase === 'loading' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', border: '4px solid #fee2e2', borderTopColor: '#dc2626', animation: 'em-spin 0.75s linear infinite' }} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Deleting…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Please wait.</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'em-scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none"><path d="M4.5 12.5l5 5 10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 50, strokeDashoffset: 0, animation: 'em-check 0.5s ease 0.1s both' }}/></svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Deletion Successful!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{itemName ? <strong className="text-slate-900 dark:text-slate-100">{itemName}</strong> : 'Item'} has been removed.</p>
          </>
        )}
      </div>
    </div>
  )
}
