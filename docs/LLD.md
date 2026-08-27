# Low-Level Design (LLD)

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Internal Module Architecture

Every module inside `server/src/modules/<module_name>/` follows the clean **Feature/Module Based Architecture** with flat files:

```text
server/src/
├── app/
│   ├── app.js               # Express application initialization & middleware stack
│   ├── routes.js            # Route discovery, API versioning & system routes
│   └── server.js            # HTTP server lifecycle, database connection & graceful shutdown
├── config/
│   ├── database.js          # MongoDB connection & connection state polling
│   └── env.config.js        # Zod environment variable validation & configuration
├── core/
│   ├── errors/              # AppError class hierarchy & error factories
│   ├── logger/              # Winston structured logging & daily log rotation
│   ├── middleware/          # Security, request ID, error handler & validation middleware
│   └── response/            # Standardized ApiResponse envelope handler
├── modules/
│   ├── auth/                # Authentication module (Flat 8-file layout)
│   │   ├── auth.constants.js
│   │   ├── auth.controller.js
│   │   ├── auth.helper.js
│   │   ├── auth.repository.js
│   │   ├── auth.response.js
│   │   ├── auth.routes.js
│   │   ├── auth.schema.js
│   │   └── auth.service.js
│   └── users/               # Users module (Flat layout)
│       ├── user.model.js
│       ├── user.repository.js
│       ├── user.routes.js
│       └── user.schema.js
├── services/
│   ├── email.service.js     # Nodemailer SMTP email verification dispatch
│   ├── password.service.js  # Argon2id password hashing & policy verification
│   └── sms.service.js       # SMS verification transport & provider adapter
└── shared/
    ├── constants/           # User roles, account statuses, password policies, API versions
    ├── utils/               # catchAsync & common utilities
    └── validators/          # Reusable Zod schemas, request/response validation & formatters
```

---

## 2. Layer Responsibility Boundaries

```mermaid
graph TD
    Client[Client Request] --> Route[Express Route]
    Route --> Val[Zod Request Validation]
    Val --> Guard[Auth / Role Guard Middleware]
    Guard --> Ctrl[Module Controller]
    Ctrl --> Svc[Domain Service]

    Svc --> Sec[Security & Cryptographic Services]
    Svc --> Repo[Module Repository]
    Svc --> Redis[(Redis Transient Store)]
    Svc --> Notify[Notification Services]

    Repo --> Mongo[(MongoDB Persistent Cluster)]
    Sec --> Crypto[Node.js Crypto / Argon2id]
    Notify --> Email[SMTP Email Transport]
    Notify --> SMS[SMS Gateway Transport]
```

### 2.1 Layer Responsibilities

- **Routes (`*.routes.js`)**: Defines HTTP methods, URL paths, and binds validation/guard middlewares. No business logic or database queries.
- **Controllers (`*.controller.js`)**: Parses HTTP requests, extracts parameters/cookies/headers, invokes services, and sends standardized JSON responses using `res.success()`, `res.created()`, etc.
- **Services (`*.service.js`)**: Implements pure business logic, transactional orchestration, Redis state manipulation, and notification dispatch. Does not access Express `req`/`res`.
- **Repositories (`*.repository.js`)**: Encapsulates database queries (Mongoose models), data access methods, and transaction boundaries.
- **Models (`*.model.js`)**: Mongoose schema definitions, field types, indexes, and document transformations.
- **Schemas (`*.schema.js`)**: Strict Zod validation schemas for request bodies, query strings, and route parameters.
- **Responses (`*.response.js`)**: DTO transformers ensuring zero sensitive field leakage (e.g., stripping `password`, `passwordHash`, `__v`).

---

## 3. Standardized Request & Error Lifecycle

### 3.1 Synchronous Request Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Route as Express Route
    participant Val as Zod Validation Middleware
    participant Guard as Auth Guard Middleware
    participant Ctrl as Controller
    participant Svc as Service
    participant Repo as Repository
    participant DB as MongoDB

    Client->>Route: HTTP Request (e.g., POST /api/v1/auth/register)
    Route->>Val: Validate Request (body / query / params)
    alt Validation Fails
        Val-->>Client: 422 Unprocessable Entity
    end
    Val->>Guard: (Optional role / permission checks)
    Guard->>Ctrl: Forward sanitized payload
    Ctrl->>Svc: Invoke domain service method
    Svc->>Repo: Execute persistence operations
    Repo->>DB: Query / Insert / Update document
    DB-->>Repo: Return Mongoose document
    Repo-->>Svc: Return domain entity
    Svc-->>Ctrl: Return serialized DTO
    Ctrl-->>Client: Standardized JSON Envelope (200 / 201)
```

### 3.2 Error Pipeline

```text
Domain / Infrastructure / Validation Exception
  ↓
Thrown AppError (or normalized via errorHandler.middleware.js)
  ↓
catchAsync Wrapper catches and forwards to next(err)
  ↓
Global Error Handler Middleware (server/src/core/middleware/errorHandler.middleware.js)
  ↓
Structured Winston Error Log (with requestId, timestamp, statusCode, stack)
  ↓
Sanitized JSON Response to Client (No stack traces in production)
```

---

## 4. Global Error Handling Contract (`AppError`)

All application errors extend the centralized `AppError` class:

```javascript
class AppError extends Error {
  constructor(message, statusCode, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg, errors) {
    return new AppError(msg, 400, true, errors);
  }
  static unauthorized(msg) {
    return new AppError(msg, 401);
  }
  static forbidden(msg) {
    return new AppError(msg, 403);
  }
  static notFound(msg) {
    return new AppError(msg, 404);
  }
  static conflict(msg) {
    return new AppError(msg, 409);
  }
  static unprocessable(msg, errors) {
    return new AppError(msg, 422, true, errors);
  }
  static tooManyRequests(msg) {
    return new AppError(msg, 429);
  }
  static internal(msg) {
    return new AppError(msg, 500, false);
  }
}
```

---

## 5. Authentication Sequence Diagram Mapping (SD-01 to SD-17)

### SD-01: User Registration & Email OTP Verification

- **Purpose**: New user account creation with default `STUDENT` role and `PENDING` status, followed by secure Email OTP verification.
- **Implementation Note**: The SD-01 conceptual registration flow is implemented using the **Sprint 2.5 Email OTP mechanism** rather than persistent MongoDB verification tokens. OTPs are 6-digit numeric strings with strict 10-minute (600s) TTL stored as HMAC-SHA256 hashes exclusively in Redis.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `password.service.js`, `email.service.js`, `auth.repository.js`, `user.repository.js`, `user.model.js`, `Redis`.
- **Workflow**:
  1. Registration: Validates input fields via strict Zod schema → Normalizes email address → Performs duplicate check → Hashes password using Argon2id (`password.service.js`) → Persists user with `role: STUDENT`, `status: PENDING`, `isEmailVerified: false`, `isPhoneVerified: false` via `userRepository.create()` → Returns sanitized HTTP 201 response.
  2. OTP Generation: Generates cryptographically secure 6-digit OTP → Computes HMAC-SHA256 hash → Stores in Redis with 10-minute TTL (`auth:otp:email:<email>`) → Sends verification email via `email.service.js`.
  3. Verification: User submits OTP to `POST /api/v1/auth/verify-email` → Verifies OTP against Redis hash via constant-time comparison → Transitions MongoDB User to `isEmailVerified: true` and `status: ACTIVE` → Deletes Redis OTP key immediately to prevent replay attacks → Returns sanitized HTTP 200 response.
- **Sprint Tasks**: Sprint 2.4 (Registration) & Sprint 2.5 (Email OTP Verification).

### SD-03: User Login & JWT Access Token Issuance

- **Purpose**: Authenticate user credentials securely, enforce verification and active status invariants, update login activity timestamp, and issue a short-lived JWT Access Token.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `auth.helper.js`, `password.service.js`, `auth.repository.js`, `user.model.js`.
- **Workflow**:
  1. Validates input schema via strict Zod `loginSchema` (email normalized, password unmutated).
  2. Queries user record including `passwordHash` via `authRepository.findByEmailWithPasswordHash()`.
  3. Verifies credentials against Argon2id hash using constant-time comparison (`password.service.js`).
  4. Returns generic `401 Unauthorized` for both missing user and wrong password to prevent account enumeration.
  5. Enforces account state constraints: rejects `SUSPENDED`/`INACTIVE` accounts with `403 Forbidden` (`AUTH_ACCOUNT_DISABLED`), and unverified accounts with `403 Forbidden` (`AUTH_ACCOUNT_UNVERIFIED`).
  6. Updates `lastLoginAt` in MongoDB via `authRepository.updateLastLogin()`.
  7. Generates cryptographically signed short-lived JWT Access Token via `generateAccessToken()` in `auth.helper.js` (HMAC-SHA256, contains `sub`, `role`, `iat`, `exp`, `iss`, `aud`).
  8. Formats and returns safe domain user entity and token metadata (`formatLoginResponse`).
  9. **Sprint Boundaries**:
     - JWT Access Token: Sprint 2.8 `[IMPLEMENTED]`.
     - Refresh Tokens & HttpOnly Cookie: Sprint 2.9 `[IMPLEMENTED]`.
     - Token Rotation & Reuse Detection: Sprint 2.10 `[NOT IMPLEMENTED / FUTURE SPRINT]`.
     - Logout & Revocation: Sprint 2.11 `[NOT IMPLEMENTED / FUTURE SPRINT]`.
- **Sprint Tasks**: Sprint 2.7 (Login), Sprint 2.8 (JWT Access Token), & Sprint 2.9 (Refresh Token & Cookie Issuance).

### SD-04: Forgot Password

- **Purpose**: Initiate password recovery workflow without leaking user existence.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `auth.repository.js`, `Redis`, `Email Service`.
- **Workflow**: Validates email → Queries user (generic response prevents enumeration) → Generates 6-digit reset OTP → Stores hashed OTP in Redis with rate limit counter → Sends OTP via email.
- **Sprint Task**: Sprint 2.12 (Forgot Password).

### SD-05: Reset Password

- **Purpose**: Finalize password update using verified reset OTP.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `password.service.js`, `auth.repository.js`, `user.model.js`, `Redis`, `Email Service`.
- **Workflow**: Validates new password & OTP → Verifies OTP against Redis hash → Hashes new password → Updates User record in MongoDB → Triggers **Global Session Revocation** in Redis → Sends confirmation email.
- **Sprint Task**: Sprint 2.13 (Reset Password).

### SD-06: User Logout

- **Purpose**: Terminate current client session and invalidate credentials.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `Redis`.
- **Workflow**: Extracts session context → Deletes session & refresh token family keys from Redis → Adds access token JTI to Redis blocklist → Clears client `HttpOnly` refresh cookie.
- **Sprint Task**: Sprint 2.11 (Logout).

### SD-07: Refresh Access Token

- **Purpose**: Issue new Access Token using valid Refresh Cookie.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `auth.helper.js`, `auth.repository.js`.
- **Workflow (Sprint 2.9)**: Reads `refreshToken` cookie → Verifies signature against `JWT_REFRESH_SECRET`, algorithm, issuer, audience, and type (`refresh`) → Loads User from MongoDB → Validates account eligibility (active & verified) → Generates and returns a fresh JWT Access Token in JSON response (`formatLoginResponse`).
- **Sprint Boundaries**:
  - **Refresh Token Validation & Access Token Issuance**: Sprint 2.9 `[IMPLEMENTED]`.
  - **Single-Use Token Rotation & Reuse Detection**: Sprint 2.10 `[NOT IMPLEMENTED / FUTURE SPRINT]`. Refresh token is NOT rotated in Sprint 2.9.
- **Sprint Task**: Sprint 2.9 & 2.10 (Refresh Token & Single-Use Rotation).

### SD-08: Change Password

- **Purpose**: Authenticated user updates account password.
- **Components**: `auth.routes.js`, `auth.middleware.js`, `auth.controller.js`, `auth.service.js`, `password.service.js`, `auth.repository.js`, `Redis`, `Email Service`.
- **Workflow**: Verifies active JWT session → Verifies current password against stored hash → Hashes new password → Updates MongoDB → Revokes other active sessions in Redis (or refreshes current) → Dispatches security notification email.
- **Sprint Task**: Sprint 2.14 (Change Password).

### SD-09: Resend Verification OTP

- **Purpose**: Re-issue verification OTP when previous code expires.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `Redis`, `Email/SMS Service`.
- **Workflow**: Validates identifier → Checks resend cooldown in Redis (60s minimum interval, max 3/hr) → Generates new 6-digit OTP → Overwrites Redis key with refreshed 5 min TTL → Dispatches new OTP.
- **Sprint Task**: Sprint 2.15 (Resend OTP).

### SD-10: Verify Email with Token `[OPTIONAL / LEGACY REFERENCE]`

- **Purpose**: Legacy token-based link verification.
- **Status**: Optional / Legacy reference architecture.

### SD-11: JWT Authentication Middleware

- **Purpose**: Protect API routes by verifying access tokens and injecting user context.
- **Components**: `auth.middleware.js`, `Redis`, `user.repository.js`, `user.model.js`.
- **Workflow**: Extracts `Bearer <token>` from `Authorization` header → Verifies JWT signature & expiration → Checks Redis JTI blocklist → Validates user status in cache/DB → Attaches `{ id, role, sessionId }` to `req.user` → Calls `next()`.
- **Sprint Task**: Sprint 2.8 (Auth Middleware).

### SD-12: Session Expiration & Automatic Refresh

- **Purpose**: Client transparently refreshes expired access token without user disruption.
- **Components**: Frontend Axios Interceptor, `auth.routes.js`, `auth.service.js`, `Redis`.
- **Workflow**: Client receives 401 on expired access token → Interceptor pauses requests → Calls `POST /api/v1/auth/refresh` → Receives new access token → Retries original failed request.
- **Sprint Task**: Sprint 2.9 & 2.16 (Refresh & Session Lifecycle).

### SD-13: Account Lock After Failed Login Attempts

- **Purpose**: Defend against automated credential stuffing and brute-force attacks.
- **Components**: `auth.service.js`, `Redis`, `Email Service`.
- **Workflow**: On invalid password attempt, increments Redis failure counter (`lockout:<email>`) with 15 min TTL → If count exceeds 5 attempts, sets lock status → Rejects subsequent attempts with 429 Too Many Requests → Sends security alert email.
- **Sprint Task**: Sprint 2.7 & 2.17 (Login & Rate Limiting).

### SD-14: Account Unlock

- **Purpose**: Restore locked account automatically after TTL or via admin intervention.
- **Components**: `auth.service.js`, `Redis`, `auth.repository.js`.
- **Workflow**: Automatic: Redis key expires after 15–30 minutes. Manual: Admin executes unlock endpoint clearing Redis lockout key and resetting failure counter.
- **Sprint Task**: Sprint 2.17 (Rate Limits & Account Lock).

### SD-15: Session Validation

- **Purpose**: Verify active session has not been revoked or hijacked.
- **Components**: `auth.middleware.js`, `Redis`.
- **Workflow**: Inspects request `sessionId` → Verifies active session hash in Redis → Validates IP subnet and User-Agent fingerprint → Updates `lastActivityAt` timestamp in Redis.
- **Sprint Task**: Sprint 2.16 (Session Security).

### SD-16: OTP Verification — Email `[CANONICAL]`

- **Purpose**: Canonical email address verification for registration and account recovery.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `Redis`, `user.repository.js`, `user.model.js`.
- **Workflow**: User submits `{ email, otp }` → Service fetches hashed OTP & attempt count from Redis → Verifies constant-time hash match → If invalid: increments attempt counter (invalidates on 5th attempt) → If valid: marks `isEmailVerified: true` on User document, deletes Redis OTP key → Dispatches welcome / confirmation event.
- **Sprint Task**: Sprint 2.5 (Email OTP Verification).

### SD-17: OTP Verification — Phone `[CANONICAL]`

- **Purpose**: Canonical mobile phone number verification.
- **Components**: `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `Redis`, `user.repository.js`, `user.model.js`.
- **Workflow**: User submits `{ phone, otp }` → Service fetches phone OTP hash from Redis → Validates match & attempt limit → If valid: marks `isPhoneVerified: true` on User document, deletes Redis OTP key.
- **Sprint Task**: Sprint 2.6 (Phone OTP Verification).
