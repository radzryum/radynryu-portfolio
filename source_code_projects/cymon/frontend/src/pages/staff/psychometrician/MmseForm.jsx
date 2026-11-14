import { Fragment, useState } from 'react'
import FormShell from '../../../components/ui/FormShell'
import FormHeading from '../../../components/ui/FormHeading'
import BlankField from '../../../components/ui/BlankField'
import SignaturePad from '../../../components/ui/SignaturePad'
import Checkbox from '../../../components/ui/Checkbox'
import DatePicker from '../../../components/ui/DatePicker'
import { blankInput, cellInput } from '../../../components/ui/formStyles'

const th =
  'border border-slate-500 dark:border-slate-600 bg-purple-100 dark:bg-purple-950 px-2 py-1 text-center text-xs font-bold text-slate-800 dark:text-purple-100'
const rowLabelCell = 'border border-slate-500 dark:border-slate-600 bg-purple-50 dark:bg-slate-800 px-2 py-1 text-left text-sm text-slate-800 dark:text-slate-100 transition-colors'
const inputCell = 'border border-slate-500 dark:border-slate-600 p-0 text-center'

const YNA = ['Yes', 'No', 'N/A']
const YN = ['Yes', 'No']

const DOMAINS = [
  {
    numeral: 'I',
    heading: 'Practical Domain',
    columns: YNA,
    categories: [
      {
        name: 'A. APPEARANCE',
        items: [{ n: 1, text: 'Dresses appropriately for the occasion' }],
      },
      {
        name: 'B. ACTIVITIES OF DAILY LIVING',
        items: [
          { n: 1, text: 'Opens a simple container or zipper' },
          { n: 2, text: 'Can demonstrate handwashing when asked' },
          { n: 3, text: 'Removes or puts on a cloth/item (shoe, earring)' },
          { n: 4, text: 'Can independently drink from a cup or bottle' },
        ],
      },
    ],
  },
  {
    numeral: 'II',
    heading: 'Conceptual Domain',
    columns: YNA,
    categories: [
      {
        name: 'A. OBJECT RECOGNITION',
        items: [
          { n: 1, text: 'Names at least two(2) familiar objects (pen, bottle)' },
          { n: 2, text: 'Can identify familiar faces (mother, father)' },
        ],
      },
      {
        name: 'B. IDENTIFYING DETAILS',
        items: [
          { n: 1, text: 'Can state his/her own name' },
          { n: 2, text: 'Can tell his/her birthday and/or age' },
        ],
      },
      {
        name: 'C. PLACE RECOGNITION',
        items: [
          { n: 1, text: 'Can identify the current location' },
          { n: 2, text: 'Can tell his/her home address (landmark)' },
        ],
      },
      {
        name: 'D. TIME PERCEPTION',
        items: [
          { n: 1, text: 'Can identify current time (approximate acceptable)' },
          { n: 2, text: 'Can identify the current year' },
        ],
      },
      {
        name: 'E. MEMORY',
        items: [
          { n: 1, text: 'Can recall simple past details (food eaten yesterday)' },
          { n: 2, text: 'Can repeat two named objects' },
        ],
      },
    ],
  },
  {
    numeral: 'III',
    heading: 'Social Domain',
    columns: YNA,
    categories: [
      {
        name: 'A. AFFECT & INTERACTION',
        items: [
          { n: 1, text: 'Makes eye contact when name is called' },
          { n: 2, text: 'Responds to greetings (verbal or gesture)' },
          { n: 2, text: 'Can show emotions (happy, sad)' },
          { n: 3, text: 'Does not show aggressive behaviors' },
          { n: 4, text: 'Can identify basic emotions' },
        ],
      },
    ],
  },
  {
    numeral: 'IV',
    heading: 'Bodily Kinesthetics Domain',
    columns: YNA,
    categories: [
      {
        name: 'A. FINE MOTOR SKILLS',
        items: [
          { n: 1, text: 'Can hold objects appropriately (pencil)' },
          { n: 2, text: 'Writes letters or name legibly' },
          { n: 3, text: 'Can color within the lines' },
          { n: 4, text: 'Can demonstrate hand-eye coordination (tracing)' },
          { n: 5, text: 'Can copy basic shapes (circle, triangle, square)' },
        ],
      },
      {
        name: 'B. GROSS MOTOR SKILLS',
        items: [
          { n: 1, text: 'Can stand on one foot briefly' },
          { n: 2, text: 'Walks steadily across the room' },
          { n: 3, text: 'Can jump forward with both feet together' },
          { n: 4, text: 'Climb stairs using alternating feet' },
        ],
      },
    ],
  },
  {
    numeral: '',
    heading: 'Perceptual Disturbances',
    columns: YNA,
    categories: [
      {
        name: 'PERCEPTUAL DISTURBANCES',
        items: [
          { n: 1, text: 'Hallucination' },
          { n: 2, text: 'Delusions' },
        ],
      },
    ],
  },
  {
    numeral: '',
    heading: 'Stimming',
    columns: YNA,
    categories: [
      {
        name: 'STIMMING',
        items: [
          { n: 1, text: 'Verbal (echolalia, humming)' },
          { n: 2, text: 'Auditory (sound sensitivity)' },
          { n: 3, text: 'Visual (fixation to objects, constant eye movement)' },
          { n: 4, text: 'Proprioceptive (jumping, crashing into objects)' },
          { n: 5, text: 'Vestibular (rocking, spinning)' },
          { n: 6, text: 'Oral (chewing, biting, sucking)' },
          { n: 7, text: 'Tactile (excoriation, skin rubbing, fidgeting)' },
        ],
      },
    ],
  },
]

function ChecklistTable({ columns, categories }) {
  const span = columns.length + 3
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <colgroup>
          <col className="w-8" />
          <col />
          {columns.map((c) => (
            <col key={c} className="w-12" />
          ))}
          <col className="w-2/5" />
        </colgroup>
        <tbody>
          {categories.map((cat, ci) => (
            <Fragment key={cat.name}>
              {ci === 0 ? (
                <tr>
                  <td colSpan={2} className={th}>
                    {cat.name}
                  </td>
                  {columns.map((c) => (
                    <td key={c} className={th}>
                      {c}
                    </td>
                  ))}
                  <td className={th}>Remarks</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={span} className={th}>
                    {cat.name}
                  </td>
                </tr>
              )}
              {cat.items.map((it, ii) => (
                <tr key={`${cat.name}-${ii}`}>
                  <td className={`${rowLabelCell} text-center`}>{it.n}</td>
                  <td className={rowLabelCell}>{it.text}</td>
                  {columns.map((c) => (
                    <td key={c} className={`${inputCell} align-middle text-center`}>
                      <div className="flex justify-center h-full items-center">
                        <Checkbox className="" />
                      </div>
                    </td>
                  ))}
                  <td className={inputCell}>
                    <input className={cellInput} />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MmseForm({ onClose, inline = false }) {
  const [evaluatorName, setEvaluatorName] = useState('')
  const [evaluatorSig, setEvaluatorSig] = useState(null)
  const [evalDate, setEvalDate] = useState('')

  return (
    <FormShell
      title="Mini-Mental Status Examination"
      code="CMPS:SE-FO-04 rev.0 02192026"
      confidential={false}
      onClose={onClose}
      multiPage={true}
      inline={inline}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <BlankField label="Date" labelClassName="w-40" />

          <FormHeading numeral="">Personal Information of Student</FormHeading>
          <BlankField label="Full Name (LN, FN MI)" labelClassName="w-56" />
          <BlankField label="Age/Sex" labelClassName="w-56" />
          <BlankField label="Birthdate" labelClassName="w-56" />

          <FormHeading numeral="">Diagnosis</FormHeading>
          <BlankField
            label="Was the student previously diagnosed/assessed?"
            labelClassName="w-auto"
          >
            <span className="flex items-center gap-6 text-[12.5px] text-slate-800 dark:text-slate-100 transition-colors">
              <Checkbox label="Yes" />
              <Checkbox label="No" />
            </span>
          </BlankField>
          <BlankField label="Diagnosis" labelClassName="w-56" />
          <BlankField label="Medical History" labelClassName="w-56" />
          <BlankField label="Family History" labelClassName="w-56" />
        </div>

        <div>
          <FormHeading numeral={DOMAINS[0].numeral}>{DOMAINS[0].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[0].columns} categories={DOMAINS[0].categories} />
          <div className="mt-2">
            <BlankField label="Remarks" labelClassName="w-20" />
          </div>
        </div>

        <div>
          <FormHeading numeral={DOMAINS[1].numeral}>{DOMAINS[1].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[1].columns} categories={DOMAINS[1].categories} />
          <div className="mt-2">
            <BlankField label="Remarks" labelClassName="w-20" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <FormHeading numeral={DOMAINS[2].numeral}>{DOMAINS[2].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[2].columns} categories={DOMAINS[2].categories} />
          <div className="mt-2">
            <BlankField label="Remarks" labelClassName="w-20" />
          </div>
        </div>
        <div>
          <FormHeading numeral={DOMAINS[3].numeral}>{DOMAINS[3].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[3].columns} categories={DOMAINS[3].categories} />
          <div className="mt-2">
            <BlankField label="Remarks" labelClassName="w-20" />
          </div>
        </div>
        <div>
          <FormHeading numeral={DOMAINS[4].numeral}>{DOMAINS[4].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[4].columns} categories={DOMAINS[4].categories} />
        </div>
        <div>
          <FormHeading numeral={DOMAINS[5].numeral}>{DOMAINS[5].heading}</FormHeading>
          <ChecklistTable columns={DOMAINS[5].columns} categories={DOMAINS[5].categories} />
        </div>

        <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-2">Signature over Printed Name of Evaluator / Date</div>
          <input
            type="text"
            className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm"
            placeholder="Printed Name of Evaluator"
            value={evaluatorName}
            onChange={(e) => setEvaluatorName(e.target.value)}
          />
          <div className="mt-3">
            <SignaturePad label="Signature" value={evaluatorSig} onChange={setEvaluatorSig} />
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Sign with mouse, trackpad, or touchscreen.</div>
          <div className="mt-2">
            <DatePicker value={evalDate} onChange={(value) => setEvalDate(value)} ariaLabel="Evaluation date" />
          </div>
        </div>
      </div>
    </FormShell>
  )
}

export default MmseForm
