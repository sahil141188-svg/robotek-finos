# Robotek FinOS — Project Brief for Claude Code

## Company
Company:  Robotek India — mobile accessories manufacturer, founded 2004
Scale:    500+ workers, manufacturing in Kundli Haryana, HQ Delhi
Accounting Software: Busy Accounting Software (exports as Excel and PDF)

## What We Are Building
App Name: Robotek FinOS
Purpose:  Integrated Finance and Compliance Operating System
Users:    CEO (Sahil Aggarwal), CFO, COO, Accounts Team (4 people), CA (external)

## Tech Stack (NEVER change this)
Framework:    Next.js 15 App Router
Database:     Supabase (PostgreSQL)
Auth:         Supabase Auth — 5 roles: ceo, cfo, coo, accounts, ca
UI:           shadcn/ui components + Tailwind CSS
Charts:       Recharts (for all dashboard charts)
File Parsing: xlsx library for Excel, pdf-parse for PDFs
Deployment:   Vercel (auto-deploy from GitHub)
Language:     TypeScript always — no plain JavaScript

## Brand Colors (ALWAYS use these)
Primary Red:   #E52D31
Deep Maroon:   #852321
Near Black:    #1F1B20
Brand Yellow:  #F7DA11
Background:    #FEFEFE
Gray Light:    #F5F4F4
Gray Mid:      #9A9596

## Non-Negotiable UX Rules
RULE 1: Every number on every screen is clickable — drill to transaction level
RULE 2: Three-layer drill: Dashboard → Category → Transaction → Source file
RULE 3: "Import/Update Data" button on every module — contextual upload
RULE 4: Role-based views — CEO sees summary, CFO sees detail, Accounts sees tasks
RULE 5: Indian number format — Lakhs and Crores (not millions/billions)
RULE 6: Financial year April to March (not Jan to Dec)
RULE 7: Mobile responsive — CFO must be able to use on phone
RULE 8: Dashboard must load in under 2 seconds after import
RULE 9: Every table and report must be exportable as Excel and PDF
RULE 10: Audit log of all user actions. Data encrypted at rest.

## 8 Modules to Build (in order)
Module 1:  CFO Dashboard — real-time KPI tiles, charts, full 3-layer drill-down
Module 2:  Data Import Engine — Busy Excel + PDF → database, with preview + duplicate detection
Module 3:  Compliance Calendar — GST, TDS, TCS, ROC, PF, ESI, Advance Tax, auto-reminders
Module 4:  Task Management — assign, remind, escalate, track, with audit trail
Module 5:  Accounts Payable Health — vendor aging, DPO, overdue, full ledger drill-down
Module 6:  Accounts Receivable Health — customer aging, DSO, overdue, collection log
Module 7:  Review Engine — weekly, monthly, quarterly scorecards, PDF export
Module 8:  Smart Alerts and Notifications — in-app pop-ups + WhatsApp option

## Three-Layer Drill Architecture (Core UX — Non-Negotiable)
Layer 1 — Dashboard summary number or chart (what you see)
    ↓ ONE CLICK
Layer 2 — Category breakdown / aging / period analysis (detail view)
    ↓ SECOND CLICK
Layer 3 — Individual transaction record + source file link (transaction source)

No number anywhere in the app is ever a "dead end."
Every figure links to a detail page → detail pages link to transaction records →
transaction records link to the uploaded source file.

## Role-Based Access
ceo      → Strategic view: 90-second health check, escalations, board reports
cfo      → Full financial control: P&L drill-down, AP/AR, tax liability, all modules
coo      → Operational focus: vendor payments, supply chain AP, payroll, expense trends
accounts → Execution layer: my tasks, data import, mark payments done, compliance checklist
ca       → Advisory: compliance calendar, TDS/GST workpapers, upload acknowledgements

## Compliance Calendar — Pre-Load These (All Recurring)
GST:          GSTR-1 (11th monthly), GSTR-3B (20th monthly), GSTR-9 (31 Dec annual),
              GSTR-9C (31 Dec annual), ITC reconciliation (monthly)
TDS:          Deposit (7th monthly), Returns 26Q/24Q (quarterly), Form 16A (annual)
TCS:          Deposit (7th monthly), Returns (quarterly)
Advance Tax:  15 June / 15 Sept / 15 Dec / 15 March
PF + ESI:     Deposit (15th monthly), Annual returns
Prof Tax:     State-specific
ROC:          MGT-7 and AOC-4 (60 days from AGM)
Income Tax:   ITR-6 (31 October annual), Tax Audit Report (30 September)

## Compliance Color Coding
Green  → Filed / Paid
Yellow → Due within 7 days
Red    → Overdue
Gray   → Not yet due

## Alert / Reminder Schedule
Compliance: 14 days before → 7 days → 3 days → 1 day → day of → escalate if missed
Tasks:      7 days before → 3 days → 1 day → overdue pop-up
Escalation: if not actioned within 24 hours → notify next role up (e.g., CFO)
Channels:   In-app pop-up (always) + WhatsApp (opt-in per user) + Email (opt-in per user)

## Data Import Engine Rules
- Supported: .xlsx, .xls, .csv, .pdf (digital + scanned OCR)
- Busy Accounting Software: auto-learn column structure on first import
- Upload flow: Select → Preview + confirm mapping → Validate (flag errors) → Import
- Duplicate detection before final confirmation
- Every import logged: timestamp, uploader name, file name
- Rollback: undo last import within 24 hours
- Import button available in EVERY module — not only on central import page
- After import: auto-update all dashboard KPIs immediately

## Coding Standards
- TypeScript always — no plain JavaScript
- Every page has loading.tsx and error.tsx
- All database queries through Supabase server components
- No sensitive keys in client-side code — environment variables only
- Always add comments explaining what each function does
- Breadcrumb navigation always visible — Back button always present
- shadcn/ui for all UI components — never build from scratch what shadcn provides
- Recharts for all charts — every chart segment/bar must be clickable

## Build Order (Day by Day)
Day 0:   Setup — GitHub, Supabase, Vercel accounts + this CLAUDE.md file
Day 1:   Next.js project init + Supabase connection + database schema + auth + 5 roles
Day 2:   Module 1 — CFO Dashboard with all KPI tiles, charts, full drill-down
Day 3:   Module 2 — Data Import Engine (Excel + PDF, preview, duplicate detection)
Day 4-5: Module 3 — Compliance Calendar with all Indian statutory deadlines
Day 6:   Module 4 — Task Management with reminders and escalation
Day 7-9: Modules 5 & 6 — AP Health + AR Health with aging and ledger drill-down
Day 10-11: Module 7 — Review Engine (weekly, monthly, quarterly + PDF export)
Day 12:  Deploy to Vercel — production build, environment variables, live URL

## GitHub Repository
Repo: robotek-finos
Owner: sahil141188-svg
URL:  https://github.com/sahil141188-svg/robotek-finos.git
Push to main branch after every module is complete.
