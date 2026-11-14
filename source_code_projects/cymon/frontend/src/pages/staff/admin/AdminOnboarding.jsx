import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createOnboardingSteps } from './onboardingSteps'

const DASHBOARDS = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/admin/overview',
    workspaceKey: 'overview-workspace',
    controlKeys: ['overview-metrics', 'overview-audit'],
    detailTargetKeys: ['overview-metrics', 'overview-audit'],
    sidebarText: 'Overview is the admin starting point. Use this sidebar button to return to the clinic summary at any time.',
    dashboardText: 'The Overview dashboard brings the clinic summary into one place so you can scan totals, status counts, and recent activity.',
    details: [
      { label: 'Summary cards', text: 'Open a dashboard area to review the latest totals and status counts.' },
      { label: 'Recent Audit Trail', text: 'Review the latest important changes made across the clinic.' },
    ],
  },
  {
    key: 'patients',
    label: 'Students',
    path: '/admin/patients',
    workspaceKey: 'students-workspace',
    controlKeys: ['student-admission-form', 'student-export-list', 'student-view-record'],
    detailTargetKeys: ['student-admission-form', 'student-export-list', 'student-view-record'],
    sidebarText: 'Students opens the student management area. Use this sidebar button to register, find, and manage student records.',
    dashboardText: 'The Students dashboard manages student records, admission forms, assigned clinicians, and student details.',
    details: [
      { label: 'Open Student Admission Form', text: 'Creates a new record and opens the full form for student, guardian, emergency-contact, signature, and clinician-assignment details.' },
      { label: 'Export List', text: 'Downloads the visible student records for administrative use.' },
      { label: 'View', text: 'Opens a student record for details, assignments, admission forms, editing, and PDF view.' },
    ],
  },
  {
    key: 'applications',
    label: 'Applications',
    path: '/admin/applications',
    workspaceKey: 'applications-workspace',
    controlKeys: ['applications-qr', 'applications-list'],
    detailTargetKeys: ['applications-qr', 'applications-list'],
    sidebarText: 'Applications opens guardian admission submissions. Use this sidebar button to review online applications sent through the public link or QR code.',
    dashboardText: 'The Applications workspace collects guardian submissions from the public admission link, with tabs that move each one from pending to imported.',
    details: [
      { label: 'Public admission QR & link', text: 'Show this QR code at the front desk or send the link by chat — guardians apply from their own phones, no account needed.' },
      { label: 'Pending & imported tabs', text: 'Switch tabs, search by child or parent name, then import a submission to open the admission form prefilled for review and the representative signature.' },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    path: '/admin/employees',
    workspaceKey: 'employees-workspace',
    controlKeys: ['employee-register'],
    detailTargetKeys: ['employee-register', 'employees-workspace'],
    sidebarText: 'Employees opens staff account management. Use this sidebar button to manage clinic personnel and professional credentials.',
    dashboardText: 'The Employees dashboard manages employee accounts, roles, professions, license details, and verification documents.',
    details: [
      { label: 'Register Employee', text: 'Create a staff account and add its role, professional details, and license verification.' },
      { label: 'Employee list', text: 'Search, view, edit roles, reset access, or deactivate an employee record.' },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    path: '/admin/compliance',
    workspaceKey: 'compliance-workspace',
    controlKeys: ['compliance-directory'],
    detailTargetKeys: ['compliance-directory', 'compliance-workspace'],
    sidebarText: 'Compliance opens the student form tracking area. Use this sidebar button to manage the required forms for each student.',
    dashboardText: 'The Compliance dashboard contains the Student Admission and SPED forms and their completion status.',
    details: [
      { label: 'Student Directory', text: 'Select one student to load only that student\'s forms.' },
      { label: 'View / Answer Form', text: 'Review a saved form or complete it when it has not been submitted yet.' },
    ],
  },
  {
    key: 'schedule',
    label: 'Front Desk',
    path: '/admin/schedule',
    workspaceKey: 'schedule-workspace',
    controlKeys: ['schedule-add-appointment'],
    detailTargetKeys: ['schedule-add-appointment', 'schedule-workspace'],
    sidebarText: 'Front Desk opens the clinic calendar. Use this sidebar button to manage individual and group appointments.',
    dashboardText: 'The Front Desk dashboard manages appointments, dates, times, practitioners, students, and group sessions.',
    details: [
      { label: 'Add Appointment', text: 'Create an individual or group appointment and assign participants and practitioners.' },
      { label: 'Search and filters', text: 'Find appointments by student or practitioner and move through calendar months.' },
    ],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    path: '/admin/attendance',
    workspaceKey: 'attendance-workspace',
    controlKeys: ['attendance-preview-form'],
    detailTargetKeys: ['attendance-workspace', 'attendance-workspace', 'attendance-preview-form'],
    sidebarText: 'Attendance opens the monthly student attendance workspace. Use this sidebar button to record sessions and attendance.',
    dashboardText: 'The Attendance dashboard records monthly attendance, session details, notes, and facilitator sign-off for each student.',
    details: [
      { label: 'Student Directory', text: 'Choose the student whose monthly attendance record you need to manage.' },
      { label: 'Month controls', text: 'Move between months and update the selected month\'s attendance and session details.' },
      { label: 'Preview Form', text: 'Open the official attendance document for review or printing.' },
    ],
  },
  {
    key: 'records',
    label: 'Clinical Records',
    path: '/admin/records',
    workspaceKey: 'clinical-records-workspace',
    controlKeys: ['clinical-records-view'],
    detailTargetKeys: ['clinical-records-workspace', 'clinical-records-view'],
    sidebarText: 'Clinical Records opens finalized student documents. Use this sidebar button to review official clinic records.',
    dashboardText: 'The Clinical Records dashboard lists finalized documents connected to students.',
    details: [
      { label: 'Search and filter', text: 'Find records by student name or document type.' },
      { label: 'View PDF', text: 'Open the finalized document in the official read-only viewer.' },
    ],
  },
  {
    key: 'exports',
    label: 'Data Export',
    path: '/admin/exports',
    workspaceKey: 'admin-data-export',
    controlKeys: ['admin-data-export'],
    detailTargetKeys: ['admin-data-export', 'admin-data-export'],
    sidebarText: 'Data Export opens one-click clinic backup downloads. Use this sidebar button to save student records, staff accounts, and finalized documents.',
    dashboardText: 'The Data Export dashboard downloads backup copies: students, employees, and completed documents as CSV, Excel, or JSON, plus a ZIP of every finalized PDF.',
    details: [
      { label: 'Backup cards', text: 'Pick a format per card, then Download. The ZIP card bundles every finalized document as an official PDF.' },
      { label: 'Audit logging', text: 'Every download is recorded in the Audit Trail with its file name and row count.' },
    ],
  },
  {
    key: 'landing',
    label: 'Content Manager',
    path: '/admin/landing',
    workspaceKey: 'landing-workspace',
    controlKeys: ['landing-toolbar', 'landing-sections'],
    detailTargetKeys: ['landing-toolbar', 'landing-sections'],
    sidebarText: 'Content Manager opens the public website editor. Use this sidebar button to update what guardians see on the landing page.',
    dashboardText: 'The Content Manager edits the public landing page: section texts and images on the side, with a save bar that drafts or publishes.',
    details: [
      { label: 'Save, Preview & Publish bar', text: 'Save keeps edits as a draft, Preview shows how the page looks, and Publish makes it live on the public site.' },
      { label: 'Website sections', text: 'Pick a section here to edit its content for the public landing page.' },
    ],
  },
  {
    key: 'announcements',
    label: 'Announcement',
    path: '/admin/announcements',
    workspaceKey: 'announcements-workspace',
    controlKeys: ['announcement-publish'],
    detailTargetKeys: ['announcements-workspace', 'announcement-publish', 'announcements-workspace'],
    sidebarText: 'Announcement opens clinic communication tools. Use this sidebar button to publish notices to parents, caregivers, or staff.',
    dashboardText: 'The Announcement dashboard creates and manages notices for the clinic community.',
    details: [
      { label: 'Announcement form', text: 'Write the title and message, choose an audience, and optionally add an image.' },
      { label: 'Publish Announcement', text: 'Send the announcement to the selected audience.' },
      { label: 'Manage posts', text: 'Edit or remove existing announcements from the list.' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit Trail',
    path: '/admin/audit',
    workspaceKey: 'audit-workspace',
    controlKeys: ['audit-filters'],
    detailTargetKeys: ['audit-filters', 'audit-workspace'],
    sidebarText: 'Audit Trail opens the clinic activity history. Use this sidebar button to review who changed what and when.',
    dashboardText: 'The Audit Trail dashboard records important activity across the clinic, including the user, action, affected record, and time.',
    details: [
      { label: 'Search and Action filter', text: 'Narrow the log by actor, detail, or action type.' },
      { label: 'Log rows', text: 'Select an entry to inspect its complete activity details.' },
    ],
  },
]

const ADMIN_STEPS = createOnboardingSteps(DASHBOARDS)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function AdminOnboarding({ open, onComplete, steps = ADMIN_STEPS, ariaLabel = 'Admin onboarding', onStepChange, retargetSignal }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targets, setTargets] = useState([])
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [calloutLayout, setCalloutLayout] = useState({})
  const [isFinishing, setIsFinishing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const openedRef = useRef(false)
  const calloutRefs = useRef(new Map())
  const navigate = useNavigate()

  const step = steps[stepIndex]

  const goToStep = (index) => {
    const nextStep = steps[index]
    if (!nextStep) return
    navigate(nextStep.path)
    setStepIndex(index)
    onStepChange?.(nextStep)
  }

  const handleComplete = () => {
    setIsFinishing(true)
    setTimeout(() => setModalVisible(true), 10)
  }

  const finalizeOnboarding = () => {
    setIsClosing(true)
    setTimeout(() => {
      onComplete()
    }, 300)
  }

  useEffect(() => {
    if (!open) {
      openedRef.current = false
      setIsFinishing(false)
      setModalVisible(false)
      setIsClosing(false)
      setStepIndex(0)
      onStepChange?.(null)
      return undefined
    }
    if (openedRef.current) return undefined

    openedRef.current = true
    navigate(steps[0].path)
    setStepIndex(0)
    onStepChange?.(steps[0])
    return undefined
  }, [navigate, open, steps, onStepChange])

  useEffect(() => {
    if (!open) return undefined

    const updateTarget = () => {
      setIsMobile(window.innerWidth < 768)
      if (!step.targetKeys?.length) {
        setTargets([])
        return
      }
      const found = step.targetKeys
        .map((key) => ({ key, element: document.querySelector(`[data-onboarding-key="${key}"]`) }))
        .filter(({ element }) => element)
      // Sidebar tabs below the fold (e.g. Content Manager) report an
      // off-viewport rect, so the highlight lands on empty space. Bring the
      // first target into view first — 'nearest' leaves already-visible
      // dashboard sections untouched.
      if (found.length) {
        try {
          found[0].element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        } catch {
          // older browsers — fall through and measure anyway
        }
      }
      const nextTargets = found
        .map(({ key, element }) => {
          const rect = element.getBoundingClientRect()
          return {
            key,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        })
      setTargets(nextTargets)
    }

    updateTarget()
    window.addEventListener('resize', updateTarget)
    window.addEventListener('scroll', updateTarget, true)
    const settle = setTimeout(updateTarget, 350)
    return () => {
      window.removeEventListener('resize', updateTarget)
      window.removeEventListener('scroll', updateTarget, true)
      clearTimeout(settle)
    }
  }, [open, step.targetKeys, retargetSignal])

  const primaryTarget = targets[0]
  const targetMap = useMemo(() => new Map(targets.map((item) => [item.key, item])), [targets])
  
  const activeTargets = useMemo(() => {
    if (isMobile && step.callouts?.length > 1) {
      const primaryKey = step.callouts[0].targetKey
      return targets.filter((t) => t.key === primaryKey)
    }
    return targets
  }, [isMobile, step.callouts, targets])

  const calloutCards = useMemo(() => {
    if (step.callouts?.length) {
      return isMobile && step.callouts.length > 1 ? [step.callouts[0]] : step.callouts
    }
    return [{ targetKey: primaryTarget?.key || null, label: step.title, text: step.text }]
  }, [isMobile, primaryTarget, step])

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }

    const frame = window.requestAnimationFrame(() => {
      const occupied = []
      const nextLayout = {}
      const viewportBottom = Math.max(16, window.innerHeight - 96)
      const gap = 14
      const fits = (candidate, width, height, target, allowTargetOverlap) => (
        candidate.left >= 16
        && candidate.top >= 16
        && candidate.left + width <= window.innerWidth - 16
        && candidate.top + height <= viewportBottom
        && occupied.every((item) => (
          candidate.left + width + gap <= item.left
          || item.left + item.width + gap <= candidate.left
          || candidate.top + height + gap <= item.top
          || item.top + item.height + gap <= candidate.top
        ))
        && (allowTargetOverlap || !target || (
          candidate.left + width + gap <= target.left
          || target.left + target.width + gap <= candidate.left
          || candidate.top + height + gap <= target.top
          || target.top + target.height + gap <= candidate.top
        ))
      )

      calloutCards.forEach((callout, index) => {
        const key = `${callout.targetKey || 'welcome'}-${callout.label}`
        const node = calloutRefs.current.get(key)
        if (!node) return

        const rect = node.getBoundingClientRect()
        const target = targetMap.get(callout.targetKey)
        const isLargeTarget = target && target.width > window.innerWidth * 0.5 && target.height > window.innerHeight * 0.5
        const candidates = target
          ? isLargeTarget
            ? [
                { left: target.left + 16, top: target.top + 16 },
                { left: target.left + target.width - rect.width - 16, top: target.top + 16 },
                { left: 16, top: 88 + index * 12 },
              ]
            : [
                { left: Math.max(16, Math.min(window.innerWidth - rect.width - 16, target.left + target.width / 2 - rect.width / 2)), top: target.top + target.height + gap },
                { left: Math.max(16, Math.min(window.innerWidth - rect.width - 16, target.left + target.width / 2 - rect.width / 2)), top: target.top - rect.height - gap },
                { left: target.left + target.width + gap, top: target.top + target.height / 2 - rect.height / 2 },
                { left: target.left - rect.width - gap, top: target.top + target.height / 2 - rect.height / 2 },
              ]
          : [{ left: (window.innerWidth - rect.width) / 2, top: (window.innerHeight - rect.height) / 2 - 36 }]

        const allowTargetOverlap = false

        let chosen = candidates.find((candidate) => fits(candidate, rect.width, rect.height, target, allowTargetOverlap))
        
        if (!chosen) {
          const maxLeft = Math.max(16, window.innerWidth - rect.width - 16)
          const maxTop = Math.max(16, viewportBottom - rect.height)
          for (let top = 16; top <= maxTop && !chosen; top += 12) {
            for (let left = 16; left <= maxLeft; left += 12) {
              const candidate = { left, top }
              if (fits(candidate, rect.width, rect.height, target, allowTargetOverlap)) {
                chosen = candidate
                break
              }
            }
          }
        }
        
        if (!chosen && !allowTargetOverlap) {
          const maxLeft = Math.max(16, window.innerWidth - rect.width - 16)
          const maxTop = Math.max(16, viewportBottom - rect.height)
          for (let top = 16; top <= maxTop && !chosen; top += 12) {
            for (let left = 16; left <= maxLeft; left += 12) {
              const candidate = { left, top }
              if (fits(candidate, rect.width, rect.height, target, true)) {
                chosen = candidate
                break
              }
            }
          }
        }
        if (!chosen) {
          const fallback = candidates[0]
          const maxLeft = Math.max(16, window.innerWidth - rect.width - 16)
          const maxTop = Math.max(16, viewportBottom - rect.height)
          chosen = {
            left: clamp(fallback.left, 16, maxLeft),
            top: clamp(fallback.top, 16, maxTop),
          }
        }

        const placed = { left: chosen.left, top: chosen.top, width: rect.width, height: rect.height }
        occupied.push(placed)
        nextLayout[key] = { left: placed.left, top: placed.top }
      })

      setCalloutLayout(nextLayout)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [calloutCards, open, stepIndex, targetMap, targets])

  if (!open) return null

  const isLast = stepIndex === steps.length - 1
  const isSidebarStep = step.key.endsWith('-sidebar')
  const nextLabel = isLast
    ? 'Finish'
    : step.key === 'welcome'
      ? 'Start tour'
      : isSidebarStep
        ? 'Dashboard parts'
        : 'Next sidebar'
  const calloutWidth = Math.min(300, window.innerWidth - 32)

  if (isFinishing) {
    const overlayClass = `fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity duration-300 ${modalVisible && !isClosing ? 'opacity-100' : 'opacity-0'}`
    const modalClass = `w-full max-w-sm transform rounded-3xl bg-white dark:bg-slate-900 transition-colors p-8 text-center shadow-2xl transition-all duration-300 ${modalVisible && !isClosing ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`

    return (
      <div className={overlayClass}>
        <div className={modalClass}>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-inner ring-8 ring-green-50">
            <svg className="h-10 w-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 transition-colors">All Set!</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400 transition-colors">
            You have completed the tour and are now ready to use the CyMon dashboard.
          </p>
          <button
            type="button"
            onClick={finalizeOnboarding}
            className="mt-8 w-full rounded-xl bg-purple-700 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-purple-800 hover:shadow-purple-500/30 active:scale-95"
          >
            Let&apos;s Get Started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] bg-transparent" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      {activeTargets.length ? (
        <svg
          className="pointer-events-none fixed inset-0 h-full w-full"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          aria-hidden="true"
        >
          <defs>
            <mask id="admin-onboarding-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={window.innerWidth} height={window.innerHeight}>
              <rect width={window.innerWidth} height={window.innerHeight} fill="white" />
              {activeTargets.map((item) => (
                <rect
                  key={`hole-${item.key}`}
                  x={item.left - 6}
                  y={item.top - 6}
                  width={item.width + 12}
                  height={item.height + 12}
                  rx="16"
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15,23,42,0.35)" mask="url(#admin-onboarding-mask)" />
          {activeTargets.map((item) => (
            <rect
              key={`outline-${item.key}`}
              x={item.left - 7.5}
              y={item.top - 7.5}
              width={item.width + 15}
              height={item.height + 15}
              rx="17.5"
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
            />
          ))}
        </svg>
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-slate-950/15" />
      )}

      {calloutCards.map((callout) => {
        const key = `${callout.targetKey || 'welcome'}-${callout.label}`
        const style = calloutLayout[key] || { left: 16, top: 16 }
        return (
          <div
            key={key}
            ref={(node) => {
              if (node) calloutRefs.current.set(key, node)
              else calloutRefs.current.delete(key)
            }}
            className="fixed z-[81] isolate rounded-lg border border-white/25 bg-purple-900/75 p-3 text-purple-50 shadow-xl backdrop-blur-md"
            style={{ left: style.left, top: style.top, width: calloutWidth, visibility: calloutLayout[key] ? 'visible' : 'hidden' }}
          >
            <h2 className="text-sm font-medium text-white">{callout.label}</h2>
            <p className="mt-1.5 text-xs leading-4 text-purple-100">{callout.text}</p>
          </div>
        )
      })}

      <div className="fixed bottom-4 left-1/2 z-[82] isolate flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-white/25 bg-purple-900/75 p-3 text-purple-50 shadow-2xl backdrop-blur-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200">
          {stepIndex + 1} / {steps.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleComplete}
            className="rounded-lg px-3 py-2 text-xs font-medium text-purple-200 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            Skip tour
          </button>
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => goToStep(stepIndex - 1)}
              className="rounded-lg border border-white/30 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (isLast ? handleComplete() : goToStep(stepIndex + 1))}
            className="rounded-lg bg-white px-5 py-2 text-xs font-bold text-purple-900 shadow-lg transition-all hover:bg-purple-50 hover:shadow-purple-500/25 active:scale-95"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminOnboarding
