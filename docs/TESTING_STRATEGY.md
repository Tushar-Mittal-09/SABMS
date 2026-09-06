# Testing Strategy & Quality Assurance

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Testing Pyramid Architecture

```text
       / \
      / E2E \       <- Playwright E2E reservation & approval flows
     /-------\
    / Integration \   <- Supertest + MongoMemoryServer (HTTP API & Middleware layers)
   /---------------\
  /    Unit Tests   \  <- Jest / RTL (Services, Cryptographic Primitives, Zod Schemas)
 /-------------------\
```

---

## 2. Test Suite Classification & Coverage Goals

| Level                   | Scope                                                | Framework             | Coverage Goal     |
| :---------------------- | :--------------------------------------------------- | :-------------------- | :---------------- |
| **Unit Testing**        | Utility functions, business services, state hooks    | Jest                  | 85%+              |
| **Integration Testing** | Express API endpoints, MongoDB queries, middlewares  | Jest + Supertest      | 80%+              |
| **Frontend UI Testing** | React components, user interactions, form validation | React Testing Library | 75%+              |
| **E2E Testing**         | Complete reservation, OTP, and approval workflows    | Playwright            | Key user journeys |

---

## 3. Comprehensive Authentication Test Case Matrix

### 3.1 Registration & Credential Tests (Sprint 2.4)

- [x] `TC-AUTH-001`: Register user with valid payload returns `201 Created` with sanitized response envelope.
- [x] `TC-AUTH-002`: Register with existing email returns `409 Conflict` (`AUTH_EMAIL_ALREADY_EXISTS`).
- [x] `TC-AUTH-003`: Register with invalid password complexity returns `422 Unprocessable Entity`.
- [x] `TC-AUTH-004`: Register with malformed email or missing fields returns `422 Unprocessable Entity`.
- [x] `TC-AUTH-005`: Register with privilege escalation attempts (`role: ADMIN`, `status: ACTIVE`) rejects invalid fields.

### 3.2 OTP Verification Tests (Sprint 2.5 & Sprint 2.6 Completed)

- [x] `TC-AUTH-010`: Verify email with valid 6-digit OTP marks user `isEmailVerified: true`, `status: ACTIVE`, and returns `200 OK`.
- [x] `TC-AUTH-011`: Verify with incorrect OTP increments attempt counter and returns `400 Bad Request`.
- [x] `TC-AUTH-012`: Submitting 5 consecutive incorrect OTPs invalidates code in Redis (`AUTH_OTP_MAX_ATTEMPTS`).
- [x] `TC-AUTH-013`: Submitting an expired OTP (>10 min) returns `400 Bad Request` (`AUTH_OTP_EXPIRED`).
- [x] `TC-AUTH-014`: Resend OTP within 60s cooldown returns `429 Too Many Requests` (`AUTH_OTP_COOLDOWN_ACTIVE`).
- [x] `TC-AUTH-014b`: Resend OTP exceeding maximum limit (5) returns `429 Too Many Requests`.
- [x] `TC-AUTH-015`: Verify phone OTP with valid 6-digit code marks `isPhoneVerified: true` (Sprint 2.6).
- [x] `TC-AUTH-016`: Phone OTP resend enforces 60s cooldown and 5 maximum resends (Sprint 2.6).
- [x] `TC-AUTH-017`: Phone verification preserves existing email verification and account status (Sprint 2.6).
- [x] `TC-AUTH-018`: Generic `/resend-otp` supports email and phone verification resends with cooldown and attempt limits (`auth.general-resend.test.js`) (Sprint 2.15).

### 3.3 Login & Session Tests (Sprint 2.7, Sprint 2.8 & Sprint 2.9 Completed)

- [x] `TC-AUTH-020a`: Login with valid verified credentials returns `200 OK` with valid signed JWT Access Token (`auth.access-token.test.js`) (Sprint 2.8).
- [x] `TC-AUTH-020b`: JWT Access Token contains valid claims (`sub`, `role`, `iat`, `exp`, `iss`, `aud`) and strictly excludes sensitive fields (`auth.access-token.test.js`) (Sprint 2.8).
- [x] `TC-AUTH-020c`: Access token verification enforces HS256 algorithm, secret integrity, issuer, and audience matching (`auth.access-token.test.js`) (Sprint 2.8).
- [x] `TC-AUTH-020d`: Login issues HttpOnly refresh token cookie with Secure, SameSite, and Path scoping (`auth.refresh-token.test.js`) (Sprint 2.9).
- [x] `TC-AUTH-021`: Login with invalid password returns `401 Unauthorized` (`AUTH_INVALID_CREDENTIALS`) (Sprint 2.7).
- [x] `TC-AUTH-023`: 5 consecutive failed logins locks account for 15 minutes (`429 Too Many Requests`), fast-fails before DB lookup, and dispatches security alert email (`auth.rate-limiting.test.js`) (Sprint 2.17).
- [x] `TC-AUTH-023b`: Administrative unlock endpoint (`POST /api/v1/auth/unlock`) clears Redis lockout key and permits subsequent logins, protected by RBAC (`auth.rate-limiting.test.js`) (Sprint 2.17).
- [x] `TC-AUTH-023c`: Public registration endpoint rate limiter throttles excessive requests (max 10 requests per hour per IP) with `429 Too Many Requests` (`auth.rate-limiting.test.js`) (Sprint 2.17).
- [x] `TC-AUTH-024`: Login on unverified account returns `403 Forbidden` (`AUTH_ACCOUNT_UNVERIFIED`) (Sprint 2.7).

### 3.4 Token Lifecycle & Refresh Tests (Sprint 2.9, 2.10, 2.11)

- [x] `TC-AUTH-030a`: Call `/refresh` with valid refresh cookie returns new JWT access token (`auth.refresh-token.test.js`) (Sprint 2.9).
- [x] `TC-AUTH-030b`: Refresh token generation contains valid claims (`sub`, `jti`, `familyId`, `type: 'refresh'`, `iat`, `exp`, `iss`, `aud`) and uses separate secret (`auth.refresh-token.test.js`) (Sprint 2.9 & 2.10).
- [x] `TC-AUTH-031`: Call `/refresh` with missing, expired, malformed, or tampered cookie returns `401 Unauthorized` (`auth.refresh-token.test.js`) (Sprint 2.9 & 2.10).
- [x] `TC-AUTH-032a`: Single-Use Token Rotation: Valid refresh atomically marks old token CONSUMED, issues and sets new ACTIVE replacement token in same family, and delivers new HttpOnly cookie (`auth.refresh-token-rotation.test.js`) (Sprint 2.10).
- [x] `TC-AUTH-032b`: Replay & Reuse Detection: Presenting an already-consumed or reused refresh token triggers reuse detection, revokes the entire token family, clears the client refresh cookie, and returns `401 Unauthorized` (`auth.refresh-token-rotation.test.js`) (Sprint 2.10).
- [x] `TC-AUTH-032c`: Multi-step rotation chains (R1 -> R2 -> R3) maintain atomic lineage and invalidate previous ancestors (`auth.refresh-token-rotation.test.js`) (Sprint 2.10).
- [x] `TC-AUTH-032d`: Concurrent refresh race protection guarantees at most one successful rotation with subsequent replay detection (`auth.refresh-token-rotation.test.js`) (Sprint 2.10).
- [x] `TC-AUTH-033a`: Call `POST /api/v1/auth/logout` with valid refresh cookie cryptographically verifies token, revokes entire token family (`ACTIVE` and `CONSUMED` tokens become `REVOKED` with `USER_LOGOUT` reason), clears HttpOnly cookie, and returns `200 OK` standard envelope (`auth.logout.test.js`) (Sprint 2.11).
- [x] `TC-AUTH-033b`: Logout is idempotent: missing, expired, or already-revoked tokens return `200 OK` and clear client cookies without error or unverified DB mutation (`auth.logout.test.js`) (Sprint 2.11).
- [x] `TC-AUTH-033c`: Post-logout token refresh rejection: subsequent `/refresh` calls with logged-out or sibling family tokens fail with `401 Unauthorized` (`auth.logout.test.js`) (Sprint 2.11).
- [x] `TC-AUTH-033d`: Security & privacy invariants: unverified JWT claims cannot trigger family revocation, no tokens/secrets/passwords leak in responses or logs, user account attributes remain untouched (`auth.logout.test.js`) (Sprint 2.11).

### 3.5 Password Recovery & Security Tests (Sprint 2.12, 2.13, 2.14)

- [x] `TC-AUTH-040`: `/forgot-password` with valid email dispatches reset OTP and returns `200 OK` (`auth.forgot-password.test.js`) (Sprint 2.12).
- [x] `TC-AUTH-041`: `/forgot-password` with non-existent email returns `200 OK` (prevents account enumeration) (`auth.forgot-password.test.js`) (Sprint 2.12).
- [x] `TC-AUTH-042`: `/reset-password` with valid OTP updates password and terminates all concurrent sessions (`auth.reset-password.test.js`) (Sprint 2.13).
- [x] `TC-AUTH-043`: `/change-password` with valid current password updates password hash and preserves current session (`auth.change-password.test.js`) (Sprint 2.14).

### 3.6 Guard Middleware Tests (Sprint 2.8)

- [ ] `TC-AUTH-050`: Access protected endpoint with valid JWT returns `200 OK` with populated `req.user`.
- [ ] `TC-AUTH-051`: Access protected endpoint with expired JWT returns `401 Unauthorized` (`AUTH_TOKEN_EXPIRED`).
- [ ] `TC-AUTH-052`: Access protected endpoint with missing token returns `401 Unauthorized` (`AUTH_TOKEN_MISSING`).
- [ ] `TC-AUTH-053`: Access admin endpoint with STUDENT role returns `403 Forbidden` (`AUTH_FORBIDDEN_ROLE`).

### 3.7 Session Security & Device Fingerprinting Tests (Sprint 2.16)

- [x] `TC-AUTH-060`: Extract /24 IPv4 and /64 IPv6 subnets; normalize localhost (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-061`: Generate deterministic, privacy-preserving SHA-256 device fingerprint bound to subnet and User-Agent (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-062`: Persist session metadata (`ipAddress`, `userAgent`, `deviceHash`, `lastActivityAt`) in `RefreshToken` collection and Redis cache (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-063`: Mitigate session hijacking: refresh token rotation succeeds across same subnet; fails with 401 and revokes family upon device mismatch (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-064`: `GET /api/v1/auth/sessions` lists active concurrent sessions with `isCurrent` determination (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-065`: `DELETE /api/v1/auth/sessions/:sessionId` revokes specific session and clears cookie if current (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-066`: `DELETE /api/v1/auth/sessions` revokes all other concurrent sessions for authenticated user (`auth.session-security.test.js`) (Sprint 2.16).
- [x] `TC-AUTH-067`: SD-15 session validation verifies active session state and device fingerprint (`auth.session-security.test.js`) (Sprint 2.16).

### 3.8 CSRF Protection & Origin Verification Tests (Sprint 2.18)

- [x] `TC-AUTH-070`: Cryptographic token generation generates `<randomHex>.<hmacSignature>` signed with `COOKIE_SECRET` (`auth.csrf.test.js`) (Sprint 2.18).
- [x] `TC-AUTH-071`: `GET /api/v1/auth/csrf-token` delivers token in body and sets `XSRF-TOKEN` cookie with `SameSite=Strict` and `httpOnly: false` (`auth.csrf.test.js`) (Sprint 2.18).
- [x] `TC-AUTH-072`: State-mutating requests (`POST`, `PUT`, `DELETE`) with matching `XSRF-TOKEN` cookie and `X-XSRF-TOKEN` / `X-CSRF-Token` header succeed (`auth.csrf.test.js`) (Sprint 2.18).
- [x] `TC-AUTH-073`: State-mutating requests with missing, mismatched, or forged CSRF headers return `403 Forbidden` (`auth.csrf.test.js`) (Sprint 2.18).
- [x] `TC-AUTH-074`: State-mutating cross-origin requests with untrusted `Origin` / `Referer` return `403 Forbidden` (`auth.csrf.test.js`) (Sprint 2.18).

### 3.9 Cross-Site Scripting (XSS) Protection Tests (Sprint 2.19)

- [x] `TC-AUTH-080`: `sanitizeXssString` strips `<script>` tags, inline DOM event handlers (`onerror=`, `onload=`), and `javascript:` URIs (`auth.xss.test.js`) (Sprint 2.19).
- [x] `TC-AUTH-081`: `sanitizeXssObject` recursively sanitizes nested objects and arrays while strictly preserving passwords and tokens (`auth.xss.test.js`) (Sprint 2.19).
- [x] `TC-AUTH-082`: Helmet enforces enterprise Content-Security-Policy with `base-uri 'self'`, `frame-ancestors 'none'`, and `object-src 'none'` (`auth.xss.test.js`) (Sprint 2.19).
- [x] `TC-AUTH-083`: `xssSanitizer` middleware sanitizes `req.body`, `req.query`, and `req.params` in-place while leaving password fields untouched (`auth.xss.test.js`) (Sprint 2.19).

### 3.10 Final Security Hardening & Information Disclosure Tests (Sprint 2.20)

- [x] `TC-AUTH-090`: Disallowed HTTP methods (`TRACE`, `TRACK`) are rejected with `405 Method Not Allowed` and `Allow` header (`auth.hardening.test.js`) (Sprint 2.20).
- [x] `TC-AUTH-091`: Authentication routes enforce anti-caching headers (`Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache`, `Expires: 0`) (`auth.hardening.test.js`) (Sprint 2.20).
- [x] `TC-AUTH-092`: Information disclosure headers (`X-Powered-By`, `Server`) are stripped from HTTP responses (`auth.hardening.test.js`) (Sprint 2.20).
- [x] `TC-AUTH-093`: Response MIME sniffing prevention (`X-Content-Type-Options: nosniff`) and clickjacking defense (`X-Frame-Options: DENY`) verified across endpoints (`auth.hardening.test.js`) (Sprint 2.20).

---

## 4. Continuous Integration Quality Gates

1. **Pre-commit Hooks**: Enforces ESLint linting and Prettier formatting checks on all staged files via `lint-staged`.
2. **Pull Request Validation**: Automated Jest test runs require 100% test pass rate across all suites.
3. **Coverage Thresholds**: Mandatory 80% code coverage threshold on business services and controllers before merging.
