# Super Admin Guide

A `super_admin` uses the same **Administrator** portal (`/admin`) as regular
admins, but with elevated privileges that a standard admin does not have. If you
hold both roles, you can switch between the two from the sidebar using the role
switcher.

## What is the same

All Administrator sections are available to you exactly as described in the
[Administrator Guide](admin.md) — Overview, Students, Employees, Compliance,
Schedule, Attendance, Clinical Records, Content Manager, Announcement, and Audit
Trail.

## What is different (elevated powers)

| Capability | Regular admin | Super admin |
|------------|---------------|-------------|
| Change another **admin's** account/password | ❌ Blocked | ✅ Allowed |
| Create/assign the `super_admin` role | ❌ | ✅ |
| Access the full admin toolset | ✅ | ✅ |

### Key differences

1. **Admin account management**
   - A regular admin **cannot** reset or modify another admin's account — the
     system blocks it to prevent peer account takeover.
   - As a `super_admin` you **can** reset another admin's login (email/password)
     via **Employees → Manage / override password**.
   - Use this sparingly; the action is recorded in the Audit Trail.

2. **Role assignment**
   - Only a `super_admin` should promote a user to `admin` or assign another
     `super_admin`. Keep the number of super admins small.

3. **Audit Trail**
   - Because you can perform elevated actions, always check **Audit Trail**
     (`/admin/audit`) when investigating who changed an account, released a
     document, published content, or processed a payment.

## Recommended practices

- Reserve `super_admin` for 1–2 trusted individuals (e.g., practice owner).
- Before promoting anyone, confirm the target's identity and email.
- After any admin-level reset, verify the affected account can still log in and
  that the new password is communicated securely (the temporary password flow in
  the admin portal).
- Review the Audit Trail periodically.

## Security context

- Payment webhooks are signature-verified (PayMongo `v1` scheme) and amounts are
  checked against quoted totals before a request is marked paid.
- Signup permanently creates **client** accounts only; elevated roles are granted
  by an admin/super admin — never self-requested.
