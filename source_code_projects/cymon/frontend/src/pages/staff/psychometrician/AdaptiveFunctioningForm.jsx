import { useState } from 'react'
import DatePicker from '../../../components/ui/DatePicker'
import FormShell from '../../../components/ui/FormShell'
import FormHeading from '../../../components/ui/FormHeading'
import Radio from '../../../components/ui/Radio'

const DOMAINS = [
  {
    key: 'conceptual', roman: 'I', title: 'Conceptual Domain', sub: 'Communication, language, academics',
    items: [
      ['States full name, age, and identifies parents when asked.', 'Nasasabi ang buong pangalan, edad, at pangalan ng magulang kapag tinanong.'],
      ['Follows 2-step instructions without repeated prompting.', 'Nakakasunod sa 2 hakbang na utos nang hindi inuulit-ulit.'],
      ['Answers WH-questions appropriately in simple conversations.', 'Nakakasagot nang tama sa sino, ano, saan, bakit sa simpleng usapan.'],
      ['Identifies and names common objects and their use.', 'Nakikilala ang bagay at alam ang gamit nito.'],
      ['Recognizes letters, numbers, colors, or shapes appropriate to age level.', 'Nakikilala ang letra, numero, kulay o hugis ayon sa edad.'],
      ['Can count objects correctly and perform simple math.', 'Nakakabilang ng tama at nakakagawa ng simpleng matematika ayon sa edad.'],
      ['Understands time concepts and daily schedule.', 'Naiintindihan ang kahapon, ngayon, bukas at iskedyul ng araw.'],
      ['Expresses needs and feelings using understandable words or gestures.', 'Naipapahayag nang malinaw ang pangangailangan o damdamin.'],
      ['Maintains attention on structured task for 10–15 minutes.', 'Nakakapokus sa gawain ng 10–15 minuto ayon sa edad.'],
      ['Understands cause and effect.', 'Naiintindihan ang sanhi at bunga ng kilos.'],
      ['Understands simple problem-solving.', 'Nakakaisip ng alternatibong solusyon sa simpleng problema.'],
      ['Reads simple words or sentences (if school-aged).', 'Nakakabasa ng simpleng salita o pangungusap ayon sa edad.'],
    ]
  },
  {
    key: 'social', roman: 'II', title: 'Social Domain', sub: 'Interpersonal skills, emotional regulation, social awareness',
    items: [
      ['Initiates interaction with peers or adults appropriately.', 'Kusang nakikipag-ugnayan sa kapwa bata o nakatatanda.'],
      ['Maintains appropriate eye contact during conversation.', 'Nakikipag-eye contact sa pakikipag-usap.'],
      ['Responds appropriately when name is called.', 'Tumutugon agad kapag tinatawag ang pangalan.'],
      ['Engages in cooperative play (sharing, turn-taking).', 'Nakikipaglaro nang may salitan at pagbabahagi.'],
      ['Understands personal space and boundaries.', 'Naiintindihan ang personal space at limitasyon ng iba.'],
      ['Expresses emotions appropriately without extreme reactions.', 'Naipapahayag ang emosyon nang hindi labis o marahas.'],
      ['Recovers from frustration within reasonable time.', 'Nakakabawi agad matapos mainis o magalit.'],
      ['Shows empathy.', 'Nakikiramay kapag may nasasaktan o nalulungkot.'],
      ['Follows group rules in school/home setting.', 'Nakakasunod sa patakaran sa bahay o paaralan.'],
      ['Adjusts behavior according to situation.', 'Naaangkop ang kilos sa sitwasyon.'],
      ['Understands simple social cues.', 'Naiintindihan ang simpleng senyales ng emosyon ng iba.'],
      ['Avoids aggressive behaviors.', 'Hindi madalas nananakit o naghahagis ng gamit.'],
      ['Can recognize familiar faces.', 'Nakakakilala sa mga pamilyar na mukha.'],
    ]
  },
  {
    key: 'practical', roman: 'III', title: 'Practical Domain', sub: 'Daily living skills, self-care, functional independence',
    items: [
      ['Eats independently using utensils properly.', 'Nakakakain nang mag-isa gamit ang kutsara/tinidor.'],
      ['Dresses and undresses with minimal help.', 'Nakakapagbihis at hubad na may kaunting tulong lamang.'],
      ['Uses toilet independently and maintains cleanliness.', 'Nakakagamit ng palikuran nang mag-isa at malinis.'],
      ['Brushes teeth and washes hands independently.', 'Marunong magsipilyo at maghugas ng kamay mag-isa.'],
      ['Follows daily routine.', 'Nakakasunod sa pang-araw-araw na rutina.'],
      ['Packs and organizes school materials.', 'Nakakaayos at nakakapag-impake ng gamit sa paaralan.'],
      ['Understands basic money value and transactions.', 'May simpleng kaalaman sa halaga ng pera.'],
      ['Demonstrates awareness of safety.', 'May kamalayan sa panganib tulad ng sasakyan o matutulis na bagay.'],
      ['Completes simple household chores when instructed.', 'Nakakagawa ng simpleng gawaing bahay kapag inutusan.'],
      ['Travels short familiar distances with supervision.', 'Kayang pumunta sa malapit na lugar na may gabay.'],
      ['Manages personal belongings responsibly.', 'Inaalagaan ang sariling gamit.'],
      ['Seeks help appropriately when confused or unsafe.', 'Humihingi ng tulong kapag nalilito o nasa panganib.'],
    ]
  },
  {
    key: 'gross', roman: 'IV-A', title: 'Gross Motor Skills', sub: 'Malalaking galaw ng katawan',
    items: [
      ['Walks, runs, and stops without losing balance.', 'Nakakalakad at nakakatakbo nang hindi nawawalan ng balanse.'],
      ['Jumps forward with both feet together.', 'Nakakatatalon pasulong gamit ang dalawang paa.'],
      ['Climbs stairs alternating feet.', 'Nakakaakyat ng hagdan nang salitan ang paa.'],
      ['Kicks a ball with coordination and balance.', 'Nakakasipa ng bola nang maayos ang balanse.'],
      ['Throws and catches a medium-sized ball.', 'Nakakahagis at nakakasalo ng bola.'],
      ['Maintains balance on one foot for 5 seconds.', 'Kayang tumayo sa isang paa nang 5 segundo.'],
      ['Participates in playground activities without excessive clumsiness.', 'Nakakalahok sa laro nang hindi madalas nadadapa.'],
      ['Demonstrates body awareness.', 'May kamalayan sa galaw ng katawan at hindi palaging nababangga.'],
      ['Coordinates both sides of the body.', 'Naiko-coordinate ang galaw ng magkabilang bahagi ng katawan.'],
      ['Shows adequate muscle strength for age.', 'May sapat na lakas ayon sa edad.'],
    ]
  },
  {
    key: 'fine', roman: 'IV-B', title: 'Fine Motor Skills', sub: 'Maliliit na galaw ng kamay at daliri',
    items: [
      ['Holds pencil or crayon with appropriate grip.', 'Hawak ang lapis o krayola nang tama.'],
      ['Copies basic shapes.', 'Nakakagaya ng simpleng hugis.'],
      ['Writes letters or name legibly.', 'Nakakasulat nang malinaw ayon sa edad.'],
      ['Uses scissors to cut along a line.', 'Nakakagamit ng gunting nang maayos.'],
      ['Buttons/unbuttons clothing independently.', 'Nakakapagbutones at tanggal ng butones mag-isa.'],
      ['Manipulates small objects without dropping.', 'Nakakahawak ng maliliit na bagay nang hindi madaling nalalaglag.'],
      ['Colors within lines most of the time.', 'Nakakapagkulay sa loob ng linya.'],
      ['Assembles puzzles appropriate for age.', 'Nakakabuo ng puzzle ayon sa edad.'],
      ['Demonstrates hand-eye coordination.', 'May maayos na koordinasyon ng mata at kamay.'],
      ['Shows endurance during writing tasks.', 'Hindi agad napapagod sa pagsusulat.'],
    ]
  },
]

const TOTAL_ITEMS = DOMAINS.reduce((s, d) => s + d.items.length, 0)

const severityFor = (score) => {
  if (score <= 2) return { level: 'severe' }
  if (score <= 4) return { level: 'moderate' }
  if (score <= 7) return { level: 'mild' }
  return { level: 'good' }
}

const LABELS = {
  severe: 'Significant Difficulty', moderate: 'Moderate Difficulty', mild: 'Mild Difficulty', good: 'Age-appropriate Skills',
}
const MOTOR_LABELS = {
  severe: 'Severe Motor Delay', moderate: 'Moderate Motor Delay', mild: 'Mild Motor Delay', good: 'No Significant Delay',
}

const SEV_CLS = { good: 'bg-emerald-100 text-emerald-700', mild: 'bg-amber-100 text-amber-700', moderate: 'bg-orange-100 text-orange-700', severe: 'bg-red-100 text-red-700' }

const globalSeverity = (total) => {
  if (total <= 19) return { level: 'severe', label: 'Severe Impairment' }
  if (total <= 33) return { level: 'moderate', label: 'Moderate Impairment' }
  if (total <= 44) return { level: 'mild', label: 'Mild Impairment' }
  return { level: 'good', label: 'Within Age Expectation' }
}

const emptyState = () => {
  const s = {}
  DOMAINS.forEach((d) => { s[d.key] = new Array(d.items.length).fill(null) })
  return s
}

function YesNoNa({ value, onChange }) {
  return (
    <div className="flex border border-slate-300 rounded-lg overflow-hidden shrink-0">
      {['YES', 'NO', 'NA'].map((opt) => {
        const on = value === opt
        const cls = opt === 'YES' ? 'bg-emerald-500 text-white'
          : opt === 'NO' ? 'bg-red-500 text-white'
          : 'bg-slate-400 text-white'
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? null : opt)}
            className={`px-2.5 py-1 text-xs font-bold border-r border-slate-300 last:border-r-0 transition-colors ${on ? cls : 'bg-slate-100 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200'}`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function AdaptiveFunctioningForm({ onClose, inline = false }) {
  const [answers, setAnswers] = useState(emptyState())
  const [p, setP] = useState({ childName: '', date: '', age: '', gender: '', respondent: '', others: '' })
  const [collapsed, setCollapsed] = useState({})
  const [showResults, setShowResults] = useState(false)

  const setAnswer = (dKey, idx, val) => {
    setAnswers((prev) => {
      const next = { ...prev, [dKey]: [...prev[dKey]] }
      next[dKey][idx] = val
      return next
    })
  }

  const domainScore = (dKey) => {
    const arr = answers[dKey]
    let yes = 0, answered = 0, na = 0
    arr.forEach((v) => {
      if (v === 'YES') { yes++; answered++ }
      else if (v === 'NO') { answered++ }
      else if (v === 'NA') { na++ }
    })
    return { yes, answered, na, total: arr.length }
  }

  const scores = {}
  DOMAINS.forEach((d) => { scores[d.key] = domainScore(d.key) })
  const grandYes = DOMAINS.reduce((s, d) => s + scores[d.key].yes, 0)
  const grandAnswered = DOMAINS.reduce((s, d) => s + scores[d.key].answered, 0)
  const grandNA = DOMAINS.reduce((s, d) => s + scores[d.key].na, 0)
  const gSev = globalSeverity(grandYes)

  const resetAll = () => {
    if (!confirm('Clear all responses and patient info?')) return
    setAnswers(emptyState())
    setP({ childName: '', date: '', age: '', gender: '', respondent: '', others: '' })
  }

  const questionnaire = (
    <div className="space-y-4">
      <FormHeading numeral="">Patient Information</FormHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Child's Name / Pangalan</div>
          <input type="text" className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm" value={p.childName} onChange={(e) => setP((s) => ({ ...s, childName: e.target.value }))} placeholder="Full name" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Date / Petsa</div>
          <DatePicker value={p.date} onChange={(value) => setP((s) => ({ ...s, date: value }))} ariaLabel="Date" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Age / Edad</div>
          <input type="text" className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm" value={p.age} onChange={(e) => setP((s) => ({ ...s, age: e.target.value }))} placeholder="e.g. 6 years old" />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Gender / Kasarian</div>
          <select className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm" value={p.gender} onChange={(e) => setP((s) => ({ ...s, gender: e.target.value }))}>
            <option value="">Select…</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">Respondent / Sumagot</div>
          <div className="flex flex-wrap gap-2">
            {['Parent', 'Teacher', 'Caregiver', 'Others'].map((r) => (
              <Radio
                key={r}
                name="respondent"
                value={r}
                checked={p.respondent === r}
                onChange={(e) => setP((s) => ({ ...s, respondent: e.target.value }))}
                label={r === 'Parent' ? 'Parent (Magulang)' : r === 'Teacher' ? 'Teacher (Guro)' : r === 'Caregiver' ? 'Caregiver (Tagapag-alaga)' : 'Others (Iba pa)'}
                colorClass="border-purple-500 bg-purple-100 text-purple-800 dark:text-purple-300 transition-colors"
                unselectedClass="border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors text-slate-600 dark:text-slate-300 transition-colors hover:bg-purple-50"
                className="rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
              />
            ))}
          </div>
        </div>
        {p.respondent === 'Others' ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-1">If Others, please specify</div>
            <input type="text" className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm" value={p.others} onChange={(e) => setP((s) => ({ ...s, others: e.target.value }))} placeholder="Specify relationship / role" />
          </div>
        ) : <div />}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 mb-4">
        <b>Instruction:</b> Please answer each statement with <b>YES</b> if the child is able to do the skill independently or age-appropriately. Mark <b>N/A</b> only if the item is not yet age-appropriate for the child.
        <div className="italic text-emerald-700 mt-1">(Panuto: Sagutin ng OO kung nagagawa ng bata ang kasanayan nang naaayon sa kanyang edad at may kaunting gabay lamang. Markahan ng N/A kung hindi pa akma sa edad ng bata ang tanong.)</div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors mb-2">
          <span className="font-semibold text-purple-700">Checklist completion</span>
          <span>{grandAnswered}/{TOTAL_ITEMS} items answered</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-purple-700 transition-all duration-500" style={{ width: `${TOTAL_ITEMS ? (grandAnswered / TOTAL_ITEMS) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Domains */}
      {DOMAINS.map((d) => {
        const ds = domainScore(d.key)
        const sev = severityFor(ds.yes)
        const isOpen = !collapsed[d.key]
        const sevCls = { good: 'bg-emerald-100 text-emerald-700', mild: 'bg-amber-100 text-amber-700', moderate: 'bg-orange-100 text-orange-700', severe: 'bg-red-100 text-red-700' }
        return (
          <div key={d.key} className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [d.key]: !c[d.key] }))}
              className="flex items-center justify-between w-full gap-4 px-5 py-4 bg-purple-50/40 hover:bg-purple-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-700 text-white text-sm font-bold shrink-0">{d.roman}</span>
                <div>
                  <div className="text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors">{d.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{d.sub}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sevCls[sev.level]}`}>{ds.yes}/{d.items.length}</span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </button>
            {isOpen && (
              <div className="px-5 py-3 space-y-1">
                {d.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 py-2 border-b border-purple-50 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 dark:text-slate-100 transition-colors">{item[0]}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 transition-colors italic">{item[1]}</div>
                    </div>
                    <YesNoNa
                      value={answers[d.key][i]}
                      onChange={(val) => setAnswer(d.key, i, val)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap gap-3 justify-end">
        <button type="button" onClick={resetAll} className="rounded-md border border-purple-300 bg-white dark:bg-slate-900 transition-colors px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">↺ Reset form</button>
        <button type="button" onClick={() => setShowResults(true)} className="rounded-md bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800">View scoring &amp; results →</button>
      </div>
    </div>
  )

  const motorTotal = scores.gross.yes + scores.fine.yes
  const grossSev = severityFor(scores.gross.yes)
  const fineSev = severityFor(scores.fine.yes)
  const gRank = { good: 0, mild: 1, moderate: 2, severe: 3 }[grossSev.level]
  const fRank = { good: 0, mild: 1, moderate: 2, severe: 3 }[fineSev.level]

  const grossRec = (grossSev.level === 'severe' || grossSev.level === 'moderate') ? 'Recommend Pediatric or Physical Therapy referral' : 'It can be manageable'
  const fineRec = (fineSev.level === 'severe' || fineSev.level === 'moderate') ? 'Recommend Occupational Therapy evaluation' : 'It can be manageable'

  let combined = null
  if (gRank >= 2 && fRank >= 2) combined = 'Consider a developmental pediatric assessment — both gross and fine motor scores fall in the moderate-to-severe range.'
  else if (gRank >= 2) combined = 'Kindly proceed with the specific recommendation for Gross Motor concerns.'
  else if (fRank >= 2) combined = 'Kindly proceed with the specific recommendation for Fine Motor concerns.'

  const results = (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowResults(false)}
        className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-900"
      >
        ← Back to Questionnaire
      </button>

      {/* Hero score */}
      <div className="rounded-2xl bg-gradient-to-br from-purple-800 to-purple-600 text-white p-6 flex items-center gap-6 flex-wrap shadow-lg">
        <div className="flex items-center justify-center w-32 h-32 rounded-full bg-white dark:bg-slate-900 transition-colors/10 shrink-0">
          <span className="text-3xl font-bold">{grandYes}<span className="text-lg opacity-60">/{TOTAL_ITEMS}</span></span>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest opacity-75 font-bold">Global Numerical Score</div>
          <div className="text-2xl font-bold mt-1">{grandYes} <span className="text-lg opacity-60">/ {TOTAL_ITEMS}</span></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 transition-colors/20 px-3 py-1 text-sm font-semibold mt-2">{gSev.label}</span>
          <p className="text-sm opacity-85 mt-2 max-w-md">{p.childName || 'Unnamed child'}{p.age ? ` · ${p.age}` : ''}{p.respondent ? ` · Respondent: ${p.respondent}` : ''}. Score sums YES responses across all four domains.</p>
        </div>
      </div>

      {/* Autoscoring per domain */}
      <FormHeading numeral="">Autoscoring — item by item</FormHeading>
      {DOMAINS.map((d) => {
        const ds = domainScore(d.key)
        const sev = severityFor(ds.yes)
        const labelFn = d.key === 'gross' || d.key === 'fine' ? MOTOR_LABELS : LABELS
        const cls = ['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700']
        const si = { good: 0, mild: 1, moderate: 2, severe: 3 }[sev.level]
        return (
          <div key={d.key} className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-purple-50/40 border-b border-purple-100">
              <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors">{d.roman}. {d.title}</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls[si]}`}>{labelFn[sev.level]}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 px-5 py-3">
              {d.items.map((_, i) => {
                const v = answers[d.key][i]
                const c = v === 'YES' ? 'text-emerald-600 font-bold' : v === 'NO' ? 'text-red-600 font-bold' : v === 'NA' ? 'text-slate-400' : 'text-slate-300'
                return <div key={i} className={`text-xs px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 transition-colors border border-slate-200 dark:border-slate-800 transition-colors ${c}`}>{i + 1}. {v || '—'}</div>
              })}
            </div>
            <div className="grid grid-cols-3 border-t border-purple-100">
              <div className="px-5 py-3 border-r border-purple-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors font-bold">Score</div>
                <div className="text-lg font-bold text-purple-800 dark:text-purple-300 transition-colors">{ds.yes}/{ds.total}</div>
              </div>
              <div className="px-5 py-3 border-r border-purple-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors font-bold">Verb. Inter.</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{labelFn[sev.level]}</div>
              </div>
              <div className="px-5 py-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors font-bold">Severity</div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cls[si]}`}>{labelFn[sev.level]}</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Global Numerical Method */}
      <FormHeading numeral="">Global Numerical Method</FormHeading>
      <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm overflow-hidden">
        {[
          { label: 'I. Conceptual', val: scores.conceptual.yes },
          { label: 'II. Social', val: scores.social.yes },
          { label: 'III. Practical', val: scores.practical.yes },
          { label: `IV. Motor Domain (Gross ${scores.gross.yes} + Fine ${scores.fine.yes})`, val: motorTotal },
        ].map((r, i) => (
          <div key={i} className="flex justify-between px-5 py-3 border-b border-purple-100 text-sm">
            <span className="text-slate-600 dark:text-slate-300 transition-colors">{r.label}</span>
            <span className="font-bold text-purple-800 dark:text-purple-300 transition-colors">{r.val}</span>
          </div>
        ))}
        <div className="flex justify-between px-5 py-3 bg-purple-50 border-b border-purple-100 text-sm font-bold">
          <span className="text-purple-800 dark:text-purple-300 transition-colors">Maximum Total</span>
          <span className="text-purple-900">{grandYes} / {TOTAL_ITEMS}</span>
        </div>
        <div className="flex justify-between px-5 py-3 bg-purple-800 text-white text-sm font-bold">
          <span>Overall Severity</span>
          <span>{gSev.label}</span>
        </div>
      </div>

      {/* Referral guidance */}
      <FormHeading numeral="">Referral guidance</FormHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 flex gap-3 items-start ${grossSev.level === 'severe' || grossSev.level === 'moderate' ? 'border-red-200 bg-red-50' : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors'}`}>
          <span className="text-2xl">🏃</span>
          <div><b className="text-sm block text-slate-800 dark:text-slate-100 transition-colors">Gross Motor recommendation</b><span className="text-xs text-slate-600 dark:text-slate-300 transition-colors">{grossRec}</span></div>
        </div>
        <div className={`rounded-xl border p-4 flex gap-3 items-start ${fineSev.level === 'severe' || fineSev.level === 'moderate' ? 'border-red-200 bg-red-50' : 'border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors'}`}>
          <span className="text-2xl">✍️</span>
          <div><b className="text-sm block text-slate-800 dark:text-slate-100 transition-colors">Fine Motor recommendation</b><span className="text-xs text-slate-600 dark:text-slate-300 transition-colors">{fineRec}</span></div>
        </div>
        {combined ? (
          <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
            <span className="text-2xl">🧩</span>
            <div><b className="text-sm block text-slate-800 dark:text-slate-100 transition-colors">Combined motor guidance</b><span className="text-xs text-slate-600 dark:text-slate-300 transition-colors">{combined}</span></div>
          </div>
        ) : null}
      </div>

      {grandNA > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ℹ️ {grandNA} item{grandNA > 1 ? 's' : ''} marked Not Applicable — excluded from YES/NO counts. Interpret proportionally if several items are N/A.
        </div>
      ) : null}

      {/* Scoring reference */}
      <details className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
        <summary className="px-5 py-3 text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors cursor-pointer hover:bg-purple-50">Scoring reference — per-domain severity bands</summary>
        <div className="px-5 py-3 border-t border-purple-100">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 dark:text-slate-400 transition-colors font-bold"><th className="text-left py-1">YES score</th><th className="text-left py-1">Severity</th></tr></thead>
            <tbody>
              {[
                ['0 – 2', 'Severe (Impairment / Motor Delay)'],
                ['3 – 4', 'Moderate (Impairment / Motor Delay)'],
                ['5 – 7', 'Mild (Impairment / Motor Delay)'],
                ['8+', 'Within Age Expectation / No Significant Delay'],
              ].map(([s, l]) => (
                <tr key={s} className="border-t border-purple-50"><td className="py-1 font-mono">{s}</td><td className="py-1 text-slate-600 dark:text-slate-300 transition-colors">{l}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors shadow-sm">
        <summary className="px-5 py-3 text-sm font-bold text-purple-800 dark:text-purple-300 transition-colors cursor-pointer hover:bg-purple-50">Global score interpretation (max {TOTAL_ITEMS})</summary>
        <div className="px-5 py-3 border-t border-purple-100">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 dark:text-slate-400 transition-colors font-bold"><th className="text-left py-1">Total score</th><th className="text-left py-1">Overall severity</th></tr></thead>
            <tbody>
              {[
                ['0 – 19', 'Severe Impairment'],
                ['20 – 33', 'Moderate Impairment'],
                ['34 – 44', 'Mild Impairment'],
                [`45 – ${TOTAL_ITEMS}`, 'Within Age Expectation'],
              ].map(([s, l]) => (
                <tr key={s} className="border-t border-purple-50"><td className="py-1 font-mono">{s}</td><td className="py-1 text-slate-600 dark:text-slate-300 transition-colors">{l}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Sign-off */}
      <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5 flex items-center justify-between flex-wrap gap-4 text-sm">
        <div><b className="text-slate-800 dark:text-slate-100 transition-colors">Checked and Approved by</b><br /><span className="text-slate-600 dark:text-slate-300 transition-colors">Cristine Lae C. Erasga</span><br /><span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">Clinic Psychologist / Supervisor · License No. 0001942</span></div>
        <div className="text-right"><b className="text-slate-800 dark:text-slate-100 transition-colors">Generated</b><br /><span className="text-slate-600 dark:text-slate-300 transition-colors">{new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      </div>

      <div className="rounded-xl border border-purple-200 dark:border-slate-700 transition-colors bg-white dark:bg-slate-900 transition-colors p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors mb-2">Evaluator</div>
        <input type="text" className="w-full rounded-md border border-purple-200 dark:border-slate-700 transition-colors bg-purple-50/40 px-2.5 py-1.5 text-sm" placeholder="Signature over Printed Name" />
        <div className="mt-2 flex items-center gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">Date:</span>
          <DatePicker ariaLabel="Evaluator date" />
        </div>
      </div>
    </div>
  )

  return (
    <FormShell
      title="Child Adaptive Functioning Checklist"
      subtitle="Initial Screening Tool"
      code="CMPS-2026-02-18-Rev.1"
      confidential={false}
      onClose={onClose}
      multiPage={true}
      orientation="landscape"
      inline={inline}
    >
      {showResults ? results : questionnaire}
    </FormShell>
  )
}

export default AdaptiveFunctioningForm
