# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| main    | :white_check_mark: |
| dev     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in VeggaStare, please report it responsibly:

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: **[security@veggat.com]** (or the repository owner directly)
3. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes

We will respond within **48 hours** and work with you to understand and resolve the issue.

## Security Measures

### Automated Security Scanning

This repository uses the following GitHub security features:

| Feature | Status | Description |
|---------|--------|-------------|
| **Dependabot Alerts** | ✅ Enabled | Alerts for vulnerable dependencies |
| **Dependabot Updates** | ✅ Enabled | Weekly automated dependency PRs |
| **Code Scanning (CodeQL)** | ✅ Enabled | Static analysis for security vulnerabilities |
| **Secret Scanning** | ✅ Enabled | Detects leaked credentials in commits |
| **Push Protection** | ✅ Enabled | Blocks pushes containing secrets |

### Manual Review Requirements

- All PRs to `main` and `dev` require CI to pass
- Security-related changes are reviewed by the repository owner
- Sensitive operations (payments, auth, user data) require careful code review

## Security Best Practices

### For Contributors

1. **Never commit secrets** — use environment variables
2. **Validate all inputs** — use Zod schemas for server actions
3. **Use parameterized queries** — Prisma handles this automatically
4. **Check authorization** — verify user permissions before mutations
5. **Review dependency updates** — check changelogs for breaking/security changes

### Environment Variables

See `frontend/.env.example` and `backend/.env.example` for required variables.

Never commit:
- API keys
- Database connection strings
- Auth secrets
- Private keys

### Data Protection

This application complies with:
- **GDPR** (European data protection)
- **Norwegian data regulations** (Personopplysningsloven)

See `docs/NORWAY_LEGAL_COMPLIANCE.md` for details.

## Known Security Considerations

### Third-Party Services

| Service | Security Notes |
|---------|----------------|
| Vercel | SOC 2 Type 2 compliant, handles deployment secrets |
| Railway | SOC 2 Type 2 compliant, manages backend infra |
| Pusher | Real-time messaging, uses channel authentication |
| EdgeStore | File uploads with signed URLs |
| Neon/Supabase | PostgreSQL with SSL, connection pooling |

### Rate Limiting

- AI endpoints have token-based rate limiting
- Auth endpoints use progressive delays
- API routes use standard rate limiting

## Incident Response

If a security incident occurs:

1. Immediately revoke any compromised credentials
2. Rotate relevant API keys and secrets
3. Review audit logs for unauthorized access
4. Notify affected users if required by law
5. Document the incident and remediation

## Contact

For security inquiries: **security@veggat.com**

Repository owner: **@v3gga**
