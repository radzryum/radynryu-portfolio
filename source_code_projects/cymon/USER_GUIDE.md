# CYMON — Complete & Detailed User Guide

Welcome to the **ClearMind Psychological Services Management System (CYMON)**. This detailed user guide walks you through every page, button, and function in the actual system, for all roles: Client (parent/caregiver), Psychometrician, Psychologist, Administrator, and Super Admin.

---

## Table of Contents

1. [General System Features (All Users)](#1-general-system-features-all-users)
2. [Landing Page & Login](#2-landing-page--login)
3. [Client Portal](#3-client-portal)
4. [Psychologist Dashboard](#4-psychologist-dashboard)
5. [Psychometrician Dashboard](#5-psychometrician-dashboard)
6. [Admin & Super Admin Dashboard](#6-admin--super-admin-dashboard)

---

## 1. General System Features (All Users)

### Top Header & Navigation

- **Menu / Collapse Sidebar Button** (left): on mobile it opens the slide-in menu; on desktop it hides/shows the sidebar (remembered on your device).
- **Page Title**: the current section name.
- **Today's Date**: the current date display.
- **Branch Switcher** (staff in 2+ branches, and all Super Admins): a building icon + branch name between the date and the theme toggle. Click to pick which branch you are acting in — every list, directory, and schedule re-scopes to that branch. Super Admins get an extra **"All branches"** option (the default) showing a cross-branch view of every clinic. Picking a branch plays a short two-beat overlay ("Switching to…" → "Now you are in…") with no full-page reload. Your pick is remembered on the device; revoked branches are dropped automatically.
- **Dark / Light Mode Toggle**: switch themes. Your preference is saved automatically.
- **Notifications Bell**: opens your last 10 notifications ("N NEW" for unread). Clicking one marks it read and jumps to the related page (assessment, approval, report, attendance, application). **"Mark all as read"** clears the unread state. The header refreshes about every minute.
- **Logout Icon**: asks "Sign out? / Are you sure…?" — **Cancel** stays, **Log Out** returns you to login.

### Sidebar Navigation

- **Profile Card** (top): your photo (or initials), display name, role label(s), and ID pill (student ID for clients, employee ID for staff). Clicking it opens your profile page.
- **Switch Role Button** (staff holding more than one role): under your name you will see one badge per role you hold — solid purple for the role you are acting as right now, faded for the others — plus a **"Switch Role"** pill. Clicking it opens the role picker; picking a role plays a short overlay ("Switching to…" → "Now you are in…") and navigates you to that role's dashboard (`/admin`, `/psychologist`, or `/psychometrician`). The backend filters every directory by your acting role, so if a list looks empty, switch to the matching role first. Note: the URL always wins (visiting `/admin/*` acts as admin regardless of your last pick). Single-role users never see this button.
- **Navigation List**: one item per section. The active page is highlighted, and some items show a count badge for unread items.
- **Notification Badges**: numeric badges on menu items. Click the item to view what needs attention.
- **Collapse Sidebar** (staff, desktop): hide/show the sidebar for more screen space.
- **CyMon / ClearMind Clinic Card + Help Button** (bottom): the **Help** button replays the guided onboarding tour.

### Help / Onboarding Tour

- First-time users see a guided tour automatically, explaining each sidebar button and the workspace inside each page. Completing it saves so it does not show again (per role). The sidebar Help button replays it anytime.

---

## 2. Landing Page & Login

### Public Landing Page

- **"Get Started" / "Log in to Portal" Buttons**: take you to the Login page (also reachable from the mobile menu).
- **Announcements Carousel**: scrolls through public clinic announcements.
- **Public Admission Link** (`/apply/{branch-code}`): guardians can fill in the admission application on their own phones — no account needed. Admins share this link/QR from the Applications page (see Section 6).

### Login Screen

- **"Email address or Account Number/ID" Field**: type either your account email or your ID (student ID like `CMPS-XXXX-XXX`, or employee ID like `CMPS-EMP-…`). ID login ignores letter case.
- **Password Field**: with show/hide toggle.
- **"Remember me" Checkbox**: keeps you signed in on this device.
- **"Log In" Button**: shows "Signing in…" while busy, then sends you to your home page (Client Home, Task List / Tasks, or Dashboard Overview, depending on role). Failed logins show an error message.
- Accounts are created by the clinic — there is no public staff self-registration.

### Forgot Password

1. Click **"Forgot password?"**, enter your registered email, and click **"Send Verification Code"**.
2. A 6-digit code is emailed (expires in 10 minutes). Type it into the six boxes (you can paste all 6 at once) and click **"Verify Code"**. **"Resend Code"** issues a fresh one (invalidating the old); **"Change Email"** goes back a step.
3. Enter a **New Password** + **Confirm Password** (at least 8 characters, one uppercase, one number, must match) and click **"Reset Password"**. A success modal appears — click **"Return to Log In"**.
4. If no code arrives, check spam and confirm the exact registered email with the clinic.

---

## 3. Client Portal

For parents/caregivers. Sidebar: Home & Progress · Daily Journal · Assessment Services · Announcements · Appointments · Consents & Waivers · Activity History.

### Home & Progress

- Greeting header plus stat cards: **Pending Assessments** (click to open Assessment Services) and **Turn in Daily Journal** (Locked / Submitted / Pending).
- **Assigned Clinical Care Team**: your Psychologist and Psychometrician cards (photo, role, PRC license).
- **My Feelings This Week**: 7-day mood dots (today is ringed); **"Log your feelings now"** jumps to the journal.
- **Next / Last Appointment** cards and a **Recent Announcements** list.

### Daily Journal

- If the clinic has not enabled journaling for your child, the page is locked ("ask permission to your assigned Psychometrician").
- Form: **Journal Date** picker (never in the future) + **"Go to Today"**, required **Observations** textarea, 5 mood choices (Very Bad → Great), and optional metric dropdowns (therapy tasks, behavioral episodes, sleep, appetite).
- **"Submit Journal Entry" / "Update Journal Entry"** (both ask confirmation), **"Delete Journal Entry"** (asks confirmation).
- **Journal Archive & History**: search past logs, status pills, **"View Entry"** per log, plus a **Mood This Week** chart.

### Assessment Services

Two jobs: (A) answer assessments assigned to your child, (B) request official copies of finished documents for clinic pick-up.

- Status banners for scheduled pick-ups or pending clinic review.
- **Completed Assessments** card grid with status badges; **"Request Copy"** toggles to **"Selected for Request"**; **"View Pick-Up Slip" / "View Receipt"** for requests.
- **Progress & Program Reports** (IEP, monthly, daily activity) when available, plus **Document Request History**.
- Sticky bottom bar when items are selected → **"Request Documents"** → confirm → **Choose Payment Method** (**Pay Onsite**: cash/GCash/Maya/GoTyme/MariBank at the cashier; **Pay Online**: PayMongo checkout) → **Confirm & Submit Request**. A reason is required when re-requesting an already-released document.
- **"Pay Now Online"** (for unpaid online-payment requests) and **"Download Slip"** (official PDF pick-up slip) round out the flow.

### Appointments

- Read-only schedule: month calendar (**Prev / TODAY / Next**), event chips per day, and a side panel with time, status (Upcoming / Completed / Cancelled / Missed), practitioner, location, and notes. No booking buttons — contact the clinic to change a session.

### Consents & Waivers

- Two tracked forms: **CMPS:SE-FO-01 Student Admission Form** and **CMPS:SE-FO-02 SPED Consent and Waiver**, with status pills (Submitted, Approved, Returned — Needs Revision, Pending Signature, Overdue, Action Required).
- **"Answer Form"** opens the form (FO-01: personal/parent/emergency/clinical sections + signatures; FO-02: provision checkboxes, House Rules, parent details + e-signature pad). Returned forms show the clinic's note banner.
- **"View PDF"** opens the official read-only PDF (with download).

### Announcements

- Clinic bulletin (Urgent / Event / Info badges) as a stacked list on mobile or carousel on desktop. Clicking a card opens the detail modal; reading marks it read.

### My Profile (Client)

- Read-only personal, clinical, and guardian/emergency-contact details ("To update… contact the clinic administration") plus **Account Settings** with a Change/Close password form (current + new + confirm, show/hide toggles).

### Activity History

- Your own account log for the last 30 days — sign-ins (with device and approximate location) and actions taken, with a search box. Read-only.

---

## 4. Psychologist Dashboard

Sidebar: Tasks · Students · Intake Interview · Approvals · Daily Activity Report · Monthly Report · Student Journal · Announcements · Activity History. (Data Review and Reports pages exist without sidebar items — reach them from Tasks and notification links.)

### Tasks (home)

- Greeting, **Sessions Today** and **Pending Assessments** metrics, and a **Today's Queue** with **Sessions** / **Documents** tabs grouped by student.
- Per session **"Mark as Done"**; per document **"Review"** (jumps to the exact review screen with the student preselected). **Quick Actions** shortcut to Approvals, Activity, Progress, and Journal. Decisions happen in the review pages, not here.

### Students (Roster Overview)

- Searchable roster with support-level pills (HSN / MSN / LSN), 0–100% progress bars, and last-update dates. **"View"** opens the detail modal (support level, complaint, working diagnosis); **"Edit"** adjusts progress (0–100 slider) and notes, then **"Save changes"**.

### Intake Interview (shared record)

- The first assessment before treatment, co-filled with the psychometrician on **one shared record per student** (student picker + interview form, autosave, per-field edit history). The psychologist additionally owns the roster-impression fields that stay locked for psychometricians.

### Approvals (review hub)

- Student directory (search + **"Show only pending submissions"**) with pulsing **"Pending Approval"** badges; per student: assessment submissions, IEP document, and behavioral-report tables, each with **"View Form"**.
- Inside a review: **"Approve & Sign"** (requires your signature; optional comment) or **"Return as Draft"** (requires a comment). Supports notification deep links (`?patientId`, section, report/submission IDs).

### Daily Activity Report (review)

- Same workspace the psychometrician fills in (Section 5), in read-only review mode. Drafts show a "Not yet submitted" panel. **Approve** (needs your signature) or **Return** (needs a comment ≤100 chars).

### Monthly Report (review)

- Same workspace in review mode; drafts hidden. **Return** (comment required) or **Approve** (review signature required).

### Student Journal

- Inspect caregiver-submitted entries per student, toggle journal **Enable / Disable Access**, and **Export Report** (CSV).

### Data Review (no sidebar item)

- Submitted parent-observation checklists with New / Flagged / Approved stats, search + status filter, a detail drawer, and the psychologist-exclusive **"Approve"** button.

### Reports (no sidebar item)

- Behavioral-report ledger (read-only in effect — only non-draft reports visible).

### Announcements, Activity History, My Profile

- Same bulletin as clients; **Activity History** (`/psychologist/history`) is your own 30-day account log with search; **My Profile** covers photo upload, details, and password change.

---

## 5. Psychometrician Dashboard

You only ever see students **assigned to you**. Sidebar: Task List · Students · Intake Interview · Assessment Services · IEP Workspace · Daily Activity Report · Monthly Report · Attendance · Student Journal · Announcements · Activity History.

### Task List (home)

- **Sessions Today / Pending Assessments / Reports to Draft** metrics; **Today's Queue** (**Sessions** + **Documents** tabs) grouped by student; per session **"Mark as Done"**, per document **"Administer" / "Continue Draft" / "Open"**; **Quick Actions** to Assessments, Draft Reports, Data Review, and IEP.

### Students (Roster, view-only)

- Your assigned-student list with support levels and milestone progress. Read-only — roster updates are made by the psychologist. Opening a record shows details plus the intake summary.

### Intake Interview (shared record)

- Same shared record as the psychologist (Section 4): pick the student, fill in your sections (autosave + per-field edit history). Psychologist-only impression fields stay locked for you.

### Assessment Services

- Student directory (buttons disabled until admission is complete **and** the SPED consent FO-02 is approved) + **Standardized Assessment Templates** table (**"Answer Assessment" / "Continue Assessment" / "Answer (Revalidate)" / "View Form"**) + **Behavioral Assessment Reports** ledger with **"Write Behavioral Assessment Report"**. Returned forms show the psychologist's red note panel.

### IEP Workspace

- **Individualized Education Plan**: directory pills (Not Yet Started / Draft / Pending / Revision / Completed), sticky student header, and the embedded weekly-domain IEP form. Saving reloads the list; the psychologist reviews submissions under Approvals.

### Daily Activity Report

- Monthly activity record per student (form CMPS:SE-FO-08: session info, targeted-domain chips, objectives/procedure/observations, signature pads). **"Save Draft"**, **"Preview Official PDF"**, and **"Send to Psychologist"** (validates fields + signature). Returned reports show the revision note; the form autosaves.

### Monthly Report

- Monthly progress report workspace (report fields + activity plan + signature). Submit sends it to the psychologist; returned reports can be edited and resubmitted.

### Attendance (assigned students only)

- Same Monthly Attendance Workspace as admin (Section 6): month navigation, click-to-cycle calendar (Present / Absent / Excused), day detail panel, quick actions (**Mark All Weekdays Present**, **Clear Month**), repeatable session-log cards with Assistance/Prompts/Cues/Prodding rubrics, facilitator sign-off (pre-filled with **your** name), and **Save/Update**, **Delete**, **Reset**. Everything saves to the shared records admins see.

### Student Journal (staff view)

- Per-student caregiver entries table with search, notebook-style **"Read Entry"** modal, **Enable / Disable Access**, and CSV **"Export Report"**.

### Data Review (via Task List)

- Submitted parent checklists: stats, searchable table, detail drawer, **"View as Form"**, **"Mark as Processed"**.

### Behavioral Reports (via drafts/queue)

- Report ledger with status filter (**"View & Edit"** for drafts/returned, **"View Form"** otherwise) and the psychologist's return note on revisions.

### Announcements, Activity History, My Profile

- Same bulletin as clients; **Activity History** is your own 30-day log; **My Profile** covers photo, details, and password.

---

## 6. Admin & Super Admin Dashboard

Sidebar (12 items): Overview · Students · **Applications** · Employees · Compliance · Front Desk · Attendance · Clinical Records · **Data Export** · Content Manager · Announcement · Audit Trail. (Student Scoring Analytics lives at `/admin/scoring` with no sidebar item.) Admins see their branch's full data (no assignment filtering).

### Overview

- Real-time snapshot: clickable metric cards (**Students**, **Staff**, **Compliance** — each with an **"Open"** pill jumping to its page), lazy-loaded charts (Student Distribution donut, Compliance Health, Upcoming Schedule), and a **Recent Audit Trail** preview.

### Students

- **"Open Student Admission Form"** registers a student (embedded FO-01 form → "Student registered…" + reload). Search + **"Export List"** (CSV). Table of all students with status pills and assigned clinicians — assigning/changing the psychologist or psychometrician here controls what each clinician sees.
- Detail modal: personal info, parents/guardians, emergency contact, clinical & enrollment data, and account registration. Footer: **"Delete Student"** (animated confirm), **"Manage Student Account"** (change email / set temporary password), **"Preview PDF"** (official FO-01), **"Edit Details"**.

### Applications (NEW — QR / public-link inbox)

- Guardians apply on their own phones by scanning your **QR code** or opening your **public admission link** (`/apply/{branch-code}`) — no account needed. Each card shows the QR, the link, **"Copy link"**, and **"Preview flyer"** (a printable admission-QR flyer with **"Save as PDF"**). Super Admins see one card per branch; regular admins see only their branch.
- Inbox with **Pending | Imported | Rejected** tabs, name search, 20/page pagination, and (Super Admin) an **All Branches** filter. New submissions toast live ("New application: {child}") and send bell notifications; clicking one jumps to the exact highlighted row.
- **"Import"** opens the full admission form prefilled from the guardian's answers (parent signature and 2x2 photo carry over) — review, add the clinic representative signature, submit, and the student record + caregiver login are created (registration slip shown). **"Reject"** discards it (confirmed, irreversible).

### Employees

- **"Register Employee"**: photo (webcam/upload), account email + phone, name fields, multi-select **Roles** pills (first = primary), admin details (auto employee ID) or clinical credentials (PRC + license image, required). Submit shows a **Registration Slip** (ID, email, auto-generated password, welcome-email status) with **"Print Slip"**.
- Search + role filter + **"Export List"** (CSV). Detail modal: profile view/edit, license-ID viewer, **ASSIGNED ROLES** panel, **"Change Password"**, **"Delete Account"**. Plain admins get no manage buttons on administrator accounts (see Super Admin below).

### Compliance

- Tracks the two expected forms per student (FO-01 admission + FO-02 SPED consent) with a searchable directory and per-student document table. **"Return to Client"** (with required comment), **"Complete Form"** (answer on the client's behalf), and **"Preview"** (official PDFs). Supports `?patientId=` deep links.

### Front Desk

- **Clinic Master Schedule** + **Assessment Document Releases** tabs. Calendar with color tags; **"Add Appointment"** (Individual — compliance-complete students only — or Group of 2+, practitioner, branch Alabang/Cabuyao, date/time, session type, room, notes, color tag). Day panel with **View / Delete**; detail modal with **Close / Delete / Mark as Done**. Paid/payable pick-ups interleave read-only.

### Attendance

- **Monthly Attendance Workspace** for the full roster: **"Preview Form"** (official FO-11 PDF), month navigation, click-to-cycle calendar, day detail panel, live counters, repeatable session-log cards with rubric radios, Support Level Guide reference, and facilitator sign-off (**Save/Update**, **Delete Monthly Record**, **Reset**). Psychometrician edits notify admins.

### Clinical Records

- Finalized-document records with student-name search + document-type filter and **"View PDF"** (regular + certified-true-copy variant). Supports `?student=` / `?highlight=` links.

### Data Export (NEW — backup downloads)

- **"Clinic Backup Downloads"**: one-click copies for safekeeping — **Students** (incl. archived), **Employees** (incl. deactivated; no passwords), **Completed Documents ledger**, each in **CSV / Excel (.xlsx) / JSON**, plus the **Completed Documents PDF archive (ZIP + manifest.json)**. Filenames carry the date (`cymon-{students|employees|documents}-YYYY-MM-DD.…`). Every download is recorded in the Audit Trail. Super Admins export all branches; regular admins export their own branch.

### Content Manager

- Website editor: **"Preview"** (staging page), **"Save"** (draft), **"Publish"** (live), **"Restore"** (revert to published). Eight section tabs (Hero, About, Mission & Vision, Core Values, Clinical Programs, Specialties, Contact, Footer) with text, color, photo, and image-upload editors.

### Announcement (composer)

- **"New Announcement"**: title, **Group** (audience checkboxes: Everyone, Public, All Employees, All MHP, All Clients, Parents, Psychologists, Psychometricians) vs **Direct Notice** (target student/clinician), type (Urgent / Event / General Info), priority, publish/expiry dates, 300-char message, optional promo image. **"Live Preview"** + **"Publish Announcement"** (confirm → success modal; recipients get bell + optional email). **PUBLISHED** list (3/page) with **Edit / Delete**. Admins manage this list directly and do not receive their own announcement bells.

### Audit Trail

- Read-only log of state-changing actions: search + action filter, table (timestamp, actor, action, record type, detail, severity), and a **"View"** detail drawer. Data Export downloads appear here too.

### Student Scoring Analytics (hidden page)

- Avg. CAFAT score, assessments-this-month, and needs-support stats; searchable table with status pills and **"Export CSV Report"**; detail drawer with **"Print Official Report"**.

### Shared admin pages

- Daily Activity, Monthly Report, Behavioral Reports, and Student Journal workspaces (same as the clinical chapters, with full-branch directories), plus My Profile and Activity History.

### Super Admin — what is different

- Same 12-item sidebar and pages. Differences:
  - **Branch scope**: the header switcher always shows and defaults to **"All branches"** (cross-branch view of every clinic). Regular admins are locked to their own branch.
  - **Applications**: one QR/link card per branch, an All-Branches inbox filter, and a branch pill on every row.
  - **Data Export**: exports **all** branches (regular admins: own branch only).
  - **Employee Management**: only a Super Admin sees/offers the **Administrator** and **Super Admin** role pills (registration + role editing); super-admin accounts are hidden from plain admins; Change Password / Delete / Edit buttons on admin rows require Super Admin.

---

*End of User Guide. Screenshots go underneath each respective section header as needed.*
