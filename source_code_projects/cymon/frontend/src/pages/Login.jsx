import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Checkbox from '../components/ui/Checkbox'
import LoadingScreen from '../components/ui/LoadingScreen'
import SplashCursor from '../components/ui/SplashCursor'
import PasswordChecklist from '../components/ui/PasswordChecklist'
import { useAuth } from '../auth/useAuth'
import { api } from '../lib/api'

const ArrowLeft = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path
      d="M15 6l-6 6 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const EyeIcon = ({ open, className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    {open ? (
      <>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      </>
    ) : (
      <>
        <path
          d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.4 17.4 0 0 1-3.2 4M6.6 7.6A17 17 0 0 0 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.7-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
  </svg>
)

function Login() {
  const navigate = useNavigate()
  const { signIn, session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1=email, 2=otp, 3=new-password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState([])
  const otpRefs = useRef([])

  const openForgot = () => { setIsForgot(true); setForgotStep(1); setForgotEmail(''); setForgotOtp(['', '', '', '', '', '']); setNewPassword(''); setConfirmPassword(''); setPasswordErrors([]) }
  const closeForgot = () => { setIsForgot(false); setForgotStep(1) }

  const validatePassword = (pw) => {
    const errs = []
    if (pw.length < 8) errs.push('At least 8 characters')
    if (!/[A-Z]/.test(pw)) errs.push('One uppercase letter')
    if (!/[0-9]/.test(pw)) errs.push('One number')
    return errs
  }

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...forgotOtp]
    next[i] = val
    setForgotOtp(next)
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !forgotOtp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length === 6) {
      setForgotOtp(paste.split(''))
      otpRefs.current[5]?.focus()
    }
    e.preventDefault()
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await api.forgotPassword(forgotEmail)
      setForgotStep(2)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err) {
      toast.error(err.message || 'Failed to send code.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (submitting) return
    const otp = forgotOtp.join('')
    if (otp.length < 6) { toast.error('Enter all 6 digits.'); return }
    setSubmitting(true)
    try {
      await api.verifyOTP(forgotEmail, otp)
      setForgotStep(3)
    } catch (err) {
      toast.error(err.message || 'Invalid code.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (submitting) return
    const errs = validatePassword(newPassword)
    if (errs.length) { setPasswordErrors(errs); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return }
    setPasswordErrors([])
    setSubmitting(true)
    try {
      await api.resetPassword(forgotEmail, newPassword)
      setShowSuccessModal(true)
    } catch (err) {
      toast.error(err.message || 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessModal(false)
    closeForgot()
  }

  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let width, height
    const mouse = { x: -1000, y: -1000, radius: 200 }
    let gravityX = 0
    let gravityY = 0
    let hasGyro = false

    function resize() {
      width = canvas.width = canvas.offsetWidth
      height = canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onLeave = () => { mouse.x = -1000; mouse.y = -1000 }
    
    const onOrientation = (e) => {
      if (e.gamma === null || e.beta === null) return
      hasGyro = true
      let x = e.gamma
      let y = e.beta
      // clamp gamma for smooth horizontal tilt
      if (x > 90) x = 90
      if (x < -90) x = -90
      gravityX = x * 0.003
      gravityY = y * 0.003
    }
    
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    window.addEventListener('deviceorientation', onOrientation)

    // iOS 13+ requires explicit permission from a user gesture
    const requestGyro = () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(state => {
            if (state === 'granted') window.addEventListener('deviceorientation', onOrientation)
          })
          .catch(console.error)
      }
      window.removeEventListener('touchstart', requestGyro)
      window.removeEventListener('click', requestGyro)
    }
    window.addEventListener('touchstart', requestGyro)
    window.addEventListener('click', requestGyro)

    class DustParticle {
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = (Math.random() - 0.5) * 0.3
        this.vy = -Math.random() * 0.4 - 0.1
        this.size = Math.random() * 2 + 0.5
        this.alpha = Math.random() * 0.7 + 0.2
        this.baseAlpha = this.alpha
      }
      update() {
        if (hasGyro) {
          this.vx += gravityX * 1.5
          this.vy += gravityY * 1.5
          const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
          if (spd > 8) { this.vx = (this.vx / spd) * 8; this.vy = (this.vy / spd) * 8 }
        }
        
        this.x += this.vx; this.y += this.vy
        
        const dx = this.x - mouse.x, dy = this.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius
          const angle = Math.atan2(dy, dx)
          this.x += Math.cos(angle) * force * 3
          this.y += Math.sin(angle) * force * 3
          this.alpha = 1
        } else if (this.alpha > this.baseAlpha) this.alpha -= 0.02
        
        if (hasGyro) {
          // wrap around to create a continuous flowing sand/water effect without clumping
          if (this.x < -10) this.x = width + 10
          if (this.x > width + 10) this.x = -10
          if (this.y < -10) this.y = height + 10
          if (this.y > height + 10) this.y = -10
        } else {
          if (this.y < -10 || this.x < -10 || this.x > width + 10) { this.reset(); this.y = height + 10 }
        }
      }
      draw() {
        ctx.save(); ctx.globalAlpha = this.alpha
        ctx.fillStyle = '#c4b5fd'; ctx.shadowBlur = isMobileCanvas ? 0 : 8; ctx.shadowColor = '#a78bfa'
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    }

    const COLORS = [
      { main: 'rgba(167,139,250,0.35)', glow: 'rgba(139,92,246,0.65)' },
      { main: 'rgba(196,181,253,0.30)', glow: 'rgba(167,139,250,0.55)' },
      { main: 'rgba(233,213,255,0.25)', glow: 'rgba(192,132,252,0.45)' },
    ]
    class Sphere {
      constructor() {
        const isMobile = window.innerWidth < 768
        this.radius = isMobile ? Math.random() * 15 + 20 : Math.random() * 45 + 50
        // Use initial width/height to avoid spawning outside on init
        const w = window.innerWidth || width || 300
        const h = window.innerHeight || height || 500
        this.x = Math.random() * (w - this.radius * 2) + this.radius
        this.y = Math.random() * (h - this.radius * 2) + this.radius
        this.vx = (Math.random() - 0.5) * 0.8
        this.vy = (Math.random() - 0.5) * 0.8
        this.mass = this.radius
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
      }
      update() {
        // Apply stronger gravity to big bubbles so they slosh around noticeably
        this.vx += gravityX * 4
        this.vy += gravityY * 4
        this.vx *= 0.985; this.vy *= 0.985
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        // Increase their top speed so they can move fast when tilted
        if (spd > 8) { this.vx = (this.vx / spd) * 8; this.vy = (this.vy / spd) * 8 }
        if (Math.abs(this.vx) < 0.15) this.vx += (Math.random() - 0.5) * 0.05
        if (Math.abs(this.vy) < 0.15) this.vy += (Math.random() - 0.5) * 0.05
        this.x += this.vx; this.y += this.vy
        const dx = this.x - mouse.x, dy = this.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < mouse.radius) {
          const angle = Math.atan2(dy, dx)
          const force = (mouse.radius - dist) / mouse.radius
          this.vx += Math.cos(angle) * force * 0.25
          this.vy += Math.sin(angle) * force * 0.25
        }
        // Drastically lower wall bounce (r=0.2 instead of 0.7) so they don't bounce violently
        const r = 0.2
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -r }
        if (this.x + this.radius > width) { this.x = width - this.radius; this.vx *= -r }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -r }
        if (this.y + this.radius > height) { this.y = height - this.radius; this.vy *= -r }
      }
      draw() {
        ctx.save(); ctx.shadowBlur = isMobileCanvas ? 0 : 30; ctx.shadowColor = this.color.glow
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        const g = ctx.createRadialGradient(
          this.x - this.radius * 0.35, this.y - this.radius * 0.35, this.radius * 0.05,
          this.x, this.y, this.radius * 1.05
        )
        g.addColorStop(0, 'rgba(255,255,255,0.75)')
        g.addColorStop(0.35, this.color.main)
        g.addColorStop(1, 'rgba(139,92,246,0.02)')
        ctx.fillStyle = g; ctx.fill()
        ctx.restore()
      }
    }

    function collide(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0 && dist < a.radius + b.radius) {
        const nx = dx / dist, ny = dy / dist
        const overlap = (a.radius + b.radius) - dist
        
        // Position correction to push them apart
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5
        
        const kx = a.vx - b.vx, ky = a.vy - b.vy
        const relativeVel = nx * kx + ny * ky
        
        // Only apply bounce if they are moving TOWARDS each other
        if (relativeVel > 0) {
          // Zero restitution (no bounce) so they settle instantly
          const p = (1 + 0.0) * relativeVel / (a.mass + b.mass)
          a.vx -= p * b.mass * nx; a.vy -= p * b.mass * ny
          b.vx += p * a.mass * nx; b.vy += p * a.mass * ny
          
          // Heavy damping to kill any residual shaking
          a.vx *= 0.7; a.vy *= 0.7
          b.vx *= 0.7; b.vy *= 0.7
        }
      }
    }

    // Mobile gets far fewer particles — shadowBlur and per-frame collision
    // checks are the main jank sources on phone GPUs.
    const isMobileCanvas = window.innerWidth < 768
    const dust = Array.from({ length: isMobileCanvas ? 40 : 80 }, () => new DustParticle())
    const spheres = Array.from({ length: isMobileCanvas ? 5 : 12 }, () => new Sphere())

    function loop() {
      if (document.hidden) {
        animId = requestAnimationFrame(loop)
        return
      }
      ctx.clearRect(0, 0, width, height)
      dust.forEach(p => { p.update(); p.draw() })
      for (let i = 0; i < spheres.length; i++)
        for (let j = i + 1; j < spheres.length; j++) collide(spheres[i], spheres[j])
      spheres.forEach(s => { s.update(); s.draw() })
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('touchstart', requestGyro)
      window.removeEventListener('click', requestGyro)
    }
  }, [])

  const destinationFor = (r) => {
    if (r === 'admin' || r === 'super_admin') return '/admin'
    if (r === 'psychologist') return '/psychologist'
    if (r === 'psychometrician') {
      return '/psychometrician'
    }
    return '/client/home'
  }

  const [showSuccessLoader, setShowSuccessLoader] = useState(false)

  if (loading && session) return <LoadingScreen label="Resuming session..." />
  if (session && profile) return <Navigate to={destinationFor(profile.role)} replace />
  if (showSuccessLoader) return <LoadingScreen label="Preparing dashboard..." />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { profile } = await signIn(email, password)
      setShowSuccessLoader(true)
      navigate(destinationFor(profile.role))
    } catch (err) {
      toast.error(err.message || 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await api.forgotPassword(forgotEmail)
      setForgotEmail('')
      toast.success("We've sent a recovery link to your email. Please check your inbox.")
    } catch (err) {
      toast.error(err.message || 'Failed to send recovery link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen text-stone-800 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden selection:bg-violet selection:text-white font-sans" style={{ background: 'radial-gradient(circle at center, #2e1065 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      <SplashCursor
        DENSITY_DISSIPATION={3.5}
        VELOCITY_DISSIPATION={2}
        PRESSURE={0.1}
        CURL={3}
        SPLAT_RADIUS={0.2}
        SPLAT_FORCE={6000}
        COLOR_UPDATE_SPEED={10}
        SHADING
        RAINBOW_MODE={false}
        COLOR="#A855F7"
      />
      {/* Magical Bouncing Orbs Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0 pointer-events-none"
        style={{ display: 'block' }}
      />

      {/* Desktop Floating Back Button */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="hidden md:inline-flex absolute top-6 left-6 z-20 items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-bold text-white/80 transition-all hover:border-purple-400/50 hover:text-white shadow-sm cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Return
      </button>

      {/* Main Login Card */}
      <style>{`
        @keyframes slide-down-fast {
          0% { opacity: 0; transform: translateY(-50px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down-fast {
          animation: slide-down-fast 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>
      <section className="relative z-10 w-full max-w-5xl min-h-[520px] sm:min-h-[560px] overflow-hidden rounded-3xl border-0 bg-white dark:bg-slate-900 shadow-2xl grid grid-cols-1 md:grid-cols-12 my-4 sm:my-12 animate-slide-down-fast opacity-0" style={{ animationDelay: '0.1s' }}>
        {/* Washi Tape Accent */}
        <div className="scrapbook-tape-violet scrapbook-tape -top-3 right-12 rotate-[-2deg]" />

        {/* Sidebar Brand Column (Visible on md+) */}
        <aside className="relative hidden md:flex md:col-span-5 bg-gradient-to-br from-[#1b112e] via-[#171226] to-[#120c1d] border-r border-purple-900/40 p-10 lg:p-12 flex-col items-center justify-center overflow-hidden text-white">
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 bg-violet/20 blur-2xl pointer-events-none" />

          {/* Centered Brand Logo */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            <img src="/logo-cymon.png" alt="ClearMind" className="h-20 w-20 object-contain drop-shadow-md" />
            <div className="flex flex-col items-center">
              <span className="text-4xl text-white leading-none font-['Against']">ClearMind</span>
              <span className="text-[11px] tracking-widest text-[#a57aff] font-bold uppercase mt-1.5">Psychological Services</span>
            </div>
            <p className="text-sm text-purple-200/80 font-light max-w-[240px] leading-relaxed pt-2">
              Clarity of Mind, Journey to Wellness.
            </p>
          </div>
        </aside>

        {/* Form Column with Color Background */}
        <div className="p-7 sm:p-12 lg:p-14 md:col-span-7 flex flex-col justify-center bg-gradient-to-br from-purple-50/40 via-violet-50/20 to-white dark:from-slate-900 dark:via-purple-900/10 dark:to-slate-950">
          {/* Mobile-only Header Row with Logo & Back Button */}
          <div className="md:hidden flex items-center justify-between gap-3 mb-6 pb-4 border-b border-purple-100">
            <div className="flex items-center gap-2.5">
              <img src="/logo-cymon.png" alt="ClearMind" className="h-8 w-8 object-contain" />
              <div className="flex flex-col">
                <span className="text-xl text-stone-900 dark:text-slate-100 leading-none" style={{ fontFamily: 'Against' }}>ClearMind</span>
                <span className="text-[8px] tracking-widest text-purple-900 dark:text-purple-400 font-semibold uppercase mt-0.5">Psychological Services</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-slate-700 bg-purple-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-violet dark:text-purple-300 hover:bg-violet hover:text-white dark:hover:bg-purple-900 transition shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return</span>
            </button>
          </div>

          {isForgot ? (
            <div className="flex flex-col h-full animate-slide-down-fast">
              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp} className="flex flex-col gap-5 flex-1 justify-center">
                  <div>
                    <span className="text-xs font-bold text-violet uppercase tracking-widest bg-violet/10 border border-violet/20 px-3 py-1 rounded-full inline-block mb-3">
                      PASSWORD RECOVERY
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-slate-100 tracking-tight">
                      Forgot password?
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed font-sans">
                      Enter your registered email address and we'll send a 6-digit verification code to reset your password.
                    </p>
                  </div>

                  <Input
                    label="Email address"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`cymon-pushable-btn w-full mt-4 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front py-[14px]">
                      {submitting ? 'Sending code…' : 'Send Verification Code ➔'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={closeForgot}
                    className="text-center text-xs font-bold text-violet hover:text-violet-dark cursor-pointer bg-transparent border-0 mt-1"
                  >
                    ← Back to Log In
                  </button>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5 flex-1 justify-center animate-slide-down-fast">
                  <div>
                    <span className="text-xs font-bold text-violet uppercase tracking-widest bg-violet/10 border border-violet/20 px-3 py-1 rounded-full inline-block mb-3">
                      VERIFICATION
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-slate-100 tracking-tight">
                      Check your email
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed font-sans">
                      We sent a 6-digit verification code to <span className="font-semibold text-stone-800 dark:text-slate-200">{forgotEmail}</span>. The code expires in 10 minutes.
                    </p>
                  </div>

                  <div className="flex gap-2 justify-between max-w-[320px] mx-auto w-full my-2">
                    {forgotOtp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        onPaste={handleOtpPaste}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 border-purple-100 rounded-xl text-violet focus:border-violet focus:ring-2 focus:ring-violet/20 bg-white shadow-sm transition-all outline-none"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`cymon-pushable-btn w-full mt-4 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front py-[14px]">
                      {submitting ? 'Verifying…' : 'Verify Code ➔'}
                    </span>
                  </button>

                  <div className="flex justify-between items-center px-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-center text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer bg-transparent border-0"
                    >
                      ← Change Email
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={submitting}
                      className="text-center text-xs font-bold text-violet hover:text-violet-dark cursor-pointer bg-transparent border-0 disabled:opacity-50"
                    >
                      Resend Code
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-5 flex-1 justify-center animate-slide-down-fast">
                  <div>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mb-3">
                      VERIFIED
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-slate-100 tracking-tight">
                      Create new password
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed font-sans">
                      Your new password must be strong and secure.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (passwordErrors.length > 0) setPasswordErrors(validatePassword(e.target.value))
                      }}
                      required
                    />
                    {/* Live checklist so requirements are monitored while typing,
                        not only as an error after submit. */}
                    <PasswordChecklist password={newPassword} />

                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  {passwordErrors.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
                      <p className="font-bold mb-1">Password must contain:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {passwordErrors.map(err => <li key={err}>{err}</li>)}
                      </ul>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`cymon-pushable-btn w-full mt-4 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front py-[14px]">
                      {submitting ? 'Resetting…' : 'Reset Password'}
                    </span>
                  </button>
                </form>
              )}
              
              {showSuccessModal && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center animate-slide-down-fast">
                  <div className="bg-white border border-stone-200 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-extrabold text-stone-900 mb-2">Password Reset!</h3>
                    <p className="text-sm text-stone-600 mb-6">
                      Your password has been successfully updated. You can now log in with your new credentials.
                    </p>
                    <button 
                      onClick={handleSuccessClose} 
                      className="cymon-pushable-btn w-full mt-2"
                    >
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front py-[14px]">
                        Return to Log In
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-slate-100 tracking-tight">
                  Welcome Back
                </h1>
                <p className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-slate-400 leading-relaxed font-sans">
                  Sign in to access assessments, intervention plans, and specialist summaries.
                </p>
              </div>

              <Input
                label="Email address or Account Number/ID"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or CMPS-XXXX-XXX"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center justify-between">
                <Checkbox
                  label="Remember me"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="text-stone-700 dark:text-slate-300 font-medium text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs font-bold text-violet hover:text-violet-dark cursor-pointer bg-transparent border-0 p-0"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`cymon-pushable-btn w-full mt-4 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front py-[14px]">
                  {submitting ? 'Signing in…' : 'Log In'}
                </span>
              </button>

              <p className="text-center text-xs text-stone-500 mt-2 font-sans leading-relaxed">
                Need an account? Please contact the ClearMind admin office to be registered.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default Login
