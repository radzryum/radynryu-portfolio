import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from './PageHeader'
import PageIntro from '../../components/ui/PageIntro'
import Skeleton from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'
import AnswerAssessment from '../staff/psychometrician/AnswerAssessment'
import { api } from '../../lib/api'

function AssessmentFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState(null)
  const [template, setTemplate] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let on = true
    setLoading(true)

    api.client.getPatient()
      .then(async (pd) => {
        const [td, sd] = await Promise.all([
          api.client.assessmentTemplate(id),
          api.client.assessmentSubmission(pd?.patient?.id, id),
        ])
        if (!on) return
        // Merge the clinical profile into the patient object so the
        // assessment form can pre-fill Diagnosis from the admission record.
        setPatient(pd?.patient ? { ...pd.patient, clinical: pd?.clinical || null } : null)
        setTemplate(td?.template || null)
        setSubmission(sd?.submission || null)
      })
      .catch((err) => {
        if (!on) return
        setError(err.message)
      })
      .finally(() => {
        if (on) setLoading(false)
      })

    return () => {
      on = false
    }
  }, [id])

  return (
    <>
      <PageHeader title="Assessment Services" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <PageIntro
            className="hidden sm:block"
            title={template?.title || 'Assessment Form'}
            subtitle="Complete the assessment and submit it from this page."
          />

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/client/assessments')}>
              ← Back to Assessments
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4 rounded-3xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:p-6 transition-colors">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-72 w-full" rounded="rounded-2xl" />
              <Skeleton className="h-14 w-full" rounded="rounded-2xl" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 transition-colors animate-content-fade-in">
              {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors animate-content-fade-in">
              <AnswerAssessment
                inline={true}
                isClient={true}
                patients={[]}
                prefilledPatientId={patient?.id}
                prefilledPatientName={patient ? `${patient.first_name} ${patient.last_name}` : ''}
                prefilledPatient={patient}
                prefilledTemplateId={template?.id}
                prefilledTemplateName={template?.title}
                submission={submission}
                onClose={() => navigate('/client/assessments')}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default AssessmentFormPage
