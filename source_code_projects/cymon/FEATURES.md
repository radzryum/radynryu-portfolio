# ClearMind CYMON — System Feature & Detailed User Guide

**ClearMind Psychological Services Management System (CYMON)** is a full-stack web application for managing psychological services, client assessments, clinical records, staff workflows, and institutional announcements. 

This document serves as both a feature overview and a detailed user guide detailing buttons, actions, and step-by-step functionality across the entire system.

---

## Table of Contents

1. [Landing Page (Public)](#1-landing-page-public)
2. [Login & Authentication](#2-login--authentication)
3. [Client Portal](#3-client-portal)
4. [Psychologist Dashboard](#4-psychologist-dashboard)
5. [Psychometrician Dashboard](#5-psychometrician-dashboard)
6. [Admin Dashboard](#6-admin-dashboard)
7. [Super Admin Dashboard](#7-super-admin-dashboard)
8. [Shared System Features](#8-shared-system-features)

---

## 1. Landing Page (Public)

The landing page is the public-facing entry point to the ClearMind system. It is fully accessible without login.

### Sections & Interface Elements

- **Hero Section**: 
  - Features an animated shader gradient background.
  - **"Get Started" Button**: Redirects the user to the Login page.
- **Specialties**: A scrollytelling section presenting the psychological specialties offered by ClearMind.
- **About Us & Foundations**: Highlights the team, mission, and core principles.
- **Announcements & Updates Carousel**: 
  - **Function**: Automatically scrolls through real-time announcements.
  - **Controls**: Users can hover to pause or use the left/right arrow buttons to manually navigate.
- **Header Navigation**:
  - **"Log in to Portal" Button**: Directs clients and staff to the authentication page.
  - **Dark / Light Mode Toggle**: Switch visual themes.
  - **Hamburger Menu (Mobile)**: Opens a full-screen overlay with nav links.

---

## 2. Login & Authentication

The login page is shared across all roles.

### Interface Elements & Functions

- **Email or Account ID Input Field**: Enter registered email or assigned account number (e.g., `CMPS-XXXX-XXX`).
- **Password Input Field**: Standard password-based sign-in. Click the "eye" icon to toggle visibility.
- **"Remember Me" Checkbox**: Keep the session active across browser sessions.
- **"Log In" Button**: Submits credentials and redirects the user to their appropriate role-based dashboard.
- **"Forgot Password?" Link**: Initiates the Multi-Step Recovery process:
  1. **"Send OTP" Button**: System sends a 6-digit code to the registered email.
  2. **"Verify OTP" Button**: Submit the 6-digit code (expires in 10 minutes).
  3. **"Reset Password" Button**: Set a new strong password.

---

## 3. Client Portal

Clients are patients or guardians tracking their own progress and managing documents.

### Navigation Pages & Functions

- **Home & Progress**
  - **Progress Trackers**: Visual indicators showing ongoing intervention plans.
  - **"View Details" Button**: See a detailed breakdown of specific milestones.
- **Daily Journal**
  - **Log Activity Button**: Log and track daily activity reports to monitor behavioral progress.
- **Assessment Services**
  - **"Start Assessment" Button**: Begin filling out an assigned questionnaire.
  - **"Download PDF" Button**: Save completed and officially released assessment records.
- **Announcements**
  - View public announcements published by the admin.
- **Appointments**
  - **"Upcoming" / "Past" Tabs**: Toggle between future scheduled sessions and history.
  - **"Join Telehealth" Button**: Becomes active 15 minutes prior to online sessions.
- **Consents & Waivers**
  - **"Review & Sign" Button**: Opens the waiver document.
  - **Signature Pad / "I Agree" Checkbox**: Provide digital consent.
  - **"Submit Waiver" Button**: Finalizes the document and sends it to the clinic.
- **My Profile (Header Dropdown)**
  - **"Edit Profile" Button**: Update personal information (name, contact details, photo).

---

## 4. Psychologist Dashboard

Psychologists manage direct client care, therapy notes, and clinical approvals.

### Navigation Pages & Functions

- **Tasks**
  - **Task Checkboxes**: Mark items as complete.
  - **"Add Personal Task" Button**: Creates custom to-do items.
- **Students**
  - **Search Bar**: Type a student's name or ID to filter the list.
  - **"View File" Button**: Opens the comprehensive clinical record for the selected student.
  - **Student Roster Overview**: Support Level, Milestone Progress bar, chief complaint, and working diagnosis per assigned student. Psychologist-only editing (backend rejects other roles); the Milestone slider shows a data reference box (latest FO-03 %, change since first FO-03, monthly-report count) with a "Use suggestion" button — the saved value stays manual.
- **Intake Interview**
  - **Student dropdown + "Save Intake Interview" Button**: Records presenting concerns, onset, background, developmental/medical/family history, and clinician observations — one record per student, psychologist-only writes. Assigned psychometricians read it in their read-only Student Roster.
- **Approvals**
  - Review documents submitted by psychometricians.
  - **"View Document" Button**: Opens the assessment.
  - **"Approve" Button (Green)**: Finalizes the document for release. The same read-only Scoring Guide panel is visible beside the submitted FO-03 answers as a suggestion reference; approval and final leveling stay with the psychologist.
  - **"Request Revision" Button (Yellow)**: Opens a text box to type feedback and returns the document.
  - **"Reject" Button (Red)**: Cancels the document.
- **Daily Activity Report**
  - View logged daily journal entries and behavioral records from students and guardians.
- **Monthly Report**
  - **"Generate Report" Button**: Compiles progress data, history, and notes into a structured monthly format.
  - **"Export to PDF" Button**: Downloads the report with clinician signatures.
- **Student Journal**
  - Private clinical journal for personal notes regarding specific students.
  - **"Add New Note" Button**: Write a dated clinical observation.
  - **"Save Draft" / "Finalize" Button**: Locks the note from future edits.
- **Announcements**
  - View all internal and public clinic announcements.

---

## 5. Psychometrician Dashboard

Psychometricians administer, score, and document psychological assessments and special education plans.

### Navigation Pages & Functions

- **Task List**
  - View pending assessments, deadlines, and priority flags.
  - Mark completed tasks as done.
- **Student Roster (view-only)**
  - Assigned students with Support Level, Milestone Progress, chief complaint, and working diagnosis. No edit actions — updates are made by the psychologist.
- **Assessment Services**
  - **"Assign Assessment" Button**: Link a test battery to a student.
  - **"Answer Assessment" Button**: Opens the testing interface.
  - **Test Interface Controls**: Radio buttons/Likert scales for scoring, "Next Page"/"Previous Page" for navigation, **"Save Progress"**, and **"Submit Assessment"**.
  - **Scoring Guide panel (FO-03 Caregiver Checklist and clinic-adapted FO-04 MMSE, staff-only)**: Read-only suggestion box below the domains showing per-domain percentages, severity hints, referral hints, and a preliminary LSN/MSN/HSN suggestion. Never edits answers and never alters the official PDF.
- **IEP Workspace**
  - **"Create IEP" Button**: Opens the Individualized Education Plan template.
  - **"Add Goal" Button**: Adds rows for targets.
  - **"Request Co-Sign" Button**: Routes the document for psychologist approval.
- **Daily Activity Report**
  - View the daily activity submissions from students to aid in behavioral assessments.
- **Monthly Report**
  - Draft monthly progress summaries for submission to the psychologist.
  - Submitting for review snapshots source coverage (sessions, attendance days, activity logs for the reporting period) into the report and prints a SOURCES block on the FO-09 PDF.
- **Attendance**
  - Record attendance for sessions. 
- **Student Journal**
  - Personal space for psychometricians to record observations on students during assessments.
- **Announcements**
  - Read public and internal staff announcements.

---

## 6. Admin Dashboard

Administrators manage staff, students, scheduling, compliance, and content.

### Navigation Pages & Functions

- **Overview**
  - High-level metrics and interactive charts.
  - **Shortcut Buttons**: Quick access to major sections.
- **Students**
  - **Search and Filter Inputs**: Filter by name, ID, or status.
  - **"Register New Student" Button**: Opens the admission form.
  - **Active / Archived Tabs**: Switch between active students and soft-archived records.
  - **"Archive Record" / "Restore Record" Buttons** (Student Details): Archives hide the student and block the parent login without deleting data; Restore returns them to Active. Permanent delete remains separate.
  - **"Edit" Button (Pencil Icon)**: Update student records.
  - **"Generate Admission Slip" Button**: Export official PDF slips.
- **Employees**
  - **"Add New Employee" Button**: Register staff with roles and PRC license numbers.
  - **"Manage Roles" Button**: Assign multiple roles.
  - **"Deactivate Account" / "Reactivate Account" Buttons** (Employee Details): Soft-deactivation blocks sign-in immediately via `deleted_at` but keeps the record and audit history; Reactivate restores access without re-registering. Status filter (Active / Deactivated / All) in the list. Permanent delete remains separate.
  - **"Reset Password" Button**: Initiates a password reset.
- **Compliance**
  - Track requirements and checklists for staff or institutional compliance.
- **Front Desk**
  - **"New Session" Button**: Schedule appointments.
  - Manage the weekly and monthly master schedule.
- **Attendance**
  - **Attendance Buttons**: Click **"Present" (Green)**, **"Late" (Yellow)**, or **"Absent" (Red)**.
- **Clinical Records**
  - Centralized access to all student records, reports, and assessments.
- **Content Manager**
  - **Landing Page Editor**: Edit Hero text, Specialties. Uses **"Save Changes"** and **"Preview"** buttons.
- **Announcement**
  - **"Create Announcement" Button**: Draft an announcement.
  - **"Upload Image" Button**: Attach flyers.
  - **"Publish" Toggle**: Pushes announcements live.
- **Audit Trail**
  - Append-only log (UPDATE/DELETE blocked by database trigger) of sign-ins, failed attempts, sign-outs, record edits, approvals, account deactivation/archival, and roster changes. Write restricted to the service role; read restricted to administrators.

---

## 7. Super Admin Dashboard

The Super Admin has all Admin capabilities, plus elevated system privileges.

### Additional Capabilities

- **Register Admin Accounts**: Assign new Administrator accounts via the Employees module.
- **Register Super Admin Accounts**: Create new Super Admin accounts.
- **Full Employee Role Access**: Revoke or assign any role across the system.
- **System Audit Trail Export**: 
  - **"Export CSV" Button**: Download comprehensive, unrestricted audit logs for compliance directly from the Audit Trail module.

---

## 8. Shared System Features

These features and UI elements are available across all authenticated roles.

- **Top Header Menu**
  - **Dark / Light Mode**: Toggled via the theme switch icon. Preferences persist in `localStorage`.
  - **Profile Avatar Dropdown**: Access **"My Profile"** or **"Logout"**.
- **Sidebar & Notifications**
  - **Notification Badges**: Red numbers indicate pending actions. Updates every 30 seconds.
  - **Role Switcher Dropdown**: Staff with multiple roles can switch contexts instantly.
  - **Collapse Sidebar Icon**: Collapses the menu to an icon-only mode.
- **Data Display**
  - **Paginated Tables**: All lists feature pagination (20 per page) with integrated Search and Filter inputs.
- **PDF Document Generation**
  - Built-in buttons across the system to export Admission Slips, Release Slips, Reports, and IEPs.

---
*Last updated: August 2026 — ClearMind Psychological Services*
