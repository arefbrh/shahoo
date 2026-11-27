# Security policy

## Reporting a vulnerability

Do not publish credentials, exploit details, customer data or a usable proof-of-concept in a public GitHub Issue or Pull Request.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when available. If the repository's private reporting feature is not enabled, contact the repository owner through an already trusted private channel and request a private disclosure path. Do not place secrets in this file or in a public comment.

## Credential handling

- Never commit API keys, OAuth secrets, database URLs with passwords, private keys, certificates, OTP values or provider payloads containing personal data.
- Use protected GitHub/Vercel/Neon/provider secret stores or a local ignored environment file.
- If a credential was committed or exposed, revoke/rotate it at the issuing provider first. Deleting it from the current tree does not invalidate it or remove it from Git history.
- Do not rewrite public Git history without an approved plan for forks, existing clones, deployment references and collaborators.
- Redact secrets and personal data from logs, screenshots, CI artifacts, Issues and PR descriptions.

## Scope and limitations

This file is the disclosure policy, not evidence that the repository has passed a full secret scan or penetration test. See [Project Master Report](docs/PROJECT_MASTER_REPORT.md) for the latest security review boundary and open follow-up work.
