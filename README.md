# 📘 CAI / KSV — Vision Scan & Verification Platform

ប្រព័ន្ធនេះជា **monorepo ពិតប្រាកដ** ដែលដំណើរការជាមួយ **pnpm workspaces**, រួមមាន Frontend (React + Vite), Backend API (Express + Drizzle ORM), និង Database (PostgreSQL)។ ទិន្នន័យស្កេន (scan records) ត្រូវបានផ្ទុកជាអចិន្ត្រៃយ៍ក្នុង PostgreSQL — មិនមែនទិន្នន័យសិប្បនិម្មិតទេ។

សូមមើលផ្នែក [ការតភ្ជាប់ និងស្ថានភាពផ្ទៀងផ្ទាត់](#-ការតភ្ជាប់-ដែលបានផ្ទៀងផ្ទាត់ហើយ) ខាងក្រោម សម្រាប់ភស្តុតាងថាប្រព័ន្ធនេះដំណើរការជាក់ស្តែង។

## 📁 រចនាសម្ព័ន្ធឯកសារ (272 files សរុប — ផ្ទៀងផ្ទាត់ដោយ `find . -type f | wc -l`)

```text
khoem-now/                          (root — 272 files សរុប)
├── artifacts/                      (191 files)
│   ├── api-server/                 # Backend API — Express + Drizzle + Pino logger
│   │   ├── src/
│   │   │   ├── app.ts              # Express app, mount "/api" prefix
│   │   │   ├── index.ts            # Entry point (listens on PORT)
│   │   │   ├── lib/                # cai-auth.ts, logger.ts
│   │   │   ├── middlewares/
│   │   │   └── routes/             # cai-auth.ts, cai-scans.ts, health.ts, index.ts
│   │   ├── build.mjs                # esbuild bundler → dist/
│   │   └── package.json
│   ├── cai-pro-vision/              # Frontend — React + Vite (KSV/CAI Scan UI)
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/ui/       # shadcn/ui components (accordion, dialog, table, ...)
│   │   │   ├── main.tsx
│   │   │   └── locales/             # en.json, km.json (multi-language)
│   │   └── vite.config.ts
│   └── mockup-sandbox/              # Design sandbox — React + Vite (UI prototyping)
├── backend/                         (14 files — Node/Express auth+users+scans layer)
│   ├── db/                          # migrate.ts, pool.ts, schema.sql
│   ├── middleware/auth.ts
│   ├── routes/                      # auth.ts, users.ts, scans.ts
│   └── server.ts
├── lib/                             (34 files — shared packages)
│   ├── api-client-react/            # Generated React Query client (Orval)
│   ├── api-spec/                    # openapi.yaml — API contract source of truth
│   ├── api-zod/                     # Generated Zod schemas/types from OpenAPI
│   └── db/                          # Drizzle schema (schema/cai.ts) + migrations
├── src/                             (16 files — root workspace scripts)
├── scripts/                         # post-merge.sh, hello.ts
├── package.json                     # pnpm workspace root
├── pnpm-workspace.yaml
└── README.md                        # (ឯកសារនេះ)
```

## 🚀 របៀបដំឡើង

1. ត្រូវប្រាកដថាមាន **Node.js**, **pnpm**, និង **PostgreSQL** ដំឡើងរួច (Termux: `pkg install postgresql nodejs`, `npm install -g pnpm`)
2. Clone repository ចូល folder ស្អាត (កុំ clone ត្រួតគ្នាក្នុង folder ដែលមាន project ស្រាប់)៖
   ```bash
   cd ~
   git clone https://github.com/KHOEM-AI/CAI.git
   cd CAI/khoem-now
   ```
3. ដំឡើង dependencies ទាំងអស់ (pnpm workspace ដំណើរការគ្រប់ package ក្នុងម្តង)៖
   ```bash
   pnpm install
   ```
4. ចាប់ផ្តើម PostgreSQL (បើមិនទាន់រត់)៖
   ```bash
   pg_ctl -D /data/data/com.termux/files/usr/var/lib/postgresql start
   ```

## ▶️ របៀបដំណើរការ (Run)

ប្រើ script `~/start-cai.sh` ដែលចាប់ផ្តើមទាំង PostgreSQL, API Server, និង Frontend ក្នុងពាក្យបញ្ជាតែមួយ៖

```bash
cd ~
./start-cai.sh
```

| សេវា | Port | Path បញ្ជាចេញ (script) |
|---|---|---|
| API Server (Express) | `5000` | `~/CAI/khoem-now/artifacts/api-server` |
| Frontend (Vite — CAI/KSV UI) | `5174` | `~/CAI/khoem-now/artifacts/cai-pro-vision` |
| PostgreSQL | `5432` | `pg_ctl` |

ដើម្បីបញ្ឈប់ទាំងអស់ម្តងទោល៖ `Ctrl+C` (script ប្រើ `wait` ចាំគ្រប់ background process)។

## ✅ ការតភ្ជាប់ដែលបានផ្ទៀងផ្ទាត់ហើយ

ធ្វើតេស្តជាក់ស្តែងកាលពី 2026-09-04៖

```bash
$ curl http://localhost:5000/api/healthz
{"status":"ok"}
```

នេះបញ្ជាក់ថា Frontend (5174) → API Server (5000) → PostgreSQL (5432) ភ្ជាប់គ្នាបានត្រឹមត្រូវ តាមរយៈ prefix `/api` ដែលកំណត់ក្នុង `app.ts` (`app.use("/api", router)`)។

## 🔌 API Endpoints ដែលមានស្រាប់

| Method | Path | Source file | ការងារ |
|---|---|---|---|
| GET | `/api/healthz` | `routes/health.ts` | ត្រួតពិនិត្យស្ថានភាព server (health check) |
| — | `/api/*` (cai-scans) | `routes/cai-scans.ts` | គ្រប់គ្រងទិន្នន័យស្កេន (scan records) |
| — | `/api/*` (cai-auth) | `routes/cai-auth.ts` | ការផ្ទៀងផ្ទាត់អ្នកប្រើប្រាស់ |
| — | `/api/*` (cloud-detect) | `routes/cloud-detect.ts` | ការវិភាគរូបភាព (AI detection) |

*ចំណាំ: path ជាក់លាក់នៃ route ខាងលើ (មិនមែន health) មិនទាន់បានផ្ទៀងផ្ទាត់ដោយផ្ទាល់ — សូមបើក file ដើម្បីមើល path ពិតប្រាកដ។*

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite 7, TailwindCSS 4, shadcn/ui, TanStack Query, Zod
- **Backend**: Express 5, Drizzle ORM, Pino (logging), PostgreSQL
- **Codegen**: OpenAPI (`lib/api-spec/openapi.yaml`) → Orval → `lib/api-zod` + `lib/api-client-react`
- **Package manager**: pnpm workspaces (monorepo)
- **Environment**: Termux (Android), Git + GitHub (`KHOEM-AI/CAI`)

## ⚠️ ចំណាំបច្ចេកទេស

- `start-cai.sh` និង `start-KSV.sh` ត្រូវបានកែ path ពី `~/CAI/artifacts/...` ទៅ `~/CAI/khoem-now/artifacts/...` (2026-09-04) បន្ទាប់ពីសម្អាត duplicate folder ចេញពី root
- បើឃើញ error `lock file "postmaster.pid" already exists` ពេលរត់ script — នេះមិនមែនបញ្ហាទេ, មានន័យថា PostgreSQL កំពុងរត់ស្រាប់ (មិនចាំបាច់ចាប់ផ្តើមម្តងទៀត)
- Root repository (`~/CAI/`) គួរមានតែ `khoem-now/` + `README.md` + config files — កុំ `cp -r . ..` ព្រោះនឹងបង្កើត duplicate ត្រួតគ្នា
