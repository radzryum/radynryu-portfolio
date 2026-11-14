# Psychologist Guide

The psychologist portal is where clinicians review, approve, or return
assessment reports before they are finalized. You land on **Tasks**.

Sidebar sections:

| Section | Route | Purpose |
|---------|-------|---------|
| Tasks | `/psychologist/tasks` | Today's scheduled sessions and pending work |
| Approvals | `/psychologist/approvals` | Review assessment submissions and behavioral/IEP reports |
| Daily Activity Report | `/psychologist/activity` | Review the daily activity report for a student |
| Monthly Report | `/psychologist/progress` | Review monthly assessment (progress summary) reports |
| Student Journal | `/psychologist/student-journal` | View a student's journal entries |
| Announcements | `/psychologist/announcements` | Clinic announcements |
| My Profile | `/psychologist/profile` | Profile and password |

---

## Tasks

- **Today's Queue** — your scheduled sessions for today.
- **Quick Actions** — jump to Approvals, Daily Activity Report, or Monthly
  Report.
- **Documents needing review** — clicking **Review** opens the correct report.
  For monthly reports this deep-links to the student whose report you clicked.

## Approvals

- **Student Directory** — select a student to load their submitted assessments,
  behavioral reports, and IEPs.
- **Review workspace** — open a report to inspect saved answers, signatures, and
  comments, then:
  - **Approve & Sign** — requires your reviewer signature and an optional comment.
  - **Return as Draft / Request Revision** — sends it back to the psychometrician
    with your comment.

Rules enforced:
- You must provide a signature to approve.
- A report can only be reviewed when its state is `ready_for_review` / pending.
- The deep-link highlight from Tasks selects the exact student/submission you
  clicked.

## Daily Activity Report (Psychologist)

- Review the saved daily activity report for a student.
- Use the review controls only when the report is ready for a decision.

## Monthly Report (Progress)

- **Student Directory** — find the student whose monthly report you need.
- If you arrived from Tasks with a specific student, that student is
  pre-selected automatically.
- Use the review section to **approve** or **request revisions** (signature
  required to approve).

## Student Journal

- Read a student's journal entries and communicate access as needed.

## Announcements

- Newsletters and notices directed at psychologists. "All MHP" announcements
  reach psychologists, psychometricians, and therapists.

---

## Workflow overview

```
Psychometrician drafts & sends report
        → status = ready_for_review
Psychologist reviews in Approvals / Monthly Report
        → Approve (finalized)  OR  Return (revise_requested)
Psychometrician edits and resends
```

- You cannot modify report content as reviewer — you only approve/return.
- Signatures and comments are required for approval.
