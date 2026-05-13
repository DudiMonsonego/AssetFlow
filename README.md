<div align="center">

# ⚡ AssetFlow

### B2B SaaS · Hardware Lifecycle Management

**Track, manage, and maintain your organization's hardware — from purchase to retirement.**

[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deployed_on_Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

[**🚀 Live Demo**](https://my-assetflow.vercel.app) · [**📂 Repository**](https://github.com/DudiMonsonego/AssetFlow)

> Use the **"Try Demo"** button on the login page — no account needed.

</div>

---

## 📸 Screenshots

| Dashboard Overview | Asset Management |
|---|---|
| ![Dashboard](https://placehold.co/600x380/1e293b/94a3b8?text=Dashboard+Overview) | ![Assets](https://placehold.co/600x380/1e293b/94a3b8?text=Asset+Management) |

| Maintenance Tracker | Settings & Organization |
|---|---|
| ![Maintenance](https://placehold.co/600x380/1e293b/94a3b8?text=Maintenance+Tracker) | ![Settings](https://placehold.co/600x380/1e293b/94a3b8?text=Settings+%26+Org) |

---

## 🎯 What is AssetFlow?

AssetFlow is a **full-stack B2B SaaS application** that helps organizations track every hardware asset through its entire lifecycle — from procurement to retirement. Built as a portfolio project to demonstrate production-grade architecture, security, and developer practices.

> **For recruiters:** Click **"Try Demo"** on the login page to explore a live, sandboxed environment. The demo account runs against a real PostgreSQL database with Row Level Security enforced — you'll only see demo data, never another user's records.

---

## ✨ Features

### 🏢 Multi-Tenant Architecture
- Every user belongs to an **organization (tenant)**
- Complete data isolation enforced at the **PostgreSQL level** via Row Level Security (RLS)
- A user from Org A can never read, write, or even detect Org B's data — not through the UI, not through the API

### 📦 Asset Management
- Full **CRUD** for hardware assets (laptops, phones, networking gear, etc.)
- Status tracking: `Active` → `In Maintenance` → `Retired` / `Disposed` / `Lost`
- Purchase date & warranty expiry tracking
- **AI-powered category suggestion** — describe an asset, get an instant category recommendation (OpenAI GPT-4o-mini with keyword fallback)

### 🔧 Maintenance & Warranty Monitoring
- Dashboard alerts when **>3 assets** need immediate attention
- Dedicated Maintenance page showing all assets with warranties expiring within 30 days
- **Automated cron job** (`/api/cron/check-warranty`) scans daily and creates maintenance log entries for expiring warranties
- Vercel Cron-compatible — runs automatically at 08:00 UTC every day

### 👥 Team Management
- Invite and manage team members within your organization
- Role-based access: `Owner` · `Admin` · `Technician` · `Member` · `Viewer`
- Owners can change any member's role from the Team page

### ⚙️ Settings & Organization
- Update your organization name (owners/admins only)
- Update your display name
- View your role, organization ID, and plan

### 🔗 Webhook Integration
- Fires a structured `POST` request to any URL (Make.com / Zapier / n8n) when an asset status changes to **In Maintenance**
- Payload includes asset name, serial number, and organization name
- Silently no-ops if no webhook URL is configured

### 🎭 Live Demo Access
- **"Try Demo"** button on the login page signs in with a pre-seeded account
- Demonstrates RLS in action: isolated data, real database, real security
- Perfect for recruiters to explore without creating an account

---

## 🏗️ Architecture & Technical Decisions

### Why these choices?

| Decision | Rationale |
|---|---|
| **Next.js 14 App Router** | Server Components for fast initial loads, streaming with Suspense, co-located API routes |
| **Supabase RLS over app-level filtering** | Security enforced at the database layer — cannot be bypassed by any client-side code |
| **Service pattern** | UI components never touch Supabase directly; all DB calls go through typed service functions |
| **Admin client for mutations** | Privileged writes (bootstrap tenant, update profile) use the service role key server-side only — never exposed to the browser |
| **PKCE auth callback route** | Proper handling of Supabase email confirmation codes — avoids broken sessions from `/?code=...` redirects |
| **Server-side pre-fetching** | Assets page fetches data in the Server Component, passes as props — eliminates client-side loading spinners |

### Data Flow

```
Browser  →  Next.js Middleware (session refresh)
         →  Server Component (pre-fetch data via Supabase SSR client)
         →  Client Component (interactive UI, receives data as props)
         →  API Route Handler (mutations, webhook triggers, admin operations)
         →  Supabase PostgreSQL (RLS enforced on every query)
```

### Database Schema

```
organizations   ──┐
                  ├── profiles  (user ↔ org link, role)
auth.users      ──┘
                        │
                        ▼
                     assets  ──── maintenance_logs
```

All tables have `organization_id` and RLS policies using a `get_my_org_id()` helper function that resolves the current user's organization from their JWT.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS + Shadcn/UI |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/password, PKCE) |
| **ORM / Query** | Supabase JS client (typed) |
| **AI** | OpenAI GPT-4o-mini (with keyword fallback) |
| **Deployment** | Vercel (with Cron Jobs) |
| **Webhooks** | Make.com / Zapier compatible |

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & install

```bash
git clone https://github.com/DudiMonsonego/AssetFlow.git
cd AssetFlow
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional — AI category suggestion (falls back to keyword matching if absent)
OPENAI_API_KEY=

# Optional — webhook on asset repair
WEBHOOK_URL_ASSET_REPAIR=

# Demo access button (leave blank to hide)
NEXT_PUBLIC_DEMO_EMAIL=
NEXT_PUBLIC_DEMO_PASSWORD=
```

### 3. Apply database migrations

Run each file in order in your **Supabase SQL Editor**:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_schema.sql
supabase/migrations/003_setup_tenant_fn.sql
supabase/migrations/004_fix_profiles_rls.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — sign up to create your organization.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login & signup pages
│   ├── (dashboard)/         # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── assets/      # Asset management
│   │       ├── maintenance/ # Warranty & maintenance tracker
│   │       ├── organization/# Org settings
│   │       ├── settings/    # User settings
│   │       └── team/        # Team management
│   ├── api/
│   │   ├── ai/              # GPT category suggestion
│   │   ├── auth/            # Tenant bootstrapping
│   │   ├── cron/            # Warranty check job
│   │   ├── org/             # Org update endpoint
│   │   ├── profile/         # Profile update endpoint
│   │   ├── team/            # Role management
│   │   └── webhooks/        # Repair notification webhook
│   └── auth/callback/       # Supabase PKCE code exchange
├── components/
│   ├── dashboard/           # Layout, sidebar, stats cards
│   └── ui/                  # Shadcn/UI component library
├── lib/supabase/            # Client, server, admin, middleware clients
├── services/                # Business logic — DB calls go here only
└── types/                   # Generated Supabase TypeScript types
```

---

## 🔒 Security Highlights

- **Row Level Security** on all tables — data isolation is database-enforced, not app-enforced
- **Service role key** only ever used server-side (Route Handlers, never the browser bundle)
- **JWT verification** on every mutation endpoint before any DB write
- **PKCE flow** for email confirmation — no implicit token exposure
- **Idempotent tenant bootstrapping** — safe to call multiple times, never creates duplicates
- **`.env.local` excluded from git** via `.gitignore`

---

## 📄 License

MIT — feel free to use this as a reference or starting point for your own projects.

---

<div align="center">

Built with ❤️ by [Dudi Monsonego](https://github.com/DudiMonsonego)

*Open to full-stack / frontend engineering opportunities*

</div>
