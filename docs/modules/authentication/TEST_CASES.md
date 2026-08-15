# Authentication Test Suite Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Authentication Testing Strategy

Sprint 2 authentication testing adheres to a multi-tiered validation approach:

1. **Unit Tests**: Test cryptographic primitives, isolated services, repositories, and Zod schemas with mocked database/cache dependencies.
2. **Integration Tests**: Execute Supertest HTTP requests across Express routes, controllers, and services against in-memory MongoDB (`mongodb-memory-server`) and mock Redis.
3. **Security Test Cases**: Verify token rotation theft detection, OTP rate limits, lockout thresholds, and error response sanitization.

---

## 2. Authentication Test Case Matrix

### 2.1 Registration & Credential Tests (Sprint 2.4)

- [ ] `TC-AUTH-001`: Register user with valid payload returns `201 Created` and dispatches OTP.
- [ ] `TC-AUTH-002`: Register with existing email returns `409 Conflict` (`AUTH_EMAIL_ALREADY_EXISTS`).
- [ ] `TC-AUTH-003`: Register with invalid password complexity returns `422 Unprocessable Entity`.
- [ ] `TC-AUTH-004`: Register with malformed email or missing fields returns `422 Unprocessable Entity`.

### 2.2 OTP Verification Tests (Sprint 2.5, 2.6, 2.15)

- [ ] `TC-AUTH-010`: Verify email with valid 6-digit OTP marks user `isEmailVerified: true` and returns `200 OK`.
- [ ] `TC-AUTH-011`: Verify with incorrect OTP increments attempt counter and returns `400 Bad Request`.
- [ ] `TC-AUTH-012`: Submitting 5 consecutive incorrect OTPs invalidates code (`AUTH_OTP_MAX_ATTEMPTS`).
- [ ] `TC-AUTH-013`: Submitting an expired OTP (>5 min) returns `400 Bad Request` (`AUTH_OTP_EXPIRED`).
- [ ] `TC-AUTH-014`: Resend OTP within 60s cooldown returns `429 Too Many Requests` (`AUTH_OTP_COOLDOWN_ACTIVE`).
- [ ] `TC-AUTH-015`: Verify phone OTP with valid 6-digit code marks `isPhoneVerified: true`.

### 2.3 Login & Session Tests (Sprint 2.7, 2.8, 2.9)

- [ ] `TC-AUTH-020`: Login with valid verified credentials returns `200 OK`, JWT in body, and `HttpOnly` refresh cookie.
- [ ] `TC-AUTH-021`: Login with invalid password returns `401 Unauthorized` (`AUTH_INVALID_CREDENTIALS`).
- [ ] `TC-AUTH-022`: Login with non-existent email returns `401 Unauthorized` (timing-safe).
- [ ] `TC-AUTH-023`: 5 consecutive failed logins locks account for 15 minutes (`429 Too Many Requests`).
- [ ] `TC-AUTH-024`: Login on unverified account returns `403 Forbidden` (`AUTH_ACCOUNT_UNVERIFIED`).

### 2.4 Token Lifecycle & Rotation Tests (Sprint 2.9, 2.10, 2.11)

- [ ] `TC-AUTH-030`: Call `/refresh` with valid refresh cookie returns new JWT access token and rotated refresh cookie.
- [ ] `TC-AUTH-031`: Call `/refresh` with revoked/invalid cookie returns `401 Unauthorized`.
- [ ] `TC-AUTH-032`: **Theft Detection Test**: Presenting an already-consumed refresh token invalidates all user sessions.
- [ ] `TC-AUTH-033`: Call `/logout` clears refresh cookie and adds active access token JTI to Redis blocklist.

### 2.5 Password Recovery & Security Tests (Sprint 2.12, 2.13, 2.14)

- [ ] `TC-AUTH-040`: `/forgot-password` with valid email dispatches reset OTP and returns `200 OK`.
- [ ] `TC-AUTH-041`: `/forgot-password` with non-existent email returns `200 OK` (prevents account enumeration).
- [ ] `TC-AUTH-042`: `/reset-password` with valid OTP updates password and terminates all concurrent sessions.
- [ ] `TC-AUTH-043`: `/change-password` with valid current password updates password hash and preserves current session.

### 2.6 Guard Middleware Tests (Sprint 2.8)

- [ ] `TC-AUTH-050`: Access protected endpoint with valid JWT returns `200 OK` with populated `req.user`.
- [ ] `TC-AUTH-051`: Access protected endpoint with expired JWT returns `401 Unauthorized` (`AUTH_TOKEN_EXPIRED`).
- [ ] `TC-AUTH-052`: Access protected endpoint with missing token returns `401 Unauthorized` (`AUTH_TOKEN_MISSING`).
- [ ] `TC-AUTH-053`: Access admin endpoint with STUDENT role returns `403 Forbidden` (`AUTH_FORBIDDEN_ROLE`).
