# Security Architecture Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Security Architecture Principles

SABMS adheres to the **Zero Trust** security posture across all network layers and application components.

---

## 2. Authentication & Authorization (AuthN & AuthZ)

- **Token Mechanism**: Json Web Tokens (JWT) signed with HMAC-SHA256.
- **Token Lifespan**: Short-lived access tokens (15 mins) paired with HTTP-only, Secure refresh cookies (7 days).
- **Role-Based Access Control (RBAC)**: Fine-grained permissions per role (`ADMIN`, `VENUE_MANAGER`, `FACULTY`, `STUDENT`).

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

- [ ] Security Scan Checklists (Dependency vulnerability audit)
- [ ] TLS/SSL Cipher Suite Specs
- [ ] Compliance Guidelines (GDPR / Data Privacy)
