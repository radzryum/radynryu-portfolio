import IntakeInterview from '../psychologist/IntakeInterview'

// Psychometrician tab for the shared intake interview: same record the
// psychologist edits, with autosave and per-field edit tracking.
// Roster impression fields stay psychologist-only inside the component.
function PsychometricianIntakeInterview() {
  return <IntakeInterview source="psychometrician" />
}

export default PsychometricianIntakeInterview
