# CodeForensic Architecture

## Purpose

CodeForensic is a full-stack software-forensics workspace. The architecture keeps ingestion, evidence extraction, persistence, presentation and AI assistance separated so that every displayed result can be traced back to a source or a clearly labelled derived value.

## System Layers

| Layer | Main technology | Responsibility |
|---|---|---|
| Web client | React 19, Vite, TypeScript | Investigation UI, evidence navigation and visualizations |
| API | Express 5, TypeScript | Authentication, project, website, AI and intelligence endpoints |
| Analysis | TypeScript services | File metadata, dependency and security evidence extraction |
| Persistence | Prisma + PostgreSQL / Neon | Users, projects, files, commits, contributors, dependencies, findings and risk data |
| AI | Gemini API | Project-aware explanations through backend-controlled access |
| Web probe | Backend HTTP analysis | Website response, header and document evidence |
| Desktop companion | Electron + Node.js OS APIs | Early Windows-local telemetry layer |

## Repository Analysis Flow

```text
ZIP / GitHub source
       │
       ▼
Project ingestion
       │
       ▼
Safe file inspection
       │
       ├── file metadata / language / line data
       ├── dependency extraction
       ├── security heuristics
       └── available Git evidence
       │
       ▼
PostgreSQL evidence store
       │
       ▼
Command Center + investigation surfaces
```

Imported source code is inspected as data and must not be automatically executed.

## Website X-Ray Flow

```text
Public URL
   │
   ▼
SSRF / request validation
   │
   ▼
Direct backend probe
   ├── response status and timing
   ├── response/security headers
   └── HTML/document signals
   │
   └── optional PageSpeed/Lighthouse data when available
```

Browser-only metrics are not inferred from a server-side request.

## Desktop Companion

The `desktop/` directory contains the early Windows companion. Its purpose is to provide a small always-available local interface for operating-system telemetry that a normal browser application cannot access.

The first layer reads local CPU, physical-memory, uptime and machine information. Endpoint security actions should use genuine operating-system security capabilities rather than simulated scan results.

## Evidence Boundary

Every output belongs to one of three categories:

1. **Observed** — directly extracted or measured.
2. **Derived** — calculated from observed evidence and identified as such.
3. **Unavailable** — not measurable in the current execution context.

The architecture should never silently convert unavailable evidence into a synthetic result.
