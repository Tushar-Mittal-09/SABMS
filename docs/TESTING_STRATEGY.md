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

### 3.3 Login & Session Tests (Sprint 2.7 & Sprint 2.8 Completed)

- [x] `TC-AUTH-020a`: Login with valid verified credentials returns `200 OK` with valid signed JWT Access Token (`auth.access-token.test.js`) (Sprint 2.8).
- [x] `TC-AUTH-020b`: JWT Access Token contains valid claims (`sub`, `role`, `iat`, `exp`, `iss`, `aud`) and strictly excludes sensitive fields (`auth.access-token.test.js`) (Sprint 2.8).
- [x] `TC-AUTH-020c`: Access token verification enforces HS256 algorithm, secret integrity, issuer, and audience matching (`auth.access-token.test.js`) (Sprint 2.8).
- [ ] `TC-AUTH-020d`: Login issues HttpOnly refresh token cookie (Sprint 2.9).
- [x] `TC-AUTH-021`: Login with invalid password returns `401 Unauthorized` (`AUTH_INVALID_CREDENTIALS`) (Sprint 2.7).
- [x] `TC-AUTH-022`: Login with non-existent email returns `401 Unauthorized` (timing-safe & anti-enumeration) (Sprint 2.7).
- [ ] `TC-AUTH-023`: 5 consecutive failed logins locks account for 15 minutes (`429 Too Many Requests`) (Sprint 2.17).
- [x] `TC-AUTH-024`: Login on unverified account returns `403 Forbidden` (`AUTH_ACCOUNT_UNVERIFIED`) (Sprint 2.7).

### 3.4 Token Lifecycle & Single-Use Rotation Tests (Sprint 2.9, 2.10, 2.11)

- [ ] `TC-AUTH-030`: Call `/refresh` with valid refresh cookie returns new JWT access token and rotated refresh cookie.
- [ ] `TC-AUTH-031`: Call `/refresh` with revoked/invalid cookie returns `401 Unauthorized`.
- [ ] `TC-AUTH-032`: **Theft Detection Test**: Presenting an already-consumed refresh token invalidates all user sessions.
- [ ] `TC-AUTH-033`: Call `/logout` clears refresh cookie and adds active access token JTI to Redis blocklist.

### 3.5 Password Recovery & Security Tests (Sprint 2.12, 2.13, 2.14)

- [ ] `TC-AUTH-040`: `/forgot-password` with valid email dispatches reset OTP and returns `200 OK`.
- [ ] `TC-AUTH-041`: `/forgot-password` with non-existent email returns `200 OK` (prevents account enumeration).
- [ ] `TC-AUTH-042`: `/reset-password` with valid OTP updates password and terminates all concurrent sessions.
- [ ] `TC-AUTH-043`: `/change-password` with valid current password updates password hash and preserves current session.

### 3.6 Guard Middleware Tests (Sprint 2.8)

- [ ] `TC-AUTH-050`: Access protected endpoint with valid JWT returns `200 OK` with populated `req.user`.
- [ ] `TC-AUTH-051`: Access protected endpoint with expired JWT returns `401 Unauthorized` (`AUTH_TOKEN_EXPIRED`).
- [ ] `TC-AUTH-052`: Access protected endpoint with missing token returns `401 Unauthorized` (`AUTH_TOKEN_MISSING`).
- [ ] `TC-AUTH-053`: Access admin endpoint with STUDENT role returns `403 Forbidden` (`AUTH_FORBIDDEN_ROLE`).

---

## 4. Continuous Integration Quality Gates

1. **Pre-commit Hooks**: Enforces ESLint linting and Prettier formatting checks on all staged files via `lint-staged`.
2. **Pull Request Validation**: Automated Jest test runs require 100% test pass rate across all suites.
3. **Coverage Thresholds**: Mandatory 80% code coverage threshold on business services and controllers before merging.
