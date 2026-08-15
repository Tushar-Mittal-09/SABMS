# Sprint 2.1 — Authentication Architecture Final Acceptance

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Scope

This document serves as the formal final acceptance gate for **Sprint 2.1 — Authentication Architecture**.

The scope of Sprint 2.1 is strictly bounded to architectural design, module boundary formalization, sequence diagram mapping, security threat modeling, and documentation. Zero executable business logic, Mongoose credential models, cryptographic implementations, token issuers, Redis connections, or communication gateways were introduced into the codebase during this milestone.

---

## 2. Architecture Summary

The SABMS Authentication Module resides as an isolated bounded context within the Modular Monolith under `server/src/modules/auth/`. It is structured into deterministic tiers with strict single-direction dependencies:

```text
HTTP Request
    ↓
server/src/modules/auth/auth.routes.js (Endpoint definitions & middleware bindings)
    ↓
server/src/validations/ (Zod schema validation & AppError.validationError formatting)
    ↓
server/src/middleware/ (Security & authentication guards)
    ↓
server/src/modules/auth/auth.controller.js (Request parsing & standardized response dispatch)
    ↓
server/src/modules/auth/auth.service.js (Business rules & dependency orchestration)
    ├── server/src/modules/auth/security/ (password, otp, token, session helpers)
    ├── Redis Store (ephemeral state, OTP codes, session state, rate limits, lockouts)
    ├── Notification Transports (Nodemailer SMTP & SMS Gateway)
    └── server/src/modules/auth/auth.repository.js (MongoDB query encapsulation)
            ↓
        MongoDB Cluster (Persistent User, Role, and Session collections)
```

---

## 3. Existing Backend Compatibility

The Authentication Architecture integrates directly into the established Sprint 1 foundation:

- **Application Pipeline**: Express 5.2.1 application pipeline (`server/src/app.js`) with `trust proxy`, `X-Request-ID` correlation tracking, and centralized Winston structured logging.
- **Security Middleware Stack (Sprint 1 Active)**: Pre-configured Helmet HTTP headers, CORS origin verification with credentials support, HPP parameter defense, and Express 5 safe in-place NoSQL injection sanitization (`server/src/middleware/security.middleware.js`).
- **Dynamic Routing**: Automatic versioned route discovery via `server/src/routes/routeAggregator.js` mounting all auth endpoints under `/api/v1/auth/*` and `/api/v2/auth/*`.
- **Error & Response Contracts**: Seamless error bubbling via `catchAsync` to `AppError` and the global `errorHandler.middleware.js`, producing standardized JSON responses (`{ success: true, message, data, meta }` and `{ success: false, message, error }`).

---

## 4. Security Architecture (Current vs Target Status)

| Security Control         | Architectural Design (Target Specification)                                   | Current Implementation Status                 | Scheduled Sprint Task |
| :----------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------- | :-------------------- |
| **Zero-Trust Redaction** | Plaintext credentials/OTPs/keys strictly excluded from logs & responses       | **Active Baseline** in Winston & ErrorHandler | Sprint 1 (Active)     |
| **NoSQL Sanitization**   | Express 5 in-place sanitization on `req.body`, `req.params`, `req.query`      | **Implemented & Verified**                    | Sprint 1 (Active)     |
| **Base HTTP Headers**    | Helmet CSP, Frameguard: DENY, noSniff, XSS filter                             | **Implemented & Verified**                    | Sprint 1 (Active)     |
| **Global Rate Limiting** | Base IP throttling on all incoming HTTP requests via `express-rate-limit`     | **Implemented & Active**                      | Sprint 1 (Active)     |
| **Auth Rate Limiting**   | Endpoint-specific rate throttling on `/login`, `/register`, `/resend-otp`     | **Designed (Target Architecture)**            | Sprint 2.17           |
| **Account Lockout**      | 15-minute lock in Redis after 5 consecutive failed login attempts             | **Designed (Target Architecture)**            | Sprint 2.7 & 2.17     |
| **Auth Middleware**      | JWT signature verification, claims validation, and JTI blocklist check        | **Designed (Target Architecture)**            | Sprint 2.8            |
| **CSRF Defense**         | `HttpOnly`, `SameSite=Strict`, `Secure` cookie attributes for refresh tokens  | **Designed (Target Architecture)**            | Sprint 2.18           |
| **XSS Defense**          | React JSX escaping, sanitization filters, and token isolation from JavaScript | **Designed (Target Architecture)**            | Sprint 2.19           |
| **Auth Security Tests**  | Automated test suites for brute-force, token theft, and replay attacks        | **Designed (Target Architecture)**            | Sprint 2.20           |

---

## 5. Token Architecture (Target Specification)

The authentication module design specifies a **Dual-Token Lifecycle Strategy**:

- **Access Token**:
  - Format: JSON Web Token (`JWT`).
  - Lifespan: Short-lived (~15 minutes).
  - Claims: `sub` (User ID), `role`, `sessionId`, `jti`, `iat`, `exp` (no sensitive PII).
  - Transmission: Sent in header as `Authorization: Bearer <access-token>`.
  - Storage: In-memory client state (Zustand).
- **Refresh Token**:
  - Format: Cryptographically secure 64-byte opaque token (`crypto.randomBytes(64).toString('hex')`).
  - Lifespan: Long-lived (~7 days).
  - Transmission: Transmitted via `Set-Cookie` with `HttpOnly`, `Secure`, `SameSite=Strict` attributes.
  - Rotation: **Single-use rotation** on every `/refresh` call.
  - Theft Detection: Presenting an already-consumed refresh token immediately triggers **Token Family Revocation**, terminating all active user sessions across all devices.

---

## 6. OTP Architecture (Target Specification)

> **Decision**: **OTP (Email and Phone)** is the canonical identity verification mechanism for SABMS Sprint 2.

- **Format**: 6-digit numeric string generated via `crypto.randomInt(100000, 1000000)`.
- **TTL**: 5 minutes (300 seconds) in Redis.
- **Storage**: Plaintext is **never** stored; only cryptographic SHA-256/HMAC hashes are stored in Redis.
- **Throttling**: Maximum 5 attempts per OTP before automatic invalidation; minimum 60-second cooldown between resends; maximum 3 resends per hour.
- **Lifecycle**: One-time atomic read-and-delete upon successful verification.
- **Legacy Flows**: Magic link verification flows (SD-02, SD-10) are documented as optional/legacy reference architecture.

---

## 7. Session Architecture (Target Specification)

- **Concurrent Multi-Device Logins**: Users can maintain concurrent active sessions across desktop, tablet, and mobile clients.
- **State Properties**: `sessionId`, `userId`, `ipAddress`, `userAgent`, `deviceFingerprint`, `createdAt`, `lastActivityAt`, `status`.
- **Session Revocation Workflows**:
  - Single Device Logout: Invalidates the specific `sessionId` and token family in Redis.
  - Global Logout ("Logout all devices"): Revokes all active sessions for the user in Redis.
  - Password Reset / Change: Automatically triggers global session revocation to prevent persistent unauthorized access.

---

## 8. Redis Architecture (Target Specification)

Redis is designated to manage high-speed, ephemeral authentication state:

- `otp:email:<email>` / `otp:phone:<phone>`: Verification code hashes & attempt counters (TTL: `300s`).
- `session:<sessionId>`: Active session metadata (TTL: `604800s` / 7d).
- `rt:family:<familyId>`: Refresh token family rotation state (TTL: `604800s` / 7d).
- `lockout:<email>`: Account lockout flag after 5 failed login attempts (TTL: `900s`–`1800s`).
- `bl:jti:<jti>`: Revoked JWT access token blocklist (TTL: remaining token lifetime).

---

## 9. API Architecture (Target Specification)

All endpoints are mapped to `/api/v1/auth/*` through the existing route aggregator:

- `POST /api/v1/auth/register` (Sprint 2.4)
- `POST /api/v1/auth/verify-email-otp` (Sprint 2.5)
- `POST /api/v1/auth/verify-phone-otp` (Sprint 2.6)
- `POST /api/v1/auth/resend-otp` (Sprint 2.15)
- `POST /api/v1/auth/login` (Sprint 2.7)
- `POST /api/v1/auth/refresh` (Sprint 2.9, 2.10)
- `POST /api/v1/auth/logout` (Sprint 2.11)
- `POST /api/v1/auth/forgot-password` (Sprint 2.12)
- `POST /api/v1/auth/reset-password` (Sprint 2.13)
- `POST /api/v1/auth/change-password` (Sprint 2.14)
- `GET /api/v1/auth/me` (Sprint 2.8)
- `GET /api/v1/auth/sessions` (Sprint 2.16)

---

## 10. Documentation Coverage

The authentication module documentation suite comprises **8 documents total** (7 architecture specifications established in Sprint 2.1.3 plus this acceptance gate document created in Sprint 2.1.6):

1. [`docs/modules/authentication/README.md`](./README.md) — Module overview, index, decisions summary, and roadmap.
2. [`docs/modules/authentication/ARCHITECTURE.md`](./ARCHITECTURE.md) — Structural layout, tier responsibilities, and storage partition.
3. [`docs/modules/authentication/FLOWS.md`](./FLOWS.md) — Request/failure pipelines and sequence diagram mapping.
4. [`docs/modules/authentication/ENDPOINTS.md`](./ENDPOINTS.md) — REST endpoint specifications and JSON contracts.
5. [`docs/modules/authentication/SECURITY.md`](./SECURITY.md) — Threat model, zero-trust policies, and rate-limit design.
6. [`docs/modules/authentication/ERROR_CODES.md`](./ERROR_CODES.md) — Standardized error definitions and HTTP status codes.
7. [`docs/modules/authentication/TEST_CASES.md`](./TEST_CASES.md) — Multi-tiered test strategy and validation matrices.
8. [`docs/modules/authentication/ARCHITECTURE_ACCEPTANCE.md`](./ARCHITECTURE_ACCEPTANCE.md) — Formal Sprint 2.1 acceptance gate.

_Cross-referenced with root specifications_: [`PRD.md`](../../PRD.md), [`HLD.md`](../../HLD.md), [`LLD.md`](../../LLD.md), [`ERD.md`](../../ERD.md), [`DATABASE_DESIGN.md`](../../DATABASE_DESIGN.md), [`API_SPECIFICATION.md`](../../API_SPECIFICATION.md), [`SECURITY_ARCHITECTURE.md`](../../SECURITY_ARCHITECTURE.md), and [`TESTING_STRATEGY.md`](../../TESTING_STRATEGY.md).

---

## 11. SD-01 through SD-17 Coverage

All 17 system sequence diagrams have been audited and mapped in [`FLOWS.md`](./FLOWS.md):

- **SD-01**: User Registration (Sprint 2.4)
- **SD-02**: Email Verification (Link) `[Optional / Legacy Reference]`
- **SD-03**: User Login (Sprint 2.7)
- **SD-04**: Forgot Password (Sprint 2.12)
- **SD-05**: Reset Password (Sprint 2.13)
- **SD-06**: User Logout (Sprint 2.11)
- **SD-07**: Refresh Access Token (Sprint 2.9, 2.10)
- **SD-08**: Change Password (Sprint 2.14)
- **SD-09**: Resend Verification OTP (Sprint 2.15)
- **SD-10**: Verify Email with Token `[Optional / Legacy Reference]`
- **SD-11**: JWT Auth Middleware (Sprint 2.8)
- **SD-12**: Session Expiration & Refresh (Sprint 2.9, 2.16)
- **SD-13**: Account Lockout (Sprint 2.7, 2.17)
- **SD-14**: Account Unlock (Sprint 2.17)
- **SD-15**: Session Validation (Sprint 2.16)
- **SD-16**: OTP Verification — Email `[Canonical]` (Sprint 2.5)
- **SD-17**: OTP Verification — Phone `[Canonical]` (Sprint 2.6)

---

## 12. Sprint 1 Regression Results

- **ESLint**: `0 errors, 0 warnings` (Flat configuration verified).
- **Jest Smoke Tests**: `2 test suites, 14 tests passing` (`health.test.js`, `validation.test.js`).
- **Runtime Probes**: `/live` (200 OK), `/info` (200 OK), `/health` (503 DB-aware degraded), `/ready` (503 DB-aware degraded).
- **Route Aggregator & 404 Suggestions**: Functioning cleanly with zero regressions.

---

## 13. Scope Control

- **Source code modified in Sprint 2.1**: **NONE (0 files)**.
- **Premature Sprint 2.2+ code created**: **NONE (0 files)**.
- All implementation files strictly scheduled for subsequent Sprint 2 tasks.

---

## 14. Acceptance Matrix

| Acceptance Criterion               | Result | Evidence                                                                    |
| :--------------------------------- | :----- | :-------------------------------------------------------------------------- |
| **Authentication bounded context** | `PASS` | Isolated strictly under `server/src/modules/auth/`.                         |
| **Modular monolith compatibility** | `PASS` | Zero microservice dependencies; clean service & event boundaries.           |
| **Layered architecture**           | `PASS` | `Route → Controller → Service → Repository` strictly defined.               |
| **Existing backend integration**   | `PASS` | Compatible with Express 5, Morgan/Winston, and `errorHandler`.              |
| **API versioning**                 | `PASS` | Uniformly mapped to `/api/v1/auth/*` via `routeAggregator.js`.              |
| **Validation architecture**        | `PASS` | Zod schema validation layer strictly isolated from business services.       |
| **Error architecture**             | `PASS` | `AppError` and centralized error handler mappings standardized.             |
| **Response architecture**          | `PASS` | Standard `{ success: true, message, data, meta }` envelope enforced.        |
| **Access token architecture**      | `PASS` | Short-lived (~15m) JWT in `Authorization: Bearer` header.                   |
| **Refresh token architecture**     | `PASS` | 64-byte opaque CSPRNG token in `HttpOnly`, `SameSite=Strict` cookie.        |
| **Token rotation architecture**    | `PASS` | Single-use rotation with automated family reuse theft detection.            |
| **OTP architecture**               | `PASS` | 6-digit numeric OTP (5m TTL in Redis) is canonical for Sprint 2.            |
| **Session architecture**           | `PASS` | Multi-device concurrent sessions with selective & global revocation.        |
| **Redis architecture**             | `PASS` | Dedicated ephemeral state partitioning with explicit TTL strategy.          |
| **Security architecture**          | `PASS` | Zero-Trust logging redaction, rate limiting, and OWASP Top 10 defenses.     |
| **Sequence diagram mapping**       | `PASS` | SD-01 through SD-17 fully mapped with canonical OTP clarification.          |
| **Documentation completeness**     | `PASS` | All 8 module documents and 8 root specifications cross-referenced.          |
| **Current vs target accuracy**     | `PASS` | Sprint 1 placeholders explicitly distinguished from Sprint 2 targets.       |
| **Sprint 1 regression**            | `PASS` | ESLint (0 errors/warnings) and Jest (14/14 tests) passing with exit code 0. |
| **Scope control**                  | `PASS` | Zero source code implementation introduced during 2.1.                      |
| **Sprint 2.2 readiness**           | `PASS` | User & Role domain models ready for immediate implementation.               |

---

## 15. Outstanding Risks

**No unresolved architectural blockers.**

### Deferred Implementation Risks (Managed in Future Sprint 2 Tasks):

1. **Redis Availability & Failover**: If Redis is temporarily unreachable, OTP verification and active session checking must fail securely without compromising account state (Sprint 2.5 & 2.16).
2. **Refresh Token Family Persistence**: Balancing Redis memory usage against token family tracking for high-volume concurrent users (Sprint 2.10).
3. **OTP Delivery Transport Reliability**: Handling third-party SMTP or SMS gateway network timeouts, rate limit throttling, and delivery failures gracefully (Sprint 2.5 & 2.6).
4. **Environment-Specific Cookie Policies**: Ensuring `SameSite` and `Secure` cookie attributes match local development (`http://localhost`) vs production HTTPS environments seamlessly (Sprint 2.9).
5. **Session Concurrency Management**: Ensuring atomicity during concurrent refresh operations across multiple tabs/devices to prevent race conditions during token rotation (Sprint 2.10 & 2.16).

_Note: These are operational implementation considerations scheduled for their respective Sprint 2 implementation tasks and do not block Sprint 2.1 architecture acceptance._

---

## 16. Deferred Sprint 2 Work

- **Sprint 2.2**: User Credential Foundation
- **Sprint 2.3**: Password Security
- **Sprint 2.4**: Registration Workflow
- **Sprint 2.5**: Email OTP Verification
- **Sprint 2.6**: Phone OTP Verification
- **Sprint 2.7**: Login
- **Sprint 2.8**: Access Token
- **Sprint 2.9**: Refresh Token
- **Sprint 2.10**: Token Rotation
- **Sprint 2.11**: Logout
- **Sprint 2.12**: Forgot Password
- **Sprint 2.13**: Reset Password
- **Sprint 2.14**: Change Password
- **Sprint 2.15**: Resend OTP
- **Sprint 2.16**: Session/Device Security
- **Sprint 2.17**: Authentication Rate Limits
- **Sprint 2.18**: CSRF Protection
- **Sprint 2.19**: XSS Protection
- **Sprint 2.20**: Authentication Security Tests
- **Sprint 2.21**: Authentication Final Audit

---

## 17. Final Decision

```text
SPRINT 2.1 — ACCEPTED ✅
```
