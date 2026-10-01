<div align="center">

# CODEFORENSIC

### Investigate. Trace. Explain.

**A forensic workspace for understanding software evidence — code, dependencies, security signals, change history and website behavior.**

[![Live App](https://img.shields.io/badge/Live_App-Open_CodeForensic-6C4BFF?style=for-the-badge)](https://codeforensic-web.onrender.com/)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

> **Every change leaves evidence.**

</div>

---

## What is CodeForensic?

CodeForensic turns a software project into an investigation workspace. Instead of presenting disconnected dashboards, it helps a user answer five practical questions:

1. **What is inside this project?**
2. **What needs attention first?**
3. **Where is the exact evidence?**
4. **What is connected or affected?**
5. **What should I investigate next?**

The product is built around **real input and explainable evidence**. If a measurement is unavailable, CodeForensic reports the limitation rather than inventing a value.

## Current Product

| Surface | Purpose | Status |
|---|---|---|
| **Command Center** | Clear project summary and investigation priorities | Working |
| **Evidence Explorer** | Inspect files, findings and forensic context | Working |
| **Dependency Map** | Visualize verified repository relationships | Working |
| **Security** | Surface suspicious patterns and security evidence | Working |
| **Website X-Ray** | Inspect HTTP, security-header, document and SEO evidence | Working |
| **Change History** | Show available repository/commit evidence | Working where Git evidence exists |
| **Forensic AI** | Ask project-aware questions using Gemini | Integrated |
| **Desktop Agent** | Windows floating monitor and local system telemetry | Early development |

## Investigation Flow

```text
Authenticate
    ↓
Import Repository (ZIP / GitHub)
    ↓
Analyze Files & Evidence
    ↓
Command Center
    ├── Evidence Explorer
    ├── Dependency Map
    ├── Security
    ├── Website X-Ray
    ├── Change History
    └── Forensic AI
```

## Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 19, Vite, TypeScript | Investigation workspace and interaction |
| Visualization | XYFlow / React Flow, Recharts | Dependency topology and metrics |
| Motion | Motion + CSS | Purposeful transitions and investigation states |
| Backend | Node.js, Express 5, TypeScript | REST APIs and analysis services |
| Database | PostgreSQL / Neon | Users, projects, files, evidence and analysis data |
| ORM | Prisma | Data models and database access |
| Authentication | JWT, bcrypt, Google OAuth | Identity and protected APIs |
| Project ingestion | Multer, Adm-Zip | ZIP upload and extraction |
| AI | Google Gemini API | Evidence-aware forensic assistance |
| Website analysis | Direct HTTP probe + PageSpeed/Lighthouse when available | Web response, security and document evidence |
| Desktop companion | Electron + Node.js OS APIs | Local Windows telemetry — early stage |
| Hosting | Render + Neon | Production web/API/database |
| CI | GitHub Actions | Type checking and frontend build verification |

## Website X-Ray

Website X-Ray performs a real server-side probe of a public URL and can report evidence such as:

- HTTP status and final URL
- server response timing and HTML transfer size
- HTTPS and security headers
- title, meta description, viewport and language
- H1, canonical, robots and Open Graph signals
- page inventory such as images, missing alt text, links, scripts, forms and headings

When Lighthouse data is unavailable, browser-only measurements are **not fabricated**.

## Dependency Intelligence

The dependency map is designed as an investigation tool rather than an animated decoration:

- only relationships discovered from repository evidence are connected;
- arrows indicate the observed import/dependency direction;
- the default graph remains calm and readable;
- selecting a file highlights the relevant trace;
- indirect relationships are not presented as direct evidence.

## Security Model

CodeForensic currently performs **static and heuristic analysis** of imported source material. It is not presented as a replacement for endpoint antivirus software.

The developing desktop companion is intended to connect CodeForensic with genuine Windows telemetry and approved operating-system security capabilities. System-wide actions will require explicit user permission.

See **[Security](docs/SECURITY.md)** for the project security principles.

## Architecture

```text
                         ┌─────────────────────────┐
 ZIP / GitHub ─────────► │   React Investigation   │
 Website URL ──────────► │        Workspace        │
                         └────────────┬────────────┘
                                      │ REST
                         ┌────────────▼────────────┐
                         │  Express / TypeScript   │
                         │   Analysis Services     │
                         └──────┬──────────┬───────┘
                                │          │
                         ┌──────▼─────┐ ┌──▼───────────┐
                         │ PostgreSQL │ │ Gemini / Web │
                         │   + Prisma │ │ integrations │
                         └────────────┘ └──────────────┘

 Windows Desktop Agent (early)
        └── local CPU / RAM / uptime telemetry
```

More detail: **[Architecture](docs/ARCHITECTURE.md)**.

## Repository Structure

```text
codeforensic/
├── frontend/        React + Vite investigation interface
├── backend/         Express API, Prisma and analysis services
├── desktop/         Early Windows desktop companion
├── docs/            Architecture and security documentation
├── storage/         Local project/upload storage structure
└── .github/         CI workflow
```

## Run Locally

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Environment variables for the database, authentication, OAuth and AI integrations must be configured separately. **Never commit secrets or API keys.**

## Evidence Integrity

CodeForensic follows one non-negotiable rule:

> **Measured evidence is more valuable than impressive-looking fake data.**

The application should never knowingly fabricate repository statistics, Git history, contributors, dependency edges, security findings, malware detections, Lighthouse measurements or system-performance improvements.

## Project Status

CodeForensic is under active development. The full-stack web product is operational; deeper analysis, security evidence, AI grounding and the Windows desktop companion continue to evolve.

---

<div align="center">

**CODEFORENSIC** · Investigate. Trace. Explain.

Built as a software-forensics engineering project.

</div>
