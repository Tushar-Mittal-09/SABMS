# Authentication Error Codes & Response Contracts

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Error Response Envelope Format

All authentication errors adhere to the project's standard error envelope:

```json
{
  "success": false,
  "message": "Human readable error description",
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "details": []
  }
}
```

---

## 2. Standardized Error Catalog

| Error Code                       | HTTP Status                | Meaning / Trigger Condition                                                   | Client Message                                                                               |
| :------------------------------- | :------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **`AUTH_INVALID_CREDENTIALS`**   | `401 Unauthorized`         | Email or password does not match stored records.                              | `"Invalid email or password."`                                                               |
| **`AUTH_ACCOUNT_LOCKED`**        | `429 Too Many Requests`    | 5 consecutive failed login attempts reached.                                  | `"Account temporarily locked due to failed login attempts. Please try again in 15 minutes."` |
| **`AUTH_ACCOUNT_UNVERIFIED`**    | `403 Forbidden`            | User attempted login before completing email/phone OTP verification.          | `"Account not verified. Please verify your email with the OTP code."`                        |
| **`AUTH_ACCOUNT_DISABLED`**      | `403 Forbidden`            | Administrator has deactivated or suspended the account.                       | `"Your account has been deactivated. Please contact support."`                               |
| **`AUTH_EMAIL_ALREADY_EXISTS`**  | `409 Conflict`             | Registration attempted with an already registered email.                      | `"An account with this email address already exists."`                                       |
| **`AUTH_PHONE_ALREADY_EXISTS`**  | `409 Conflict`             | Registration attempted with an already registered phone number.               | `"An account with this phone number already exists."`                                        |
| **`AUTH_OTP_INVALID`**           | `400 Bad Request`          | Provided 6-digit OTP code does not match Redis stored hash.                   | `"Invalid verification code. Please check and try again."`                                   |
| **`AUTH_OTP_EXPIRED`**           | `400 Bad Request`          | Provided OTP code exceeded 5-minute TTL.                                      | `"Verification code has expired. Please request a new code."`                                |
| **`AUTH_OTP_MAX_ATTEMPTS`**      | `429 Too Many Requests`    | 5 consecutive failed attempts on an active OTP.                               | `"Maximum verification attempts exceeded. Code invalidated. Please request a new one."`      |
| **`AUTH_OTP_COOLDOWN_ACTIVE`**   | `429 Too Many Requests`    | Resend OTP requested before 60-second cooldown elapsed.                       | `"Please wait 60 seconds before requesting another code."`                                   |
| **`AUTH_TOKEN_MISSING`**         | `401 Unauthorized`         | Missing `Authorization: Bearer <token>` header on protected route.            | `"Access denied. No authentication token provided."`                                         |
| **`AUTH_TOKEN_INVALID`**         | `401 Unauthorized`         | JWT signature mismatch or malformed structure.                                | `"Invalid token. Please log in again."`                                                      |
| **`AUTH_TOKEN_EXPIRED`**         | `401 Unauthorized`         | JWT access token exceeded ~15-minute expiration time.                         | `"Your session has expired. Please refresh your token or log in again."`                     |
| **`AUTH_REFRESH_TOKEN_INVALID`** | `401 Unauthorized`         | Refresh token cookie is missing, expired, or invalid.                         | `"Invalid or expired refresh token. Please log in again."`                                   |
| **`AUTH_REFRESH_TOKEN_REUSED`**  | `401 Unauthorized`         | An already-consumed refresh token was submitted (Theft detected).             | `"Security violation detected. All sessions have been terminated. Please log in again."`     |
| **`AUTH_FORBIDDEN_ROLE`**        | `403 Forbidden`            | Authenticated user lacks required role (e.g., STUDENT accessing ADMIN route). | `"Access forbidden. You do not have permission to perform this action."`                     |
| **`AUTH_VALIDATION_ERROR`**      | `422 Unprocessable Entity` | Request body/query failed Zod validation schema.                              | `"Validation failed. Please check your inputs."`                                             |
