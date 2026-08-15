# Authentication API Endpoint Specifications

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. REST API Standards & Prefixing

- **Base URL**: `/api/v1/auth` (Default supported version: `v1`, fallback versioning: `v2`)
- **Transport**: HTTPS with TLS 1.3
- **Payload Format**: `application/json`
- **Response Standard**: Standardized SABMS API Envelope:
  ```json
  {
    "success": true,
    "message": "Operation description",
    "data": {},
    "meta": null
  }
  ```

---

## 2. Core Endpoint Catalog

### 2.1 Public Identity Provisioning Endpoints

#### `POST /api/v1/auth/register`

- **Description**: Registers a new user account with canonical default `STUDENT` role and `PENDING` account status. Password is cryptographically hashed using Argon2id. Verification initiation boundary is maintained; canonical Email OTP dispatch and verification are deferred to Sprint 2.5.
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
  _(Note: `phone` and `department` are optional. Client-supplied `role`, `status`, `passwordHash`, `isEmailVerified`, `isPhoneVerified`, and `lastLoginAt` are strictly rejected by validation schema)._
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

---

#### `POST /api/v1/auth/verify-email-otp` `[CANONICAL]`

- **Description**: Verifies email address using 6-digit OTP.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "jane.doe@university.edu",
    "otp": "482910"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Email verified successfully. You may now log in.",
    "data": {
      "isEmailVerified": true
    },
    "meta": null
  }
  ```

---

#### `POST /api/v1/auth/verify-phone-otp` `[CANONICAL]`

- **Description**: Verifies mobile phone number using 6-digit SMS OTP.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "phone": "+1234567890",
    "otp": "839201"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Phone number verified successfully.",
    "data": {
      "isPhoneVerified": true
    },
    "meta": null
  }
  ```

---

#### `POST /api/v1/auth/resend-otp`

- **Description**: Requests a new OTP for email or phone verification with rate limit cooldown.
- **Access**: Public (Throttled)
- **Request Body**:
  ```json
  {
    "type": "email",
    "identifier": "jane.doe@university.edu"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "A new verification code has been dispatched.",
    "data": {
      "cooldownSeconds": 60
    },
    "meta": null
  }
  ```

---

### 2.2 Authentication & Session Lifecycle Endpoints

#### `POST /api/v1/auth/login`

- **Description**: Authenticates user credentials and issues Access Token + `HttpOnly` Refresh Cookie.
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
  Set-Cookie: refreshToken=d8f7e6a5b4c3...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Authentication successful.",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "user": {
        "id": "64a7f8e9c1d2e3f4a5b6c7d8",
        "name": "Jane Doe",
        "email": "jane.doe@university.edu",
        "role": "FACULTY"
      }
    },
    "meta": null
  }
  ```

---

#### `POST /api/v1/auth/refresh`

- **Description**: Rotates refresh token cookie and issues a fresh Access Token.
- **Access**: Public (Requires valid `refreshToken` cookie)
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Token refreshed successfully.",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
    },
    "meta": null
  }
  ```

---

#### `POST /api/v1/auth/logout`

- **Description**: Terminates current session, invalidates refresh token in Redis, and clears cookie.
- **Access**: Authenticated / Public with Cookie
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully.",
    "data": {
      "loggedOut": true
    },
    "meta": null
  }
  ```

---

### 2.3 Password Recovery & Account Management

#### `POST /api/v1/auth/forgot-password`

- **Description**: Initiates password recovery by sending a 6-digit reset OTP.
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
    "message": "If an account exists with this email, a reset code has been sent.",
    "data": null,
    "meta": null
  }
  ```

---

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

---

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

---

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
      "phone": "+1234567890",
      "role": "FACULTY",
      "department": "Computer Science",
      "isEmailVerified": true,
      "isPhoneVerified": true
    },
    "meta": null
  }
  ```

---

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
