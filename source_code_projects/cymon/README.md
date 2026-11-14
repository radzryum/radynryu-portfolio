# CyMon — ClearMind Psychological Services Management System

## Abstract

CyMon is a web-based clinical information system developed for ClearMind Psychological Services (CMPS). The system consolidates patient profiles, behavioral and developmental assessments, daily activity monitoring, consent and waiver management, PDF document generation, and clinician workflows into a single platform accessible to five distinct user roles: clients (parents and caregivers), psychologists, psychometricians, administrators, and super administrators. The implementation follows a decoupled two-tier architecture in which a React single-page application communicates with a Node.js (Express) API, while authentication, persistent storage, and row-level access control are delegated to a managed Supabase (PostgreSQL) backend.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [Functional Decomposition by Role](#5-functional-decomposition-by-role)
6. [Authentication and Session Management](#6-authentication-and-session-management)
7. [Implementation Conventions](#7-implementation-conventions)
8. [Repository Organization](#8-repository-organization)
9. [Reproducing the Development Environment](#9-reproducing-the-development-environment)
10. [Conformance and Privacy Considerations](#10-conformance-and-privacy-considerations)
11. [Deployment Workflow](#11-deployment-workflow)
12. [Acknowledgements](#12-acknowledgements)

---

## 1. System Overview

CyMon was designed to address three concurrent operational requirements of CMPS: (i) longitudinal monitoring of clients enrolled in the SPED and psychological services programs, (ii) digitization of consent, waiver, compliance documentation, and official PDF reports in conformity with Republic Act No. 10173 (Data Privacy Act of 2012) and NPC Circular No. 2023-04, and (iii) workflow coordination among multidisciplinary clinical staff. The platform exposes role-specific interfaces backed by a shared relational schema. Authentication is performed against Supabase Auth, and authorization is enforced at both the UI tier (route guards keyed to user role) and the database tier (PostgreSQL Row-Level Security policies).

---

## 2. Tech Stack

### Frontend

| Category | Technology | Version |
|---|---|---|
| **Framework** | React | ^19.2.5 |
| **Build Tool** | Vite | ^8.0.10 |
| **Styling** | Tailwind CSS v4 (config-as-CSS model) | ^4.2.4 |
| **Routing** | React Router DOM | ^7.15.0 |
| **Icons** | Lucide React | ^1.28.0 |
| **Toast Notifications** | React Hot Toast | ^2.6.0 |
| **Charts** | Recharts | ^3.10.1 |
| **3D / Shader Backgrounds** | `@shadergradient/react` + `@react-three/fiber` + Three.js | ^2.4.20 / ^9.7.0 / ^0.185.1 |
| **Camera Controls (3D)** | `camera-controls` | ^3.1.2 |
| **Three.js Utilities** | `three-stdlib` | ^2.36.1 |
| **Auth Client** | `@supabase/supabase-js` | ^2.108.1 |
| **E2E Testing** | Playwright | ^1.61.0 |
| **Linting** | ESLint v10 (flat config) + `react-hooks` + `react-refresh` plugins | ^10.2.1 |
| **HMR Plugin** | `@vitejs/plugin-react` | ^6.0.1 |

### Backend

| Category | Technology | Version |
|---|---|---|
| **Runtime** | Node.js (CommonJS) | ≥ 20 |
| **Framework** | Express | ^5.2.1 |
| **Auth / DB Client** | `@supabase/supabase-js` | ^2.108.1 |
| **CORS** | `cors` | ^2.8.6 |
| **Env Variables** | `dotenv` | ^17.4.2 |
| **Dev Reload** | `nodemon` | ^3.1.14 |
| **Email (Transactional)** | `resend` | ^6.20.0 |
| **Email (SMTP fallback)** | `nodemailer` | ^9.0.5 |
| **Google APIs** | `googleapis` | ^176.0.0 |
| **PDF Generation** | `pdf-lib` | ^1.17.1 |
| **PDF Parsing** | `pdf-parse` + `pdfjs-dist` | ^2.4.5 / ^6.2.108 |

### Database / Cloud

| Category | Technology |
|---|---|
| **Managed Database** | Supabase (PostgreSQL with Row-Level Security) |
| **Authentication** | Supabase Auth (password grant + OTP recovery) |
| **Storage** | Supabase Storage (announcement images, profile photos, documents) |
| **Schema Migrations** | Numbered SQL files under `backend/supabase/migrations/` |

### Hosting

| Component | Platform |
|---|---|
| **Frontend** | Vercel (project: `cymon`, root: `frontend/`) |
| **Backend API** | Vercel (project: `cymon-fpoj`, root: `backend/`) |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml` + `deploy.yml`) |

---

## 3. Architecture

The system adopts a decoupled client-server architecture composed of three independently deployable components.

**Frontend → Backend proxy:** During development, Vite forwards all `/api/*` requests from port 5173 to the Express backend on port 4000, eliminating CORS concerns. In production, the same path prefix is preserved by the Vercel reverse proxy.

**Backend responsibilities:** Operations requiring server-side privileges (service-role key actions, multi-table transactions, PDF generation, email dispatch) are routed through the Express API. Operations safely performable under RLS — reads of rows the requesting user owns — are issued directly from the frontend to Supabase, reducing latency.

### 3.1 Frontend

- Implemented in **React 19** with the **Vite 8** build toolchain and `@vitejs/plugin-react` for HMR.
- **Tailwind CSS v4** is loaded through `@tailwindcss/vite`; design tokens (colors, spacing, radii, font sizes, shadows) are declared in `@theme { … }` blocks inside `src/index.css`. No separate `tailwind.config.js` is used.
- **`@shadergradient/react`**, **`@react-three/fiber`**, and **Three.js** power the animated 3D shader gradient hero background on the landing page.
- **Recharts** provides the Pie and Bar charts on the admin Overview dashboard.
- **Lucide React** provides all SVG iconography throughout the application.
- **React Hot Toast** handles all toast notifications (success, error, info).
- A curated library of in-house UI primitives (`frontend/src/components/ui/`) — `Button`, `Input`, `Checkbox`, `Textarea`, `Select`, `SignaturePad`, `Modal`, `Skeleton`, `Pagination`, `SearchBar`, `AnimatedSelect`, `ThemeToggle`, and more — ensures consistent visual identity and accessibility without third-party component libraries.

### 3.2 Backend

- A **Node.js / Express 5** application in CommonJS format.
- `index.js` configures CORS (against `CORS_ORIGIN`), registers a JSON body parser, exposes `GET /api/health`, and terminates with a centralized error middleware.
- **`pdf-lib`** generates official PDF documents (admission slips, assessment release slips, progress summary reports).
- **`resend`** is the primary transactional email provider for OTP codes and password recovery; **`nodemailer`** serves as a SMTP fallback.
- **`googleapis`** is used for Google API integrations (e.g., calendar or Drive-based features).

### 3.3 Database and Authentication

- Managed **PostgreSQL** via Supabase with Row-Level Security (RLS) on every table.
- Schema is defined as numbered SQL migration files under `backend/supabase/migrations/`.
- The `handle_new_user()` trigger materializes a `profiles` row whenever a new auth user is created.
- The frontend maintains an `AuthProvider` context exposing a `useAuth()` hook; a `RequireAuth` route guard restricts access to authenticated areas by role.

---

## 4. Data Model

The core enumeration `user_role` partitions all platform users into five categories: `client`, `psychologist`, `psychometrician`, `admin`, and `super_admin`. Each authenticated user holds a row in `public.profiles` carrying their role, display name, email, and clinic affiliation. Sub-tables `admin_profiles` and `staff` extend the base profile with role-specific fields (employee ID, license number, clinical title). Patient records, documents, consents, compliance state, daily activity logs, appointments, announcements, and audit entries are each introduced in separate numbered migrations. The audit log is append-only and records every state-mutating action for forensic inspection.

---

## 5. Functional Decomposition by Role

For a detailed breakdown of every page and feature per role, refer to **[FEATURES.md](./FEATURES.md)**.

### Quick Summary

| Role | Default Route | Core Responsibilities |
|---|---|---|
| **Client** | `/client/home` | Progress monitoring, activity logs, waivers, appointments |
| **Psychologist** | `/psychologist/approvals` | Approvals, progress notes, interventions, IEP, intake |
| **Psychometrician** | `/psychometrician/tasks` | Assessments, specialized forms, drafting reports, IEP |
| **Admin** | `/admin/overview` | Patients, employees, schedule, announcements, compliance, audit |
| **Super Admin** | `/admin/overview` | All admin capabilities + ability to create admin/super admin accounts |

---

## 6. Authentication and Session Management

On submission of the login form, the frontend invokes `supabase.auth.signInWithPassword`, which returns a JWT and refresh-token metadata persisted in browser storage. The frontend queries `profiles` for the user's role and redirects accordingly. Forgot-password flow uses a 6-digit OTP sent via **Resend** (email) with a 10-minute expiry, then allows the user to set a new password. Backend endpoints verify incoming bearer tokens via `supabase.auth.getUser` and populate request context with role and clinic affiliation before dispatching to route handlers. Secrets (service-role key) are held exclusively server-side and are never transmitted to the browser.

---

## 7. Implementation Conventions

- Changes are small and scoped to a single concern; speculative abstractions are avoided.
- Dead code and commented-out code are removed; version-control history serves as the archive.
- Comments are reserved for non-obvious rationale, not restatements of behavior.
- Frontend components are function components with hooks, one per file, named `PascalCase.jsx`; hooks are named `useCamelCase.js`.
- JSX is kept shallow — components exceeding ~40 lines or 3 nesting levels are decomposed.
- Backend handlers use CommonJS syntax, semantically correct HTTP status codes, and never return errors with `200`.
- Secrets are read from environment variables via `dotenv` and are never embedded in source.
- Branch names: `<type>/<short-slug>`. Commit messages: Conventional Commits (`feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`).

---

## 8. Repository Organization

```
cymon/
├── frontend/                         React 19 single-page application
│   ├── src/
│   │   ├── auth/                     AuthProvider, useAuth hook, RequireAuth guard
│   │   ├── components/ui/            In-house UI primitives (Button, Input, Modal, ThemeToggle, etc.)
│   │   ├── lib/                      Supabase browser client, API helpers, formatters
│   │   └── pages/                    Routed pages
│   │       ├── Landing.jsx           Public landing page (shader gradient, announcements carousel)
│   │       ├── Login.jsx             Shared auth page with multi-step password recovery
│   │       ├── client/               Client portal pages
│   │       └── staff/
│   │           ├── admin/            Admin & Super Admin pages
│   │           ├── psychologist/     Psychologist pages
│   │           └── psychometrician/  Psychometrician pages
│   ├── public/                       Static assets (logo, fonts)
│   ├── eslint.config.js              Flat ESLint config
│   ├── vite.config.js                Vite build config
│   └── package.json
├── backend/                          Express 5 API
│   ├── index.js                      Server entry point
│   ├── lib/                          PDF generators, email helpers, utilities
│   ├── supabase/migrations/          Numbered SQL schema migrations
│   └── package.json
├── docs/
│   └── designs/                      UI design exports
├── FEATURES.md                       Detailed per-role feature documentation
├── CLAUDE.md                         Repository-specific assistant guidance
└── README.md                         This document
```

---

## 9. Reproducing the Development Environment

Requires **Node.js ≥ 20** on Windows, macOS, or Linux.

```bash
# Frontend
cd frontend
cp .env.example .env        # populate VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:5173

# Backend
cd backend
cp .env.example .env        # populate PORT, CORS_ORIGIN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
npm install
npm run dev                 # http://localhost:4000
```

**Other useful commands:**

| Command | Description |
|---|---|
| `npm run build` (frontend) | Production Vite bundle |
| `npm run preview` (frontend) | Static preview of production build |
| `npm run lint` (frontend) | ESLint check |
| `npm run e2e` (frontend) | Playwright end-to-end tests |
| `npm start` (backend) | Production Node.js server |

A health-check endpoint is available at `GET http://localhost:4000/api/health` and returns:
```json
{ "status": "ok", "uptime": <seconds> }
```

### Required Environment Variables

**Frontend (`.env`)**

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |

**Backend (`.env`)**

| Variable | Description |
|---|---|
| `PORT` | Express server port (default: 4000) |
| `CORS_ORIGIN` | Allowed frontend origin (e.g., `http://localhost:5173`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only) |
| `RESEND_API_KEY` | Resend API key for transactional email |

---

## 10. Conformance and Privacy Considerations

The system processes personal and sensitive personal information within the meaning of the Data Privacy Act of 2012 and the implementing rules of the National Privacy Commission. Access to all clinical records is mediated by PostgreSQL Row-Level Security policies. The append-only audit log captures every state-mutating action with actor, timestamp, and affected row identifier. The Supabase service-role key is held exclusively on the backend and is never transmitted to the browser. The frontend retains only the anonymous public key and the issued session token; the latter is invalidated upon sign-out.

---

## 11. Deployment Workflow

The repository is deployed as one Git repository with two separate Vercel projects:

- `cymon` — frontend, rooted at `frontend/`
- `cymon-fpoj` — backend API, rooted at `backend/`

```bash
# Deploy frontend
cd frontend
npx vercel deploy --prod --yes --project cymon --scope mcggezs-projects

# Deploy backend
npx vercel deploy --prod --yes --project cymon-fpoj
```

GitHub Actions is configured in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. Add a repository secret named `VERCEL_TOKEN` to enable automated Vercel deployments from CI.

---

## 12. Acknowledgements

CyMon is developed in collaboration with ClearMind Psychological Services as part of the documentation and operational digitization of its psychological services programs. UI design references are maintained in the `docs/designs/` directory of this repository.
