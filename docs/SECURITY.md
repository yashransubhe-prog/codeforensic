# CodeForensic Security

## Security Objective

CodeForensic analyzes untrusted software projects and public website targets. The security model therefore prioritizes isolation, input validation, secret protection and evidence integrity.

## Imported Projects

- Treat every uploaded archive and source file as untrusted input.
- Do not automatically execute imported source code.
- Validate archive paths before extraction to reduce ZIP path-traversal risk.
- Apply upload and extraction limits.
- Keep user projects separated by authenticated ownership.
- Return controlled errors rather than internal stack traces.

## Authentication & API

- Passwords are hashed with bcrypt.
- Protected routes use authenticated access.
- JWT secrets and OAuth credentials belong in environment variables.
- CORS and request validation should be restrictive in production.
- Database access goes through parameterized ORM/database operations.
- Rate limiting should be added or strengthened for abuse-sensitive endpoints.

## Website X-Ray

A server-side URL analyzer can become an SSRF surface. Website X-Ray therefore needs to reject unsafe/local destinations and apply request time and response-size limits.

A target returning an error, redirect or blocked response is evidence about that probe attempt; it must not be rewritten into a successful measurement.

## AI

- Gemini credentials remain on the backend.
- Imported repository text must be treated as untrusted context, not as instructions.
- AI output is explanatory assistance, not primary forensic evidence.
- Project evidence should be attached to AI answers wherever practical.
- If evidence is insufficient, the assistant should state the limitation.

## Desktop Companion

The desktop agent has a higher trust level than the browser application because it can access local system telemetry.

- Request only permissions required for a feature.
- Keep destructive/system-changing actions explicit and user initiated.
- Do not claim malware detections unless returned by a genuine security engine.
- Do not label telemetry-history cleanup as physical RAM cleanup.
- Do not terminate processes or alter system settings silently.
- Future distributed binaries should be signed and update through a verifiable channel.

## Secrets

Never commit:

- database passwords or connection strings containing credentials;
- JWT secrets;
- OAuth client secrets;
- Gemini/API keys;
- private tokens.

If a secret is exposed, rotate it rather than relying only on deleting it from the latest commit.

## Evidence Integrity

CodeForensic distinguishes:

- **facts / observed evidence**;
- **derived indicators**;
- **recommendations**;
- **unavailable measurements**.

This distinction is part of the security model because misleading security output can be as harmful as missing output.

## Reporting

Security issues relating to this student project should be reported privately to the repository owner rather than disclosed with active credentials or sensitive user data in a public issue.
