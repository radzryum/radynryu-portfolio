# CyMon (ClearMind) — Tech Stack & Architecture

## Frontend

| Category | Technology | Version |
|----------|-----------|---------|
| **Language** | JavaScript (JSX) | ES2022+ |
| **UI Library** | React | 19.2.5 |
| **Bundler / Dev Server** | Vite | 8.0.10 |
| **Styling** | Tailwind CSS (v4, `@tailwindcss/vite` plugin) | 4.2.4 |
| **Routing** | React Router DOM | 7.15.0 |
| **Icons** | Lucide React | 1.28.0 |
| **Notifications** | React Hot Toast | 2.6.0 |
| **Auth / Data** | Supabase JS Client (`@supabase/supabase-js`) | 2.108.1 |
| **3D & Shaders** | `@shadergradient/react`, `@react-three/fiber`, `three` | ^2.4.20 |
| **Linting** | ESLint 10 (flat config) + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` | 10.2.1 |
| **E2E Testing** | Playwright | 1.61.0 |

## Backend

| Category | Technology | Version |
|----------|-----------|---------|
| **Language** | JavaScript (CommonJS) | Node.js |
| **Runtime** | Node.js | — |
| **Framework** | Express | 5.2.1 |
| **Database & Auth** | Supabase (PostgreSQL) via `@supabase/supabase-js` | 2.108.1 |
| **Email (Production)** | Resend API (`resend`) | 6.20.0 |
| **Email (Dev Fallback)** | Nodemailer (SMTP) | 9.0.5 |
| **PDF Generation** | pdf-lib | 1.17.1 |
| **PDF Parsing** | pdf-parse | 2.4.5 |
| **PDF Rendering** | pdfjs-dist | 6.2.108 |
| **Environment Config** | dotenv | 17.4.2 |
| **CORS** | cors | 2.8.6 |
| **Dev Auto-restart** | nodemon | 3.1.14 |

## APIs & External Services

| Service | Purpose | Protocol |
|---------|---------|----------|
| **Supabase** | PostgreSQL database, authentication, file storage, row-level security | HTTPS (REST) |
| **Resend** | Transactional emails (welcome, reminders, notifications, OTP) | HTTPS (REST) |

## Frontend API Endpoints (via Vite proxy → `/api/*`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Login (email or patient/employee ID) |
| POST | `/api/auth/forgot-password` | Request OTP for password reset |
| POST | `/api/auth/verify-otp` | Verify OTP code |
| POST | `/api/auth/reset-password` | Reset password with OTP |
| POST | `/api/auth/change-password` | Change own password |
| GET | `/api/auth/me` | Get current user session |
| GET | `/api/admin/patients` | List all patients |
| POST | `/api/admin/patients` | Register new student + caregiver account |
| GET | `/api/admin/patients/:id` | Get full patient profile |
| PATCH | `/api/admin/patients/:id` | Update patient record |
| DELETE | `/api/admin/patients/:id` | Delete patient |
| PATCH | `/api/admin/users/:id/account` | Update user email/password |
| GET | `/api/admin/employees` | List staff members |
| POST | `/api/admin/employees` | Register new employee |
| GET | `/api/admin/announcements` | List announcements |
| POST | `/api/admin/announcements` | Create announcement |
| PATCH | `/api/admin/announcements/:id` | Update announcement |
| DELETE | `/api/admin/announcements/:id` | Delete announcement |
| GET | `/api/admin/document-releases` | List document release requests |
| POST | `/api/admin/document-releases` | Create release request |
| PATCH | `/api/admin/document-releases/:id` | Update release request status |
| GET | `/api/client/assessments` | Get client assessments, reports, session logs |
| POST | `/api/client/document-releases` | Client creates release request |
| GET | `/api/client/waivers` | Get client waivers |
| POST | `/api/client/waivers` | Submit waiver |
| PATCH | `/api/client/waivers/:id` | Update waiver |
| GET | `/api/client/appointments` | Get client appointments |
| POST | `/api/client/payments` | Create payment (PayMongo) |
| GET | `/api/client/announcements` | Get public announcements |
| GET | `/api/psychometrician/patients` | List assigned patients |
| GET | `/api/psychometrician/student-journal/:id` | Get student journal entries |
| PATCH | `/api/psychometrician/journal-permission` | Toggle journal lock/unlock |
| PATCH | `/api/psychometrician/reports/:id` | Approve/reject report |
| PATCH | `/api/psychometrician/session-logs/:id` | Approve/reject session log |
| GET | `/api/psychologist/patients` | List assigned patients |
| PATCH | `/api/psychologist/reports/:id` | Review report |
| PATCH | `/api/psychologist/session-logs/:id` | Review session log |
| GET | `/api/health` | Health check |

## Architecture

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│  React 19 + Vite 8 + Tailwind CSS v4        │
│  SPA served from Vercel                      │
│  /api/* proxied to backend (Vite dev server) │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│                  BACKEND                     │
│  Express 5 (Node.js)                        │
│  Routes → Middleware → Handlers              │
│  Deployed on: Vercel (serverless functions)  │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│              EXTERNAL SERVICES              │
│  Supabase (DB + Auth + Storage)             │
│  Gmail API (Email via OAuth2)               │
│  PayMongo (Payments)                        │
└─────────────────────────────────────────────┘
```

## Key Design Decisions

- **Tailwind CSS v4**: Uses `@tailwindcss/vite` plugin + `@import "tailwindcss"` in CSS. No `tailwind.config.js`. Theme tokens in `src/index.css` via `@theme {}`.
- **Supabase over custom ORM**: Direct SQL/Supabase client queries. No Prisma, no Sequelize.
- **Gmail API over SMTP**: Vercel blocks SMTP ports (25/465/587). Gmail API uses HTTPS (port 443) which is never blocked.
- **PDF generation**: `pdf-lib` for creating filled forms, `pdf-parse`/`pdfjs-dist` for reading templates.
- **Module system**: Frontend is ESM (`"type": "module"`), Backend is CommonJS (`"type": "commonjs"`).
- **No TypeScript**: Pure JavaScript with JSX on the frontend.
- **No state library**: React hooks + context only. No Redux, no Zustand.
