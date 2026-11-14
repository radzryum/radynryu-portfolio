# Psychometrician Guide

The psychometrician portal is where assessment data is collected, scored, and
drafted into reports. Speech therapists and occupational therapists use the same
portal (they share the `/psychometrician` dashboard).

Sidebar sections:

| Section | Route | Purpose |
|---------|-------|---------|
| Task List | `/psychometrician` | Scheduled sessions, pending assessments, next clinical action |
| Assessment Services | `/psychometrician/assessments` | Assign and answer assessments for students |
| Data Review | `/psychometrician/data-review` | Review flagged submissions and caregiver responses |
| IEP Workspace | `/psychometrician/iep` | Draft Individualized Education Plans |
| Daily Activity Report | `/psychometrician/activity` | Draft/review daily activity reports |
| Monthly Report | `/psychometrician/progress` | Draft monthly assessment (progress summary) reports |
| Reports | `/psychometrician/reports` | Draft and send behavioral & other reports |
| Student Journal | `/psychometrician/student-journal` | Student journal access |
| Announcements | `/psychometrician/announcements` | Clinic announcements |
| My Profile | `/psychometrician/profile` | Profile and password |

> **Note:** Data Review and Reports are now in the sidebar. Previously they were
> only reachable through the Task List quick actions.

---

## Task List

- **Today's queue** of scheduled sessions.
- **Pending assessments**, **permissions**, and **release** work needing action
  (shown as badges on the Task List item).
- Use **Quick Actions** to jump to Assessments, Daily Activity Report, Monthly
  Report, or Reports.

## Assessment Services

- **Assign** an assessment template to a student.
- **Write Assessment** — answer the items, fill remarks, and save a draft or
  submit for review.
  - Answers **and** per-item remarks are saved together.
  - A 30-second autosave keeps your work; leaving the form also saves silently.
  - Opening a brand-new form and leaving it without answering does **not** create
    a phantom empty draft.
- **Reviewer** mode lets a psychologist review the answers and approve/return.

## Data Review

- Table of submissions/reports with status and flagged state.
- Select a row to see the detail panel with behavioral indicator summary.

## IEP Workspace

- Draft an Individualized Education Plan for a student.
- A blank IEP auto-creates only when you start editing; opening a student with no
  plan does **not** force an empty plan.
- Statuses: draft → in_progress → ready_for_review → approved/finalized.

## Daily Activity Report & Monthly Report

- Draft the report, save drafts, then **Send** to the psychologist for review.
- After sending, the report is `ready_for_review`.
- If returned, the status becomes `revise_requested` and you can edit and resend.
- The printed document code follows the official form codes (e.g., Daily
  Activity = `CMPS:SE-FO-07`).

## Reports

- Choose a student to draft and send reports (behavioral, etc.).
- The draft/pending-sign counts are keyed to the student's unique ID, so
  students with duplicate names do not share badges.
- **Preview official PDF** is available once a report draft exists.

## Student Journal

- Manage a student's journal access.

---

## Workflow overview

```
Psychometrician answers assessment / drafts report
        → saves draft, then sends (status = ready_for_review)
Psychologist reviews (approves or returns)
        → approved/finalized   OR   revise_requested
Psychometrician edits and resends
```

- Always include the required reviewer signature when applicable before sending.
- Keep remarks field filled alongside each answer so the psychologist sees your
  full clinical notes.
