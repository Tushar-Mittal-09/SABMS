# Security Architecture Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Security Architecture Principles

SABMS adheres to the **Zero Trust** security posture across all network layers and application components.

---

## 2. Authentication & Authorization (AuthN & AuthZ)

- **Token Mechanism**: JSON Web Tokens (`JWT`) signed with HMAC-SHA256 for access tokens (~15 mins) paired with cryptographically random 64-byte opaque refresh tokens stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies (~7 days).
- **Verification Mechanism**: Canonical 6-digit OTP verification via Email and Phone (Redis ephemeral state with 5 min TTL).
- **Single-Use Rotation**: Refresh token rotation on every use with automated family revocation on reuse.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions per role (`ADMIN`, `VENUE_MANAGER`, `FACULTY`, `STUDENT`).
- **Detailed Specification**: Refer to [`docs/modules/authentication/SECURITY.md`](./modules/authentication/SECURITY.md) and [`docs/modules/authentication/ARCHITECTURE.md`](./modules/authentication/ARCHITECTURE.md).

---

## 3. Threat Mitigation Strategy (OWASP Top 10)

| Threat                                | Prevention Strategy              | Implementation                                         |
| :------------------------------------ | :------------------------------- | :----------------------------------------------------- |
| **SQL / NoSQL Injection**             | Mongoose schema sanitization     | Automatic stripping of `$` operators from user inputs. |
| **Cross-Site Scripting (XSS)**        | React JSX auto-escaping + Helmet | Content-Security-Policy (CSP) headers via `helmet()`.  |
| **Cross-Site Request Forgery (CSRF)** | SameSite cookie attributes       | `SameSite=Strict` HTTP-only refresh cookies.           |
| **Broken Access Control**             | Express authorization middleware | Granular role-checking middleware on protected routes. |
| **Rate Limiting / DoS**               | IP-based request throttling      | Express rate limiter (`express-rate-limit`).           |

---

## 4. Security Audit & Monitoring Register

- [x] **Auth Module Security & Threat Model**: Refer to [`docs/modules/authentication/SECURITY.md`](./modules/authentication/SECURITY.md)
- [ ] Security Scan Checklists (Dependency vulnerability audit)
- [ ] TLS/SSL Cipher Suite Specs
- [ ] Compliance Guidelines (GDPR / Data Privacy)
