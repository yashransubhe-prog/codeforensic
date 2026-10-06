# Contributing to CodeForensic

Thanks for contributing to CodeForensic. The project treats software analysis as evidence work, so changes should be reproducible, explainable, and careful with security-sensitive data.

## Before you start

- Keep changes focused on one problem or feature.
- Never commit API keys, passwords, tokens, database credentials, or private project data.
- Do not add fabricated repository statistics, Git history, contributors, dependency edges, security findings, malware detections, Lighthouse results, or performance claims.
- Prefer measured evidence and explicit "unavailable" states over invented values.

## Local development

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

Configure the required environment variables locally. Keep secrets out of source control.

## Branches and commits

Create a short-lived branch from `main` with a descriptive name, for example:

```text
feature/evidence-filtering
fix/security-header-parser
docs/contributor-guide
```

Use clear commit messages that describe the change rather than the activity.

## Pull requests

A good pull request should include:

1. what changed;
2. why the change is needed;
3. how it was tested or verified;
4. screenshots for visible UI changes when useful;
5. any limitations or follow-up work.

Keep unrelated refactors out of the same pull request.

## Area-specific expectations

### Analysis and evidence

If a value cannot be measured reliably, return an explicit unavailable/unknown state. Avoid heuristics that are presented as facts.

### Security

Treat security findings as evidence, not certainty. Document the signal being detected and avoid claiming antivirus-grade detection unless the implementation actually provides it.

### UI

Keep investigation states readable and purposeful. Animations should support comprehension rather than hide loading, errors, or missing evidence.

### Database and API

Document schema-impacting changes and avoid breaking existing API consumers without a migration or compatibility plan.

## Before submitting

Run the checks relevant to the area you changed, confirm the application still starts locally, and review the diff for secrets or accidental generated files.

For architecture and security context, also read:

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)

By contributing, you agree to keep CodeForensic's core rule intact: **measured evidence is more valuable than impressive-looking fake data.**
