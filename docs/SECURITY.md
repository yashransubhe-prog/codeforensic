# CodeForensic Security

## Security Principles

CodeForensic must treat imported software projects as untrusted input.

## Planned Protections

- Password hashing
- Authentication
- Authorization
- Input validation
- File size limits
- ZIP path traversal protection
- Safe archive extraction
- Rate limiting
- CORS protection
- Secure environment variables
- SQL injection protection
- XSS protection
- Safe error handling

## Uploaded Projects

Uploaded project files must never be executed automatically.

## AI Security

The Gemini API key must remain on the backend.

The frontend must never contain the Gemini API key.

## Evidence Integrity

The system should distinguish between:

- Facts
- Inferences
- Recommendations

The system must not claim certainty when evidence is insufficient.