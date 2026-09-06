# RESTful API Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. REST API Standards & Conventions

- **Base URL**: `/api/v1` (Default supported version: `v1`, fallback versioning: `v2`)
- **Protocol**: HTTPS / TLS 1.3
- **Data Format**: `application/json`
- **Authentication**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Refresh Token Transmission**: `HttpOnly`, `Secure`, `SameSite=Strict` Cookie (`refreshToken`)
- **Correlation Tracking**: Client/Server correlation ID via `X-Request-ID` header

---

## 2. Standardized Response Envelopes

### 2.1 Success Response Envelope (`200 OK` / `201 Created`)

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": null
}
```

### 2.2 Paginated Success Response Envelope

```json
{
  "success": true,
  "message": "Items retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 2.3 Error Response Envelope (`400` / `401` / `403` / `404` / `409` / `422` / `429` / `500`)

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": {
    "code": "ERROR_CODE_IDENTIFIER",
    "details": []
  }
}
```

---

## 3. Standardized Error Catalog

| Error Code                       | HTTP Status                 | Meaning / Trigger Condition                                                   | Client Message                                                                               |
| :------------------------------- | :-------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **`AUTH_INVALID_CREDENTIALS`**   | `401 Unauthorized`          | Email or password does not match stored records.                              | `"Invalid email or password."`                                                               |
| **`AUTH_ACCOUNT_LOCKED`**        | `429 Too Many Requests`     | 5 consecutive failed login attempts reached.                                  | `"Account temporarily locked due to failed login attempts. Please try again in 15 minutes."` |
| **`AUTH_ACCOUNT_UNVERIFIED`**    | `403 Forbidden`             | User attempted login before completing email/phone OTP verification.          | `"Account not verified. Please verify your email with the OTP code."`                        |
| **`AUTH_ACCOUNT_DISABLED`**      | `403 Forbidden`             | Administrator has deactivated or suspended the account.                       | `"Your account has been deactivated. Please contact support."`                               |
| **`AUTH_EMAIL_ALREADY_EXISTS`**  | `409 Conflict`              | Registration attempted with an already registered email.                      | `"An account with this email address already exists."`                                       |
| **`AUTH_PHONE_ALREADY_EXISTS`**  | `409 Conflict`              | Registration attempted with an already registered phone number.               | `"An account with this phone number already exists."`                                        |
| **`AUTH_OTP_INVALID`**           | `400 Bad Request`           | Provided 6-digit OTP code does not match Redis stored hash.                   | `"Invalid verification code. Please check and try again."`                                   |
| **`AUTH_OTP_EXPIRED`**           | `400 Bad Request`           | Provided OTP code exceeded 5-minute TTL.                                      | `"Verification code has expired. Please request a new code."`                                |
| **`AUTH_OTP_MAX_ATTEMPTS`**      | `429 Too Many Requests`     | 5 consecutive failed attempts on an active OTP.                               | `"Maximum verification attempts exceeded. Code invalidated. Please request a new one."`      |
| **`AUTH_OTP_COOLDOWN_ACTIVE`**   | `429 Too Many Requests`     | Resend OTP requested before 60-second cooldown elapsed.                       | `"Please wait 60 seconds before requesting another code."`                                   |
| **`AUTH_TOKEN_MISSING`**         | `401 Unauthorized`          | Missing `Authorization: Bearer <token>` header on protected route.            | `"Access denied. No authentication token provided."`                                         |
| **`AUTH_TOKEN_INVALID`**         | `401 Unauthorized`          | JWT signature mismatch or malformed structure.                                | `"Invalid token. Please log in again."`                                                      |
| **`AUTH_TOKEN_EXPIRED`**         | `401 Unauthorized`          | JWT access token exceeded ~15-minute expiration time.                         | `"Your session has expired. Please refresh your token or log in again."`                     |
| **`AUTH_REFRESH_TOKEN_INVALID`** | `401 Unauthorized`          | Refresh token cookie is missing, expired, or invalid.                         | `"Invalid or expired refresh token. Please log in again."`                                   |
| **`AUTH_REFRESH_TOKEN_REUSED`**  | `401 Unauthorized`          | An already-consumed refresh token was submitted (Theft detected).             | `"Security violation detected. All sessions have been terminated. Please log in again."`     |
| **`AUTH_FORBIDDEN_ROLE`**        | `403 Forbidden`             | Authenticated user lacks required role (e.g., STUDENT accessing ADMIN route). | `"Access forbidden. You do not have permission to perform this action."`                     |
| **`VALIDATION_ERROR`**           | `422 Unprocessable Entity`  | Request body, query string, or params failed Zod schema validation.           | `"Validation failed. Please check your inputs."`                                             |
| **`RESOURCE_NOT_FOUND`**         | `404 Not Found`             | Requested URI or entity does not exist.                                       | `"Resource not found."`                                                                      |
| **`INTERNAL_SERVER_ERROR`**      | `500 Internal Server Error` | Unhandled server exception.                                                   | `"Internal server error occurred."`                                                          |

---

## 4. Complete Endpoint Catalog

### 4.1 System & Health Endpoints

#### `GET /health`

- **Description**: Probes system health, uptime, and database connectivity.
- **Access**: Public
- **Query Parameters**: `format` (`minimal` | `full`, default: `minimal`)
- **Success Response (`200 OK` / `503 Service Unavailable`)**:
  ```json
  {
    "success": true,
    "message": "System operational",
    "data": {
      "status": "healthy",
      "timestamp": "2026-08-15T12:00:00.000Z",
      "uptimeSeconds": 3600.5,
      "requestId": "uuid-v4",
      "services": {
        "database": { "status": "healthy" }
      }
    },
    "meta": null
  }
  ```

#### `GET /live`

- **Description**: Liveness probe confirming HTTP process responsiveness.
- **Access**: Public
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Service live",
    "data": {
      "live": true,
      "timestamp": "2026-08-15T12:00:00.000Z",
      "requestId": "uuid-v4"
    },
    "meta": null
  }
  ```

#### `GET /ready`

- **Description**: Readiness probe verifying critical dependency readiness (MongoDB).
- **Access**: Public
- **Success Response (`200 OK` / `503 Service Unavailable`)**:
  ```json
  {
    "success": true,
    "message": "Service ready",
    "data": {
      "ready": true,
      "timestamp": "2026-08-15T12:00:00.000Z",
      "checks": { "database": true }
    },
    "meta": null
  }
  ```

#### `GET /info`

- **Description**: Service metadata, environment, runtime version, and hostname.
- **Access**: Public
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Service information",
    "data": {
      "appName": "Smart Auditorium Booking & Management System",
      "apiVersion": "/api/v1",
      "environment": "development",
      "nodeVersion": "v20.x.x"
    },
    "meta": null
  }
  ```

---

### 4.2 Authentication Endpoints (`/api/v1/auth`)

#### `POST /api/v1/auth/register`

- **Description**: Registers a new user account with canonical default `STUDENT` role and `PENDING` account status. Password is cryptographically hashed using Argon2id.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@university.edu",
    "phone": "+1234567890",
    "password": "SecurePassword123!",
    "department": "Computer Science"
  }
  ```
  _(Note: `phone` and `department` are optional. Injected privileges like `role`, `status`, `passwordHash` are rejected)._
- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "phone": "+1234567890",
      "department": "Computer Science",
      "role": "STUDENT",
      "status": "PENDING",
      "isEmailVerified": false,
      "isPhoneVerified": false,
      "createdAt": "2026-08-15T12:00:00.000Z"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/verify-email` `[CANONICAL - SPRINT 2.5]`

- **Description**: Verifies user email address using 6-digit numeric OTP stored securely in Redis. Transitions account status to `ACTIVE` upon success.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "jane.doe@university.edu",
    "otp": "582901"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Email verified successfully",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "phone": "+1234567890",
      "department": "Computer Science",
      "role": "STUDENT",
      "status": "ACTIVE",
      "isEmailVerified": true,
      "isPhoneVerified": false,
      "createdAt": "2026-08-15T12:00:00.000Z"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/resend-email-otp` `[CANONICAL - SPRINT 2.5]`

- **Description**: Generates and dispatches a new 6-digit verification OTP to the user's email address. Enforces 60-second cooldown and maximum 5 resends.
- **Access**: Public (Throttled)
- **Request Body**:
  ```json
  {
    "email": "jane.doe@university.edu"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Verification code sent successfully",
    "data": {
      "email": "jane.doe@university.edu"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/verify-phone` `[CANONICAL - SPRINT 2.6]`

- **Description**: Verifies user phone number using 6-digit numeric OTP stored securely in Redis. Sets `isPhoneVerified = true` while preserving existing email verification and account status.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "otp": "582901"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Phone verified successfully",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "phone": "+919876543210",
      "department": "Computer Science",
      "role": "STUDENT",
      "status": "PENDING",
      "isEmailVerified": false,
      "isPhoneVerified": true,
      "createdAt": "2026-08-15T12:00:00.000Z"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/resend-phone-otp` `[CANONICAL - SPRINT 2.6]`

- **Description**: Generates and dispatches a new 6-digit verification OTP to the user's phone number via SMS. Enforces 60-second cooldown and maximum 5 resends.
- **Access**: Public (Throttled)
- **Request Body**:
  ```json
  {
    "phone": "+919876543210"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Verification code sent successfully",
    "data": {
      "phone": "+919876543210"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/login` `[CANONICAL - SPRINT 2.7, SPRINT 2.8 & SPRINT 2.9]`

- **Description**: Authenticates user credentials (email & password) using Argon2id constant-time verification, validates account state (active & verified), updates `lastLoginAt`, and returns sanitized user profile along with a cryptographically signed short-lived JWT Access Token in the response body, and sets a long-lived cryptographically signed JWT Refresh Token in a secure HttpOnly cookie.
- **Sprint Boundaries**:
  - **Access Token (JWT)**: Sprint 2.8 `[IMPLEMENTED]` (Short-lived, ~15m, signed with HMAC-SHA256, contains `sub`, `role`, `iat`, `exp`, `iss`, `aud`).
  - **Refresh Tokens & HttpOnly Cookie**: Sprint 2.9 `[IMPLEMENTED]` (Long-lived, ~7d, signed with dedicated `JWT_REFRESH_SECRET`, contains `sub`, `jti`, `familyId`, `type: 'refresh'`, `iat`, `exp`, `iss`, `aud`, delivered via `HttpOnly`, `SameSite=Strict`, scoped `Path=/api/v1/auth/refresh`).
  - **Single-Use Token Rotation & Reuse Detection**: Sprint 2.10 `[IMPLEMENTED]` (Initial family `familyId` created on login, initial token persisted as `ACTIVE`, rotated on each refresh with replacement cookie, replayed tokens trigger family revocation and cookie clearing).
  - **Logout & Revocation endpoint**: Sprint 2.11 `[IMPLEMENTED]`.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "jane.doe@university.edu",
    "password": "SecurePassword123!"
  }
  ```
- **Response Headers**:
  ```http
  Set-Cookie: refreshToken=<JWT_REFRESH_TOKEN>; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict; Max-Age=604800; Secure
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "phone": "+919876543210",
      "department": "Computer Science",
      "role": "STUDENT",
      "status": "ACTIVE",
      "isEmailVerified": true,
      "isPhoneVerified": true,
      "lastLoginAt": "2026-08-15T12:00:00.000Z",
      "createdAt": "2026-08-15T12:00:00.000Z",
      "user": {
        "id": "64a7f8e9c1d2e3f4a5b6c7d8",
        "name": "Jane Doe",
        "email": "jane.doe@university.edu",
        "phone": "+919876543210",
        "department": "Computer Science",
        "role": "STUDENT",
        "status": "ACTIVE",
        "isEmailVerified": true,
        "isPhoneVerified": true,
        "lastLoginAt": "2026-08-15T12:00:00.000Z",
        "createdAt": "2026-08-15T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": "15m"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/refresh` `[CANONICAL - SPRINT 2.10]`

- **Description**: Validates the incoming refresh token received strictly from the `HttpOnly` cookie (`refreshToken`), validates user account state (active & verified), verifies token authenticity and database state by `jti`, rotates the refresh token (atomically marks old token `CONSUMED` with `replacedByTokenId` and issues replacement `ACTIVE` token in same `familyId`), replaces the HttpOnly cookie with the new token, and issues a fresh Access Token in the response body. If a replayed or already-consumed token is received, reuse detection immediately marks the token `REUSED`, revokes all tokens across the `familyId`, clears the client cookie, and returns `401 Unauthorized`.
- **Sprint Boundaries**:
  - **Refresh Token Validation & Access Token Issuance**: Sprint 2.9 `[IMPLEMENTED]`.
  - **Single-Use Token Rotation & Reuse Detection**: Sprint 2.10 `[IMPLEMENTED]`.
  - **Logout & Explicit Revocation**: Sprint 2.11 `[IMPLEMENTED]`.
- **Access**: Public (Requires valid `refreshToken` HttpOnly cookie)
- **Request Body**: None (Tokens in request body, query parameters, or Authorization headers are strictly ignored/rejected).
- **Response Headers (Success - 200 OK)**:
  ```http
  Set-Cookie: refreshToken=<NEW_ROTATED_JWT_REFRESH_TOKEN>; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict; Max-Age=604800; Secure
  ```
- **Response Headers (Reuse Detected - 401 Unauthorized)**:
  ```http
  Set-Cookie: refreshToken=; Path=/api/v1/auth/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Access token refreshed successfully.",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "phone": "+919876543210",
      "department": "Computer Science",
      "role": "STUDENT",
      "status": "ACTIVE",
      "isEmailVerified": true,
      "isPhoneVerified": true,
      "lastLoginAt": "2026-08-15T12:00:00.000Z",
      "createdAt": "2026-08-15T12:00:00.000Z",
      "user": {
        "id": "64a7f8e9c1d2e3f4a5b6c7d8",
        "name": "Jane Doe",
        "email": "jane.doe@university.edu",
        "phone": "+919876543210",
        "department": "Computer Science",
        "role": "STUDENT",
        "status": "ACTIVE",
        "isEmailVerified": true,
        "isPhoneVerified": true,
        "lastLoginAt": "2026-08-15T12:00:00.000Z",
        "createdAt": "2026-08-15T12:00:00.000Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresIn": "15m"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/auth/logout` `[CANONICAL - SPRINT 2.11]`

- **Description**: Authenticates user logout request using the `HttpOnly` refresh token cookie (`refreshToken`), cryptographically verifies the token, locates the token record by `jti`, invalidates the entire associated refresh-token family in MongoDB (`ACTIVE` and `CONSUMED` tokens become `REVOKED` with `USER_LOGOUT` reason), clears the HttpOnly refresh cookie, and returns a standardized HTTP 200 response envelope.
- **Sprint Boundaries**:
  - **Logout & Refresh-Token Revocation**: Sprint 2.11 `[IMPLEMENTED]`.
  - **Access Token Blacklist / Immediate Revocation**: `[NOT IMPLEMENTED in Sprint 2.11 - Access tokens expire naturally via short TTL]`.
- **Access**: Public at HTTP middleware level (Authenticated via `refreshToken` HttpOnly cookie)
- **Request Body**: None (No JSON body required. Tokens in request body, query parameters, or Authorization headers are strictly ignored/rejected).
- **Response Headers**:
  ```http
  Set-Cookie: refreshToken=; Path=/api/v1/auth/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully",
    "data": null,
    "meta": null
  }
  ```
- **Invariants & Security Behaviors**:
  - **Cookie Cleared**: The `refreshToken` cookie is cleared using matching configuration (`HttpOnly`, `Path=/api/v1/auth/refresh`, `SameSite=Strict`, `Secure`).
  - **Family Revoked**: The entire refresh-token family is revoked in MongoDB. Subsequent `/refresh` requests using any token from the family fail with `401 Unauthorized`.
  - **Idempotency**: Requests with missing cookies, expired tokens, or already-revoked tokens succeed safely (`HTTP 200`), clear the browser cookie, and perform no unsafe database mutations.
  - **No Unverified Trust**: The service never trusts unverified JWT claims (`jwt.decode()`) to mutate database records; cryptographic verification must succeed first.
  - **Access Tokens**: Access tokens are not revoked immediately (no server-side blacklist in Sprint 2.11) and expire naturally within their ~15-minute lifespan.

#### `POST /api/v1/auth/forgot-password`

- **Description**: Initiates password recovery by sending a 6-digit reset OTP.
- **Access**: Public (Throttled)
- **Request Body**:
  ```json
  { "email": "jane.doe@university.edu" }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "If an account exists with this email, a reset code has been sent.",
    "data": null,
    "meta": null
  }
  ```
- **Invariants & Security Behaviors (Sprint 2.12)**:
  - **Zero Account Enumeration**: Both registered and non-registered email addresses return the identical generic HTTP 200 response with null payload.
  - **Rate Limiting & Cooldown**: Enforces a 60-second cooldown (`PASSWORD_RESET_OTP_COOLDOWN_SECONDS = 60`) and maximum 3 requests per hour (`PASSWORD_RESET_OTP_MAX_REQUESTS = 3`, `PASSWORD_RESET_OTP_RATE_WINDOW_SECONDS = 3600`) in Redis per normalized email. Rejection with generic `429 Too Many Requests` does not reveal account existence.
  - **Cryptographic OTP Generation & Storage**: 6-digit numeric OTP generated using `crypto.randomInt` (preserving leading zeros). Stored solely as an HMAC-SHA256 hash in isolated Redis namespace `auth:otp:reset:<email>` with 5-minute TTL (`PASSWORD_RESET_OTP_TTL_SECONDS = 300`).
  - **Zero Leakage**: Plaintext OTP is never persisted in Redis/MongoDB, never logged, and never returned in API payloads or headers.
  - **Fail-Safe Cleanup**: If email dispatch fails, the stored OTP in Redis is immediately purged to prevent orphan active reset codes.
  - **Sprint Boundary**: Sprint 2.12 is strictly an OTP issuance flow; password changes, OTP verification, and session revocations are NOT part of this sprint.

#### `POST /api/v1/auth/reset-password`

- **Description**: Resets password using verified OTP and triggers global session invalidation.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "jane.doe@university.edu",
    "otp": "719302",
    "newPassword": "NewSuperPassword2026!"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Password reset successful. All active sessions have been terminated. Please log in.",
    "data": null,
    "meta": null
  }
  ```

#### `POST /api/v1/auth/change-password`

- **Description**: Authenticated password change with optional "logout from other devices" flag.
- **Access**: Authenticated (`Bearer <accessToken>`)
- **Request Body**:
  ```json
  {
    "currentPassword": "SecurePassword123!",
    "newPassword": "NewSuperPassword2026!",
    "logoutOtherDevices": true
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Password updated successfully.",
    "data": null,
    "meta": null
  }
  ```

#### `GET /api/v1/auth/me`

- **Description**: Retrieves current authenticated user context and permissions.
- **Access**: Authenticated (`Bearer <accessToken>`)
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Profile retrieved.",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "role": "FACULTY",
      "department": "Computer Science",
      "isEmailVerified": true,
      "isPhoneVerified": true
    },
    "meta": null
  }
  ```

#### `GET /api/v1/auth/sessions`

- **Description**: Lists all active concurrent sessions for the authenticated user.
- **Access**: Authenticated (`Bearer <accessToken>`)
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Active sessions retrieved.",
    "data": [
      {
        "sessionId": "sess_1a2b3c",
        "ipAddress": "192.168.1.10",
        "userAgent": "Mozilla/5.0 ... Chrome/120.0",
        "isCurrent": true,
        "createdAt": "2026-08-14T10:00:00.000Z",
        "lastActivityAt": "2026-08-14T12:30:00.000Z"
      }
    ],
    "meta": null
  }
  ```

---

### 4.3 Users Endpoints (`/api/v1/users`)

#### `GET /api/v1/users`

- **Description**: Query users with pagination, role filtering, and status filtering.
- **Access**: Authenticated (`ADMIN` / `VENUE_MANAGER`)
- **Query Parameters**: `role`, `status`, `page`, `limit`, `search`
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Users retrieved successfully",
    "data": [],
    "meta": { "page": 1, "limit": 20, "total": 0 }
  }
  ```

#### `GET /api/v1/users/:id`

- **Description**: Retrieve user details by ID.
- **Access**: Authenticated
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "User retrieved successfully",
    "data": {
      "id": "64a7f8e9c1d2e3f4a5b6c7d8",
      "name": "Jane Doe",
      "email": "jane.doe@university.edu",
      "role": "STUDENT",
      "status": "ACTIVE"
    },
    "meta": null
  }
  ```

#### `POST /api/v1/users`

- **Description**: Administrative creation of user accounts.
- **Access**: Authenticated (`ADMIN` only)

---

### 4.4 Auditorium Endpoints (`/api/v1/auditoriums`)

#### `GET /api/v1/auditoriums`

- **Description**: List all auditoriums with seating capacity and operational status.
- **Access**: Public / Authenticated

#### `POST /api/v1/auditoriums`

- **Description**: Create new auditorium venue.
- **Access**: Authenticated (`ADMIN` only)

---

### 4.5 Booking Endpoints (`/api/v1/bookings`)

#### `GET /api/v1/bookings`

- **Description**: Query scheduled bookings with date range, auditorium, and status filters.
- **Access**: Authenticated

#### `POST /api/v1/bookings`

- **Description**: Submit a new auditorium booking reservation request.
- **Access**: Authenticated (`FACULTY`, `CLUB_MEMBER`, `EVENT_ORGANIZER`)

#### `PATCH /api/v1/bookings/:id/status`

- **Description**: Approve, reject, or cancel a booking reservation.
- **Access**: Authenticated (`ADMIN`, `VENUE_MANAGER`)
