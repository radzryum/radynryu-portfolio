# Client (Parent / Guardian) Guide

The client portal is where parents and guardians manage their child's care at
ClearMind Psychological Services. After you log in you land on **Home & Progress**.

Access your other sections from the left-hand sidebar:

| Section | Route | Purpose |
|---------|-------|---------|
| Home & Progress | `/client/home` | Dashboard: child's info, today's activities, announcements, upcoming appointments |
| Daily Journal | `/client/activity` | Log your child's daily mood, behaviors, sleep, and appetite |
| Assessment Services | `/client/assessments` | Request assessment documents, pay online, view pick-up slips |
| Announcements | `/client/announcements` | Clinic announcements and notices |
| Appointments | `/client/appointments` | View your child's scheduled sessions |
| Consents & Waivers | `/client/waivers` | Review and sign consent waivers |
| My Profile | `/client/profile` | Update profile and change your password |

---

## Home & Progress

- Shows a welcome banner with your child's name.
- **Recent Announcements** — clinic announcements targeted to you or your child.
- **Turn in Daily Journal** — quick stat showing whether today's journal has been
  submitted.
- When no statistics load (e.g., no enrolled child yet), an error card appears
  instead of an endless loading spinner. Reload the page to retry.

## Daily Journal

- **Add a journal** for the current day (mood, task completion, behavioral
  episodes, sleep quality, appetite, observations).
- **Update / Delete** existing entries from your history.
- A journal can be locked for editing once it has been submitted/reviewed.

## Assessment Services

This is the main workflow for requesting and receiving assessment documents.

1. **Request Documents** — select the assessment documents you want released and
   choose a payment preference:
   - **Pay Onsite** — pay at the clinic cashier/reception.
   - **Pay Online** — pay through PayMongo (GCash / card).
   The button is disabled while you already have an active request.
2. **Pay Now** — for online preference, opens a PayMongo checkout. After paying
   you are redirected back and the status is polled automatically.
3. **View Slip / View Pick-Up Slip** — once the clinic schedules your pick-up,
   view the date, times, location, itemized fees, and total amount.
4. The clinic will notify you when the documents are ready for release.

Notes for online payment:
- The amount shown is the total quoted by the clinic.
- The backend now verifies that the amount PayMongo reports matches the quoted
  total before marking your request as paid (prevents incorrect "paid" states).

## Announcements

Lists announcements published for clients. If the fetch fails, an empty list is
shown; check your connection if you expect items to appear.

## Appointments

- Calendar/list of your child's scheduled sessions.
- Reminders are sent by the clinic automatically the day before a session.

## Consents & Waivers

- **Review a waiver** and **sign** it using the e-signature pad.
- Fill in the required parent/guardian details (name, contact) and acknowledge
  the house rules and provisions before submitting.
- An inline error message appears if required fields are missing.

## My Profile

- Update your display name and contact details.
- **Change password** using your current password plus a new one (min 6
  characters).

---

## Tips

- Keep your contact number current so the clinic can reach you.
- Submit your daily journal before midnight local time for it to count for the
  current calendar day.
- You can only hold one active document-release request at a time.
