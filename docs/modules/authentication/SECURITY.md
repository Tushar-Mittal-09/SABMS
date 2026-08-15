# Authentication Threat Model & Security Architecture

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Threat Model & Architectural Mitigations

| Threat                          | Description / Attack Vector                                        | Architectural Mitigation Strategy                                                                                                               |
| :------------------------------ | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential Stuffing**         | Automated testing of leaked credential pairs from other platforms. | Strict IP/email rate limiting via Redis; automatic account lockout after 5 consecutive failures with exponential backoff.                       |
| **Brute-Force Login**           | Dictionary and automated wordlist attacks against user passwords.  | Password hashing with memory-hard Argon2/bcrypt; minimum delay simulation on failure; IP rate limiting (`100 req / 15 min`).                    |
| **OTP Brute Force**             | Guessing 6-digit verification codes (1 in 1,000,000 probability).  | Maximum 5 failed attempts per OTP key before instant invalidation; 5-minute strict TTL in Redis; minimum 60s resend cooldown.                   |
| **OTP Replay**                  | Reusing a previously valid OTP code.                               | One-time atomic read-and-delete transaction in Redis upon first successful match; strict 5-minute expiry.                                       |
| **OTP Leakage**                 | Eavesdropping on OTP codes in transit or memory.                   | Plaintext OTP is **never** written to MongoDB or persistent logs; stored as a cryptographic SHA-256/HMAC hash in Redis.                         |
| **Refresh Token Theft**         | Exfiltration of long-lived refresh tokens.                         | Transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Strict` cookies; JavaScript runtime access is impossible.                           |
| **Refresh Token Replay**        | Reusing an expired or stolen refresh token.                        | **Single-Use Rotation**: Using an already-consumed refresh token immediately triggers **Token Family Revocation**, killing all active sessions. |
| **Session Hijacking**           | Stealing session identifiers to impersonate legitimate users.      | Session binding with client IP subnet and User-Agent fingerprint validation; easy one-click "Logout from all devices".                          |
| **JWT Access Token Theft**      | Intercepting short-lived access tokens.                            | Tokens expire in ~15 minutes; sensitive PII is excluded; server maintains JTI revocation blocklist in Redis for emergency kill-switch.          |
| **CSRF Attacks**                | Cross-site forged requests to execute authenticated state changes. | `SameSite=Strict` cookie enforcement; custom header verification (`X-Request-ID` and `Authorization` headers required on state-changing APIs).  |
| **XSS Attacks**                 | Injected JavaScript attempting to harvest authentication tokens.   | React auto-escaping; strict Content-Security-Policy (CSP) headers via Helmet; refresh tokens isolated in `HttpOnly` cookies.                    |
| **Account Enumeration**         | Determining valid emails via differing error responses or timing.  | Constant-time response simulation; generic responses on password reset (`"If an account exists, instructions have been sent"`).                 |
| **Password Reset Abuse**        | Flooding email inboxes with reset requests.                        | Global IP and email throttling on `/forgot-password` (max 3 requests per hour per target).                                                      |
| **Secret / Credential Leakage** | Leaking DB URIs, JWT keys, or SMTP passwords into VCS or logs.     | Centralized Zod env validation at startup; `.env` excluded in `.gitignore`; Winston transport redaction filters.                                |
| **Privilege Escalation**        | Manipulating role claims in JWT or request bodies.                 | Cryptographic HMAC signature verification on access tokens; RBAC permission re-validation on sensitive administrative endpoints.                |

---

## 2. Zero-Trust Redaction & Logging Policy

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                       SENSITIVE DATA SANITIZATION                         │
├───────────────────────────────────────────────────────────────────────────┤
│ ❌ STRICTLY FORBIDDEN FROM LOGGING:                                       │
│    • `req.body.password`, `req.body.currentPassword`, `newPassword`       │
│    • `req.body.otp`, Redis OTP hash values                                │
│    • `req.cookies.refreshToken`, raw opaque token values                  │
│    • `req.headers.authorization`, JWT signature secrets                   │
│    • Database credentials, SMTP passwords, SMS API keys                   │
├───────────────────────────────────────────────────────────────────────────┤
│ ✔️ REQUIRED IN STRUCTURED LOG ENTRIES:                                    │
│    • `requestId`: Correlation UUID                                        │
│    • `userId`: Masked or Object ID (when user is identified)              │
│    • `clientIp`: Remote IP address (anonymized in production if required)│
│    • `userAgent`: Client platform / browser string                        │
│    • `event`: Action identifier (`LOGIN_FAIL`, `OTP_VERIFIED`, etc.)       │
│    • `timestamp`: ISO 8601 UTC timestamp                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Rate Limiting Architecture

| Target Endpoint                    | Rate Limit Policy            | Redis Key / Scope | Exceeded Behavior                                          |
| :--------------------------------- | :--------------------------- | :---------------- | :--------------------------------------------------------- |
| **`POST /api/v1/auth/login`**      | 5 failed attempts per 15 min | `lockout:<email>` | Account locked for 15 min; returns `429 Too Many Requests` |
| **`POST /api/v1/auth/register`**   | 10 requests per hour         | `rl:reg:<ip>`     | Rejects with `429 Too Many Requests`                       |
| **`POST /api/v1/auth/resend-otp`** | 1 request per 60s; max 3/hr  | `otp:resend:<id>` | Rejects with `429 Cooldown Active`                         |
| **`POST /api/v1/auth/verify-*`**   | 5 attempts per OTP lifespan  | `otp:<type>:<id>` | Invalidation of OTP code on 5th failure                    |
| **Global Auth Endpoints**          | 100 requests per 15 min      | `rl:auth:ip:<ip>` | Global Express rate limiter throttle                       |

---

## 4. Password Security Implementation (Sprint 2.3)

### 4.1 Hashing Specification

- **Algorithm**: Argon2id (`argon2.argon2id`)
- **Memory Cost**: 65,536 KB (64 MB)
- **Time Cost**: 3 iterations
- **Parallelism**: 4 threads
- **Salt Generation**: Cryptographically secure 16-byte random salt generated per hash operation by Argon2 native bindings.

### 4.2 Password Policy

- **Minimum Length**: 8 characters
- **Maximum Length**: 128 characters
- **Complexity Requirements**:
  - At least 1 uppercase letter (`[A-Z]`)
  - At least 1 lowercase letter (`[a-z]`)
  - At least 1 numeric digit (`[0-9]`)
  - At least 1 special character (`[@$!%*?&#^~_-]`)
- **Immutability Guarantee**: Passwords are never silently trimmed or altered.

### 4.3 Architecture & Isolation Boundary

- Hashing and verification reside exclusively in `server/src/modules/auth/security/password.security.js`.
- No pre-save hooks in Mongoose `User.model.js`.
- No password hashing in `User.repository.js`.
- `passwordHash` is protected by `select: false` in Mongoose and stripped in `toJSON`/`toObject` transforms.
