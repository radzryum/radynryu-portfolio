# Administrator Guide

The admin portal is the clinic back office: students, staff, scheduling,
compliance, attendance, payments, content, and audit. You land on **Overview**.

Sidebar sections:

| Section | Route | Purpose |
|---------|-------|---------|
| Overview | `/admin/overview` | Dashboard summary and quick actions |
| Students | `/admin/patients` | Manage student records & parent accounts |
| Employees | `/admin/employees` | Manage staff accounts and roles |
| Compliance | `/admin/compliance` | Track document compliance per student |
| Schedule | `/admin/schedule` | Appointments & document-release requests |
| Attendance | `/admin/attendance` | Attendance & session forms |
| Clinical Records | `/admin/records` | View assessment documents/PDFs |
| Content Manager | `/admin/landing` | Edit/publish the public landing page |
| Announcement | `/admin/announcements` | Publish announcements |
| Audit Trail | `/admin/audit` | Review system audit logs |
| My Profile | `/admin/profile` | Profile and password |

---

## Overview

- Summary cards and quick actions that navigate to Students, Employees, and
  Compliance.

## Students

- **Add a Student** — admission form creates the student and (optionally) the
  parent's account with a temporary password.
- **Edit** — update details; the Status dropdown supports **Active**, **Pending**,
  and **Inactive**.
- **Manage Parent Account** — reset the linked parent's password/email.
- **Delete** a student.

## Employees

- **Add Employee** — create staff accounts by role (`psychologist`,
  `psychometrician`, `speech_therapist`, `occupational_therapist`, `admin`,
  `super_admin`).
- **Edit role & extra roles**, upload a **license image**, **delete**, and
  **override the password**.
- **Security note:** an admin cannot reset another admin's account — only a
  `super_admin` can. This prevents peer account takeover.

## Compliance

- Per-student checklist of required documents.
- **Answer Form** — complete a compliance form for a student/code.
- **Preview official PDF**, **Remind** the caregiver.

## Schedule

- **Calendar** (individual + group sessions). Book appointments, move/delete.
- **Assessment Document Releases** — manage client requests to release assessment
  documents:
  - **Set Schedule & Review Price** — choose the pick-up date/time/location and
    set each document's fee.
  - **Accept & Notify Client** — saves the schedule and notifies the client.
  - **Decline** a request.
  - **Pay & Release** (cash/GCash) or **Release Docs** (already paid online).
  - **Update Schedule** on an already-paid request does **not** re-price it — the
    online amount is locked.
- Important: the modal resets for each request, so fees shown are always the
  correct request's fees.

## Attendance

- **Attendance & Session forms** per month/student.
- **Preview Form** / download the PDF.

## Clinical Records

- Browse assessment documents and open the official PDF / CTC per record.

## Content Manager (Landing Editor)

Manage the public landing page with a **Save** vs **Publish** workflow:

- **Save** — stores a draft (profile) that is **not** live.
- **Publish** — makes the draft live on the landing page for visitors.
- **Preview** — open the draft in preview mode.
- **Restore** — revert a section to its currently-published (or default) content
  (formerly labeled Reset).
- Each section (Hero, About, Services, Contact, Photos) has its own draft vs
  published copy. Image buttons read **Replace**.
- The admin view always shows the draft (falling back to the live version) so you
  edit against current content.

## Announcement

- Publish announcements to audiences: **All Employees**, **All MHP**, **All
  Clients / Parents**, or specific roles.
- "All Employees" reaches all non-client staff; "All MHP" reaches
  psychologists, psychometricians, and therapists.
- Set a publish date and optional expiry.

## Audit Trail

- Read-only feed of system actions (logins, account changes, payments, content
  publishes). Use to review who did what.

---

## Security notes (admin)

- `super_admin` is a recognized role for elevated, cross-account actions.
- Only a `super_admin` may modify another admin's account.
- Payment webhooks are signature-verified against PayMongo's real `v1` scheme,
  and paid amounts are compared to the quoted totals before a request is marked
  paid.
