# Security Architecture Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Security Architecture Principles

SABMS adheres to a strict **Zero Trust** security model across all network layers and application components. No implicit trust is granted to any client, session, or internal service call.

---

## 2. Zero-Trust Redaction & Logging Policy

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                       SENSITIVE DATA SANITIZATION                         │
├───────────────────────────────────────────────────────────────────────────┤
│ ❌ STRICTLY FORBIDDEN FROM LOGS & CLIENT EXPOSURE:                        │
│    • Plaintext user passwords (`password`, `currentPassword`, etc.)       │
│    • Plaintext OTP codes and raw Redis OTP hashes                         │
│    • Raw refresh token strings and cookie values                          │
│    • JWT signature secrets and private keys                               │
│    • Database credentials, SMTP passwords, and SMS API keys               │
├───────────────────────────────────────────────────────────────────────────┤
│ ✔️ REQUIRED IN STRUCTURED AUDIT LOG ENTRIES:                              │
│    • Correlation Request ID (`requestId` via X-Request-ID)                │
│    • Masked or Object ID user identifier (`userId`)                       │
│    • Client IP address and sanitized User-Agent                           │
│    • Event Type (`AUTH_LOGIN_SUCCESS`, `AUTH_OTP_SENT`, etc.)             │
│    • Timestamp (ISO 8601 UTC)                                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Token Architecture

SABMS employs a **Dual-Token Architecture** to balance stateless API throughput with immediate server-side revocation capability.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                           DUAL-TOKEN SYSTEM                               │
├─────────────────────────────────────┬─────────────────────────────────────┤
│            ACCESS TOKEN             │            REFRESH TOKEN            │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ Format: JSON Web Token (JWT)        │ Format: Opaque Random String        │
│ Entropy: Signed HMAC-SHA256         │ Entropy: 64-byte CSPRNG hex string  │
│ Lifespan: ~15 Minutes (Short-lived) │ Lifespan: ~7 Days (Long-lived)      │
│ Transmission: Authorization Header  │ Transmission: HttpOnly Secure Cookie│
│ Storage: Client In-Memory (Zustand) │ Storage: Browser Cookie Store       │
│ Purpose: Stateless API Request Auth │ Purpose: Session Token Renewal      │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

### 3.1 Single-Use Refresh Token Rotation & Theft Detection

1. **Rotation**: Every call to `POST /api/v1/auth/refresh` invalidates the submitted refresh token and generates a new access token + refresh token pair.
2. **Replay & Theft Detection**: If an already-consumed refresh token is submitted, the system flags a token theft attempt and immediately revokes the **entire token family** in MongoDB, preventing any further refresh operations.

### 3.2 Logout & Refresh-Token Family Revocation (Sprint 2.11)

1. **Cryptographic Verification**: Incoming refresh token from HttpOnly cookie is strictly verified (`signature`, `algorithm`, `issuer`, `audience`, `type: 'refresh'`, `jti`, `familyId`) before performing any persistence operations. Unverified claims (`jwt.decode()`) are never trusted for mutation.
2. **Family-Wide Revocation**: The service locates the token record by `jti` and atomically revokes all active and consumed tokens across the entire `familyId` in MongoDB (`status` transitions to `REVOKED` with reason `USER_LOGOUT`).
3. **Cookie Invalidation**: The HttpOnly refresh cookie is cleared with identical attributes (`Path=/api/v1/auth/refresh`, `SameSite=Strict`, `HttpOnly`, `Secure`).
4. **Idempotency**: Requests with missing cookies, expired tokens, or already revoked families succeed safely (`200 OK`) and clear cookies without error or information disclosure.
5. **Access-Token Boundary**: Access tokens expire naturally via their short TTL (~15m); no server-side access-token blacklist is maintained in Sprint 2.11.

---

## 4. Canonical OTP Verification Architecture

**OTP (Email and Phone)** is the canonical identity verification mechanism.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                       CANONICAL OTP SPECIFICATION                         │
├───────────────────────┬───────────────────────────────────────────────────┤
│ Format                │ 6-digit numeric string (000000 – 999999)          │
│ Generation Primitive  │ crypto.randomInt(0, 1000000).padStart(6, '0')     │
│ Lifespan (TTL)        │ 10 Minutes (600s) [Registration/Phone] / 5 Minutes (300s) [Password Reset] │
│ Email Storage Key     │ Redis ephemeral key: auth:otp:email:<email>       │
│ Phone Storage Key     │ Redis ephemeral key: auth:otp:phone:<phone>       │
│ Password Reset Key    │ Redis ephemeral key: auth:otp:reset:<email>       │
│ Cooldown Keys         │ auth:otp:cooldown:<email> / auth:otp:phone:cooldown:<phone> / auth:otp:reset:cooldown:<email> │
│ Resend / Rate Keys    │ auth:otp:resend:<email> / auth:otp:phone:resend:<phone> / auth:otp:reset:rate:<email> │
│ Stored Value          │ HMAC-SHA256 Hash (Plaintext NEVER stored)         │
│ Verification Attempts │ Maximum 5 attempts (Invalidated on 5th failure)   │
│ Resend / Rate Limit   │ Registration: Min 60s cooldown, max 5 resends; Reset: Min 60s cooldown, max 3/hr │
│ Post-Verification     │ Keys immediately deleted upon successful match    │
│ State Transition      │ Email OTP: isEmailVerified=true, status=ACTIVE    │
│                       │ Phone OTP: isPhoneVerified=true (status unchanged)│
│                       │ Reset OTP: Password reset authorization (Sprint 2.13) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Password Security Specification

### 5.1 Hashing Specification

- **Algorithm**: Argon2id (`argon2.argon2id`)
- **Memory Cost**: 65,536 KB (64 MB)
- **Time Cost**: 3 iterations
- **Parallelism**: 4 threads
- **Salt Generation**: Cryptographically secure 16-byte random salt generated per hash operation by native Argon2 bindings.

### 5.2 Password Policy

- **Length**: 8 to 128 characters
- **Complexity**: Minimum 1 uppercase (`[A-Z]`), 1 lowercase (`[a-z]`), 1 number (`[0-9]`), 1 special character (`[@$!%*?&#^~_-]`).
- **Isolation Boundary**: Hashing and verification reside exclusively in [`server/src/services/password.service.js`](file:///d:/SABMS/server/src/services/password.service.js).

### 5.3 Login Credential Verification & JWT Token Policy (Sprint 2.7, Sprint 2.8 & Sprint 2.9)

- **Constant-Time Verification**: Password verification is executed using Argon2 native bindings to protect against side-channel timing attacks.
- **Anti-Account Enumeration**: Generic `401 Unauthorized` with client message `"Invalid email or password."` is returned identically for nonexistent accounts and incorrect password candidates.
- **Account State Verification**: Authentication validates that the user account is verified (`isEmailVerified === true`) and not deactivated/suspended (`status !== 'SUSPENDED'` and `status !== 'INACTIVE'`).
- **Access Token Issuance (Sprint 2.8)**: Upon successful credential and account validation, backend issues a cryptographically signed HMAC-SHA256 JWT access token with 15-minute TTL, signed with `JWT_ACCESS_SECRET`, containing only minimal non-sensitive registered claims (`sub`, `role`, `iat`, `exp`, `iss`, `aud`).
- **Refresh Token & Cookie Issuance (Sprint 2.9)**: Backend issues a long-lived JWT refresh token with 7-day TTL signed with dedicated `JWT_REFRESH_SECRET`, containing minimal claims (`sub`, `type: 'refresh'`, `iat`, `exp`, `iss`, `aud`), delivered exclusively via an `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth/refresh` cookie (with `Secure` in production). Refresh tokens are NEVER exposed to client JavaScript or returned in JSON responses.
- **Sprint Boundaries**:
  - Access Tokens (JWT): Sprint 2.8 `[IMPLEMENTED]`.
  - Refresh Tokens & HttpOnly Cookie: Sprint 2.9 `[IMPLEMENTED]`.
  - Token Rotation & Theft Detection: Sprint 2.10 `[IMPLEMENTED]`.
  - Logout & Session Invalidation: Sprint 2.11 `[IMPLEMENTED]`.

---

## 6. Rate Limiting & Account Lockout Strategy `[IMPLEMENTED - SPRINT 2.17]`

| Target Endpoint                         | Rate Limit Policy            | Redis Key / Scope                                                 | Exceeded Behavior                                          |
| :-------------------------------------- | :--------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------- |
| **`POST /api/v1/auth/login`**           | 5 failed attempts per 15 min | `lockout:<email>`                                                 | Account locked for 15 min; returns `429 Too Many Requests` |
| **`POST /api/v1/auth/unlock`**          | ADMIN only                   | `lockout:<email>`                                                 | Clears lockout key and resets failed attempt counter       |
| **`POST /api/v1/auth/register`**        | 10 requests per hour         | `rl:reg:<ip>`                                                     | Rejects with `429 Too Many Requests`                       |
| **`POST /api/v1/auth/resend-otp`**      | 1 request per 60s; max 3/hr  | `otp:resend:<id>`                                                 | Rejects with `429 Cooldown Active`                         |
| **`POST /api/v1/auth/forgot-password`** | 1 request per 60s; max 3/hr  | `auth:otp:reset:cooldown:<email>` / `auth:otp:reset:rate:<email>` | Generic `429 Too Many Requests` (Zero Enumeration)         |
| **`POST /api/v1/auth/verify-*`**        | 5 attempts per OTP lifespan  | `otp:<type>:<id>`                                                 | Invalidation of OTP code on 5th failure                    |
| **Global Auth Endpoints**               | 100 requests per 15 min      | `rl:auth:ip:<ip>`                                                 | Global Express rate limiter throttle                       |

- **Account Lockout & Alerting (SD-13)**: Tracks failed attempts using atomic Redis counter. On 5th failure within 15 minutes, locks account, returns fast 429 response, and asynchronously dispatches a security notification email alert (`sendAccountLockoutAlert`). Successful login automatically clears the failure counter.
- **Administrative Unlock (SD-14)**: Authorized administrators can immediately restore locked accounts via `POST /api/v1/auth/unlock`, which deletes the Redis lockout key.
- **Registration Throttling**: IP-based rate limiter restricts registration floods to a maximum of 10 requests per hour per IP.

---

## 7. OWASP Top 10 Threat Mitigation Matrix

| Threat                     | Description / Attack Vector                                        | Architectural Mitigation Strategy                                                                                                                                                                                                                                                                                                                                                                           |
| :------------------------- | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential Stuffing**    | Automated testing of leaked credential pairs from other platforms. | Strict IP/email rate limiting via Redis; automatic account lockout after 5 consecutive failures with exponential backoff.                                                                                                                                                                                                                                                                                   |
| **Brute-Force Login**      | Dictionary and automated wordlist attacks against user passwords.  | Memory-hard Argon2id hashing; constant-time delay simulation on failure; IP rate limiting.                                                                                                                                                                                                                                                                                                                  |
| **OTP Brute Force**        | Guessing 6-digit verification codes (1 in 1,000,000 probability).  | Maximum 5 failed attempts per OTP key before instant invalidation; 5-minute strict TTL in Redis; minimum 60s resend cooldown.                                                                                                                                                                                                                                                                               |
| **Refresh Token Theft**    | Exfiltration of long-lived refresh tokens.                         | Transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Strict` cookies; JavaScript runtime access is impossible.                                                                                                                                                                                                                                                                                       |
| **Refresh Token Replay**   | Reusing an expired or stolen refresh token.                        | **Single-Use Rotation**: Using an already-consumed refresh token immediately triggers **Token Family Revocation**, killing all active sessions.                                                                                                                                                                                                                                                             |
| **Session Hijacking**      | Stealing session identifiers to impersonate legitimate users.      | Session binding with client IP subnet (/24) and User-Agent fingerprint validation; instant family revocation on mismatch; one-click "Logout from all devices" (`DELETE /api/v1/auth/sessions`).                                                                                                                                                                                                             |
| **JWT Access Token Theft** | Intercepting short-lived access tokens.                            | Tokens expire in ~15 minutes; sensitive PII is excluded; server maintains JTI revocation blocklist in Redis.                                                                                                                                                                                                                                                                                                |
| **CSRF Attacks**           | Cross-site forged requests to execute authenticated state changes. | `SameSite=Strict` cookie enforcement; Double-Submit Cookie Pattern with HMAC-SHA256 signed CSRF tokens (`XSRF-TOKEN` / `X-XSRF-TOKEN`); strict Origin/Referer verification; dedicated `GET /api/v1/auth/csrf-token` endpoint (Sprint 2.18).                                                                                                                                                                 |
| **XSS Attacks**            | Injected JavaScript attempting to harvest authentication tokens.   | React JSX automatic escaping; server-side recursive input sanitization middleware (`xss.middleware.js`) stripping `<script>`, inline event handlers, and `javascript:` URIs; password fields strictly excluded; strict Helmet Content-Security-Policy (CSP) headers with `base-uri 'self'`, `frame-ancestors 'none'`, and `object-src 'none'`; refresh tokens isolated in `HttpOnly` cookies (Sprint 2.19). |
| **NoSQL Injection**        | Injecting MongoDB operator objects (`$gt`, `$ne`, etc.) in inputs. | Express 5 compatible in-place NoSQL sanitization stripping `$` keys before validation.                                                                                                                                                                                                                                                                                                                      |
| **Account Enumeration**    | Determining valid emails via differing error responses or timing.  | Constant-time response simulation; generic responses on password reset (`"If an account exists, instructions have been sent"`).                                                                                                                                                                                                                                                                             |
| **Privilege Escalation**   | Manipulating role claims in JWT or request bodies.                 | Cryptographic HMAC signature verification on access tokens; RBAC permission re-validation on sensitive administrative endpoints.                                                                                                                                                                                                                                                                            |
