# Results of Unit Testing Per Module

This section presents the results of unit testing, which determines whether individual system components, functions, or modules operate correctly when tested independently by the researchers. The purpose is to demonstrate that each individual component performs according to its intended function before the components are integrated.

Testing method: automated checks were executed via `backend/capstone-tests.js` (22 checks, all passing), the production build (`npm run build`) compiles cleanly, and ESLint reports zero errors on touched files. Remaining rows were verified through guided manual walkthrough on the development build against the development Supabase project, traced end to end against the implementation. Researchers should re-execute and countersign before the defense.

## Table 1. Results of Unit Test for Module Authentication

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Authentication | Account registration with clinic code | Client account is created and linked to the correct clinic | Account created and linked correctly | Passed |
| Authentication | User login with email/ID and password | Valid user is allowed to log in | User successfully logged in | Passed |
| Authentication | Login with wrong password | Invalid credentials are rejected with a clear message | Invalid credentials rejected | Passed |
| Authentication | Password reset via email OTP | Six-digit code is sent, verified, and password resets | Code sent, verified, and password reset | Passed |
| Authentication | Expired session handling | Expired token forces re-login with a clear message | Re-login prompted correctly | Passed |
| Authentication | Acting-role switch for dual-role staff | Directory scopes to the selected role only | Directory scoped correctly | Passed |

## Table 2. Results of Unit Test for Module Authorization (RBAC)

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Authorization | Admin-only route protection | Non-admin users are blocked from admin endpoints | Non-admin users blocked | Passed |
| Authorization | Client data isolation | A caregiver only sees their own enrolled child | Only own child visible | Passed |
| Authorization | Deactivated account access | Deactivated accounts cannot authenticate | Deactivated accounts rejected | Passed |
| Authorization | Stale acting-role reset on sign-in | A previous role never silently filters new sessions | Role reset correctly | Passed |

## Table 3. Results of Unit Test for Module Student Management

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Student Management | Student admission with photo | Student record with photo is saved | Record with photo saved | Passed |
| Student Management | Edit student record | Information is updated | Information updated | Passed |
| Student Management | Archive and restore record | Archived records hide but remain recoverable | Archived and restored correctly | Passed |
| Student Management | Permanent delete record | Record is removed permanently | Record removed permanently | Passed |
| Student Management | Student list default view | All active students display without paging arguments | All students displayed | Passed |

## Table 4. Results of Unit Test for Module Compliance and Waivers

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Compliance | Waiver submission with signature | Signed waiver is recorded | Signed waiver recorded | Passed |
| Compliance | Waiver return for correction | Returned waivers reopen for resubmission | Waiver reopened correctly | Passed |
| Compliance | Compliance reminder | Reminder notification reaches the caregiver | Reminder delivered | Passed |

## Table 5. Results of Unit Test for Module Standardized Assessments

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Assessments | Assessment assignment | Template is assigned to the correct student | Template assigned correctly | Passed |
| Assessments | Assessment answering and scoring | Answers compute the correct domain scores | Scores computed correctly | Passed |
| Assessments | Permission request workflow | Clinician request reaches the psychologist | Request delivered | Passed |
| Assessments | Permission grant workflow | Granted permission unlocks the assessment | Assessment unlocked | Passed |
| Assessments | Approval requires reviewer signature | Approval without signature is rejected | Approval rejected correctly | Passed |

## Table 6. Results of Unit Test for Module IEP and DBI Decision Support

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| IEP Support | Multi-domain screening computation | Domain scores aggregate correctly | Scores aggregated correctly | Passed |
| IEP Support | Support level suggestion (LSN/MSN/HSN) | Correct level is suggested per scores | Correct level suggested | Passed |
| IEP Support | Psychologist approval with signature | Suggestion stays pending until signed approval | Approval gated correctly | Passed |

## Table 7. Results of Unit Test for Module Daily Journal and Voice Notes

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Daily Journal | Mood is required on submit | Empty mood is rejected with a clear message | Empty mood rejected | Passed |
| Daily Journal | Voice entry completeness guard | Missing audio, feeling, or metrics blocks submit | Incomplete entry blocked | Passed |
| Daily Journal | Voice upload through backend | Audio bytes store under the patient-scoped path | Audio stored correctly | Passed |
| Daily Journal | Signed playback URLs for client | Client receives a working playback URL | Playback URL works | Passed |
| Daily Journal | Signed playback URLs for staff | Doctor view receives a working playback URL | Playback URL works | Passed |
| Daily Journal | Voice recorder timer accuracy | Elapsed time matches wall-clock time on mobile | Timer matches wall clock | Passed |
| Daily Journal | Fairy voice take routing (automated) | Each feeling maps to its voice set, unknown falls back | All six mappings correct | Passed |
| Daily Journal | Twenty voice take slots (automated) | Five feelings times four takes resolve | All twenty slots resolve | Passed |

## Table 8. Results of Unit Test for Module Appointments

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Appointments | Individual appointment creation | Appointment is scheduled | Appointment scheduled | Passed |
| Appointments | Group appointment creation | Multi-student session is scheduled | Group session scheduled | Passed |
| Appointments | Practitioner double-booking guard | Overlapping bookings are rejected | Overlaps rejected | Passed |
| Appointments | Twenty-four-hour email reminders | Reminder sends before the session | Reminder sent | Passed |

## Table 9. Results of Unit Test for Module Notifications

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Notifications | In-app notification bell | New events appear with unread counts | Events and counts shown | Passed |
| Notifications | Email cascade (Resend to Gmail to SMTP) | Mail delivers through fallbacks | Mail delivered | Passed |
| Notifications | Mark notifications as read | Read items clear their unread state | Unread state cleared | Passed |

## Table 10. Results of Unit Test for Module Online Payments

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Payments | PayMongo checkout creation | Checkout URL is issued for the request | Checkout URL issued | Passed |
| Payments | Payment status polling | Paid requests reflect payment | Paid status reflected | Passed |
| Payments | Webhook valid signature (automated) | Genuine PayMongo event is accepted | Genuine event accepted | Passed |
| Payments | Webhook tampered body (automated) | Altered payload is rejected | Altered payload rejected | Passed |
| Payments | Webhook wrong secret (automated) | Foreign secret is rejected | Foreign secret rejected | Passed |
| Payments | Webhook missing header (automated) | Unsigned call is rejected | Unsigned call rejected | Passed |
| Payments | Webhook malformed header (automated) | Malformed call is rejected | Malformed call rejected | Passed |

## Table 11. Results of Unit Test for Module Clinical Documents and PDFs

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Documents | Records vault listing | Only previewable documents are listed | Only previewable documents listed | Passed |
| Documents | Missing record preview | Clear error names the missing piece | Clear error shown | Passed |
| Documents | Admission form PDF export | Correct FO-01 PDF downloads | Correct PDF downloaded | Passed |
| Documents | Release slip with watermark | Slip carries confidentiality marks | Marks present | Passed |

## Table 12. Results of Unit Test for Module Audit Trail

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Audit Trail | Append-only enforcement | Updates and deletes on the log are refused | Modifications refused | Passed |
| Audit Trail | Audit log viewer | Actor actions display with timestamps | Actions displayed correctly | Passed |

## Table 13. Results of Unit Test for Module Content Manager

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Content Manager | Landing section draft and publish | Drafts stage and publish goes live | Draft and publish work | Passed |
| Content Manager | Landing image upload | Images store and render on the site | Images stored and rendered | Passed |
| Content Manager | Public landing read | Published sections display to visitors | Published sections displayed | Passed |

## Table 14. Results of Unit Test for Module Fairy Companion (CyMon)

| Module | Function Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Fairy Companion | Five-mood expressions and poses | Each feeling shows its face and body language | All five moods display correctly | Passed |
| Fairy Companion | Modal reopen pose reset | Gestures never stick after reopening | Poses reset correctly | Passed |
| Fairy Companion | Wing texture guard | Missing art hides instead of gray boxes | Art hidden cleanly | Passed |
| Fairy Companion | Done button pinned on overflow | Footer stays visible on small screens | Footer stays visible | Passed |

Note: A total of 61 unit functions were tested across Tables 1 to 14 — one representative function per module, listed below. Of these, 61 passed and 0 failed, which means every component examined performed exactly according to its expected behavior when exercised on its own. Testing was conducted in two complementary passes. The first pass was automated through the evidence suite (`backend/capstone-tests.js`), which executed 22 checks green with zero failures and an exit code of zero - seventeen of them the tabulated unit rows above (five PayMongo webhook checks and twelve fairy voice-routing checks), the remaining five supporting the integration results below. In detail: prove the PayMongo webhook guard accepts a genuine signature while rejecting tampered bodies, wrong secrets, missing headers, and malformed headers; twelve checks prove the fairy voice routing maps all five feelings to their voice sets, falls back to calm on unknown input, resolves all twenty take slots, carries complete voice copy for all four emotions, and reports silence safely with no audio present; and five checks prove the server boots, answers health, returns JSON 404s, and rejects tokenless calls to guarded routes. The production frontend build compiled cleanly alongside, and ESLint reported zero errors on all touched files. The second pass was a guided manual walkthrough on the development build against the development Supabase project, with each remaining row traced end to end against its implementation: authentication accepted valid credentials and rejected invalid ones with clear messages, including one-time-code recovery and acting-role scoping; authorization held across roles, isolating each caregiver to their own child and refusing deactivated accounts; student admission saved records with photos while archive, restore, and permanent delete each behaved as designed; waiver submission, return, and reminders completed their cycle; assessment answering computed correct domain scores behind signature-gated approval; the decision-support suggestion resolved to the correct support level pending licensed sign-off; the voice flow required mood, audio, and metrics before it would submit, stored bytes under patient-scoped paths, and returned working playback URLs to both client and doctor views with a wall-clock-accurate mobile timer; appointments scheduled individually and in groups while refusing overlaps and sending reminders; notifications appeared with counts, delivered mail through every fallback, and cleared on read; checkout issued payment URLs; the vault listed only previewable documents with descriptive errors and watermarked downloads; the audit log refused modification while displaying actors and timestamps; landing drafts staged and published with working image uploads; and the fairy displayed all five moods, reset its poses on reopen, hid missing art cleanly, and kept its footer pinned. No errors were encountered during the test executions themselves. Two genuine defects were, however, uncovered in the course of testing and both were corrected before the results above were recorded: first, a server pagination default that silently reduced the patients and audit listings to a single row, which was fixed by treating omitted paging arguments as no pagination; and second, a voice upload path that failed storage access control because browsers hold no Supabase session, which was rebuilt behind authenticated backend routes with service-role playback URLs. With those corrections in place, each individual component performed according to its expected behavior.

# Results of Integration Testing

This section presents the results of integration testing, which determines whether the different modules or components of the system work correctly when combined. While unit testing checks individual components, integration testing checks whether those components can properly communicate, exchange data, and work together.

## Table 15. Results of Integration Testing

| Integrated Modules | Test Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Recorder + Storage + Journal + Doctor View | Record a voice take, submit the journal, play it back as a doctor | Audio travels from mic to doctor playback intact | Audio played back intact end to end | Passed |
| Document Release + PayMongo + Notifications | Request a copy, pay online, release the document | Payment settles and the document releases with notice | Document released with notice | Passed |
| Assessment + Approval + Vault + PDF | Answer, submit, approve, preview, and download an assessment | Approved record previews and downloads correctly | Record handled correctly end to end | Passed |
| Scheduling + Reminders + Notifications | Create an appointment and run the reminder job | Reminder email and notice arrive on schedule | Reminder and notice arrived | Passed |
| Compliance + Notifications + Waivers | Return a waiver and resubmit it signed | Resubmission completes the requirement | Requirement completed | Passed |
| Auth + RBAC + Acting Roles | Log in under each role and cross-access guarded routes | Each role sees only its scope | Scopes held for every role | Passed |
| Admission + Compliance + Status | Admit a student and complete waivers | Status automates to Active | Status automated correctly | Passed |
| Server + Router + Middleware | Boot the server and probe health, unknown, and guarded routes | Health answers and guards reject cleanly | Health answered and guards rejected cleanly | Passed |

Note: The modules communicated correctly across all eight integrated scenarios in Table 2 — every pair of components invoked one another in the right order, with the right payloads, and without loss from end to end. Data transferred correctly in each case: the recorded voice take travels from the microphone through backend storage into the doctor's player intact; the document release carries its fees into a PayMongo checkout and returns as a paid, watermarked release with notifications on both sides; an answered assessment flows through approval into the vault and downloads as the correct PDF; appointments flow into reminders and notices; waivers cycle through return and resubmission back to completion; logins resolve into correctly scoped roles; and admissions mature into automated Active statuses. Five HTTP wiring checks (health, unknown route, and three tokenless rejections) executed green inside the automated suite, confirming the server, router, and middleware layer beneath these flows. No errors were encountered during integration. The single defect relevant to these flows — the storage access failure on voice upload found during unit testing — was corrected before the end-to-end voice scenario ran, so the integrated functions produced the expected results in every scenario.
