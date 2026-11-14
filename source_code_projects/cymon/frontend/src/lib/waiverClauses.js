// Shared FO-02 waiver copy: SPED consent clauses + house rules.
// Lives here (not in a page) so the client form, client detail view, and the
// admin compliance form all read one source — and so page files only export
// components (react-refresh/only-export-components).
export const SPED_CLAUSES = [
  {
    numeral: '',
    title: 'Nature and Purpose of the Program',
    body: [
      'I understand that the Special Education (SPED) Program of ClearMind Psychological Services (CMPS) provides specialized educational, behavioral, and play-based interventions designed to address the individual needs of my child. Services may include assessment, individualized instruction, behavioral support, structured play activities, and related developmental interventions administered by the clinic.',
    ],
  },
  {
    numeral: 'A',
    title: 'Student Attendance and Schedule of Sessions',
    body: [
      'I understand that the number of sessions will be conducted based on the enrolled program of my child. In the event of absence, the missed session will be counted and deducted from the total number of sessions, regardless of the reason, unless officially excused by the administration. Unused sessions are non-transferable, non-convertible to cash, and non-refundable.',
      'Furthermore, I understand that CMPS shall determine and assign my child\u2019s schedule based on program considerations and student needs. I acknowledge that the schedule may be modified by the clinic depending on my child\u2019s performance, progress, or behavioral adjustment during the course of the program.',
    ],
  },
  {
    numeral: 'B',
    title: 'Parental Disclosure of Information',
    body: [
      'I affirm that I have fully disclosed all relevant medical, psychological, developmental, and behavioral information about my child. I agree to update CMPS regarding any significant changes in my child\u2019s condition that may affect participation in the program.',
    ],
  },
  {
    numeral: 'C',
    title: 'Confidentiality and Data Privacy',
    body: [
      'I consent to the collection, use, storage, and processing of my child\u2019s personal, behavioral, and medical information for purposes related to assessment, intervention planning, monitoring, and documentation. I understand that all information will be treated with confidentiality and will be disclosed only to authorized personnel or as required by law.',
    ],
  },
  {
    numeral: 'D',
    title: 'Student Safety Monitoring',
    body: [
      'For safety and security purposes, I acknowledge that CCTV cameras are installed in designated areas, including the play area. I understand that CCTV recordings are strictly and solely for monitoring safety, security, and incident review purposes and will be accessed only by authorized personnel in accordance with school policies and applicable laws.',
    ],
  },
  {
    numeral: 'E',
    title: 'Health, Safety, and Emergency Medical Consent',
    body: [
      'I understand that reasonable precautions will be taken to ensure my child\u2019s safety during sessions and school activities. In case of emergency and I cannot be reached immediately, I authorize the clinic and its representatives to secure appropriate medical treatment for my child. I agree to assume responsibility for any medical expenses incurred.',
    ],
  },
  {
    numeral: 'F',
    title: 'Participation and Behavioral Interventions',
    body: [
      'I understand that my child will be expected to follow clinic rules and routines. Appropriate behavioral management strategies and interventions may be implemented when necessary to ensure a safe and structured learning environment.',
    ],
  },
  {
    numeral: 'G',
    title: 'Liability Waiver',
    body: [
      'I acknowledge that participation in educational and play-based activities involves inherent risks despite reasonable care and supervision. I hereby release and hold free from liability the clinic, its administrators, staff, and representatives from claims arising from accidents, injuries, or incidents that may occur in the ordinary course of program participation, except in cases of gross negligence or willful misconduct.',
    ],
  },
  {
    numeral: 'H',
    title: 'Parental Cooperation',
    body: [
      'I agree to cooperate with the CMPS by attending scheduled meetings, participating in case conferences when required, and supporting recommended strategies at home to promote my child\u2019s development and progress based on his/her Individualized Educational Plan (IEP). I further acknowledge my responsibility to ensure that my child is brought to the clinic on time for scheduled sessions and is fetched promptly after each session by myself or an authorized representative. I understand that CMPS is not responsible for the student outside of official session hours and designated supervision periods.',
    ],
  },
]

export const SPED_HOUSE_RULES = [
  { title: 'Attendance and Punctuality', text: 'Students are expected to attend classes regularly and arrive on time. Absences should be communicated by the parent/guardian in advance or a day before the scheduled class.' },
  { title: 'Health and Safety', text: 'Students who are unwell or showing symptoms of illness should not be sent to the clinic. The clinic reserves the right to send a student home or require a medical clearance before re-entry if deemed necessary.' },
  { title: 'Respect and Inclusion', text: 'Students are expected to show respect to facilitators, therapists, staff, and fellow students. Aggressive language, name-calling, bullying, or any form of discrimination will not be tolerated.' },
  { title: 'Supervision and Dismissal', text: 'The parent/guardian or authorized representative must fetch the child promptly after each session. CMPS is not responsible for students left unattended or outside clinic premises after dismissal.' },
  { title: 'Personal Belongings', text: 'The clinic shall not be held liable for any loss or damage to personal property brought by the student.' },
  { title: 'School Property Responsibility', text: 'Students are expected to handle clinic property, furniture, materials, and equipment with care. Any damage caused by gross negligence may be charged to the parent or guardian.' },
  { title: 'Policy Amendments', text: 'CMPS reserves the right to amend, update, or modify these house rules as necessary. Parents and guardians will be notified of any significant changes through official clinic communication channels.' },
]
