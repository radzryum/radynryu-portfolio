import React from 'react'

export default function AnimatedActionBtn({ children, onClick, disabled, title, className = '', variant = 'write' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`cymon-animated-action-btn ${className} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <div>
        {variant === 'write' ? (
          <>
            <div className="pencil"></div>
            <div className="folder">
              <div className="top">
                <svg viewBox="0 0 24 27">
                  <path d="M1,0 L23,0 C23.5522847,-1.01453063e-16 24,0.44771525 24,1 L24,8.17157288 C24,8.70200585 23.7892863,9.21071368 23.4142136,9.58578644 L20.5857864,12.4142136 C20.2107137,12.7892863 20,13.2979941 20,13.8284271 L20,26 C20,26.5522847 19.5522847,27 19,27 L1,27 C0.44771525,27 6.76353751e-17,26.5522847 0,26 L0,1 C-6.76353751e-17,0.44771525 0.44771525,1.01453063e-16 1,0 Z"></path>
                </svg>
              </div>
              <div className="paper"></div>
            </div>
          </>
        ) : (
          <div className="view-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path className="eye-outline" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle className="eye-pupil" cx="12" cy="12" r="3" />
            </svg>
          </div>
        )}
      </div>
      {children}
    </button>
  )
}
