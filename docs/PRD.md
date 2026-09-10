# Product Requirements Document (PRD)

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Executive Summary

The **Smart Auditorium Booking & Management System (SABMS)** is an enterprise-grade platform designed to automate and streamline the lifecycle of auditorium reservations, event scheduling, equipment allocation, and real-time status tracking for educational institutions and commercial venues.

---

## 2. Product Vision & Business Objectives

- **Eliminate Double-Booking**: Enforce strict validation and real-time concurrency controls on venue reservations.
- **Automate Approval Workflows**: Provide multi-tier RBAC approval pipelines (Department Head → Venue Manager → Admin).
- **Resource & Equipment Allocation**: Track sound systems, projectors, seating configurations, and maintenance schedules per booking.
- **Real-Time Visibility**: Provide interactive live availability calendars and status notifications.

---

## 3. Key Target Personas

| Persona                     | Role                                | Key Needs                                                                     |
| :-------------------------- | :---------------------------------- | :---------------------------------------------------------------------------- |
| **Event Organizer**         | Student / Faculty / External Client | Search venues, request slots, request equipment, track approval status.       |
| **Auditorium Manager**      | Venue Administrator                 | Review booking requests, approve/reject events, manage maintenance schedules. |
| **Department Head / Admin** | Approver / System Admin             | Oversee institution-wide venue usage, manage user roles, audit reports.       |

---

## 4. Functional Requirements Matrix (Module Breakdown)

> _Note: Detailed specifications will be expanded module by module in subsequent steps._

### 4.1 Authentication & User Management (`auth`) — [Sprint 2: 100% COMPLETE & ACCEPTED]

The Sprint 2 Authentication & Security scope encompasses 21 distinct functional and architectural requirements:

- **2.1 Authentication Architecture**: Modular Monolith design, strict layer separation, and zero-web-storage memory policy.
- **2.2 User Credential Foundation**: Normalized user identity models, selective password hash projection, and anti-enumeration queries.
- **2.3 Password Security**: Memory-hard Argon2id password hashing, strict length/complexity rules, zero-pepper architecture.
- **2.4 Registration**: Public account registration with default `STUDENT` role, `PENDING` state, and mass-assignment protection.
- **2.5 Email OTP Verification**: 6-digit CSPRNG OTP, HMAC-SHA256 Redis storage (10m TTL), 60s cooldown, atomic 5-attempt limit.
- **2.6 Phone OTP Verification**: E.164 phone normalization, SMS OTP delivery, isolated Redis keys (10m TTL), `isPhoneVerified` transition.
- **2.7 Login**: Constant-time Argon2id verification, account status checks (`ACTIVE` & verified), generic 401 response envelopes.
- **2.8 Access Token**: Short-lived (15m) HS256 JWT access tokens signed with `JWT_ACCESS_SECRET`, minimal non-sensitive claims.
- **2.9 Refresh Token**: Long-lived (7d) JWT refresh tokens signed with `JWT_REFRESH_SECRET`, transmitted via `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` cookie.
- **2.10 Token Rotation**: Single-use rotation with atomic `CONSUMED` transition and token family reuse theft detection.
- **2.11 Logout**: Cryptographic refresh token verification, atomic token family revocation (`USER_LOGOUT`), cookie clearing.
- **2.12 Forgot Password**: Zero-enumeration password recovery initiation, 60s cooldown, max 3 requests/hour.
- **2.13 Reset Password**: Verification of HMAC-hashed reset OTP (5m TTL), Argon2id password update, termination of all sessions.
- **2.14 Change Password**: Authenticated password change with current password verification, optional multi-device session revocation.
- **2.15 Resend OTP**: Unified endpoint for email and phone verification resends with cooldown and attempt rate limits.
- **2.16 Session/Device Security**: Subnet (/24 IPv4, /64 IPv6) + User-Agent device fingerprinting, session listing & revocation endpoints.
- **2.17 Authentication Rate Limits**: 5 consecutive failed logins triggers 15-minute account lockout (`lockout:<email>`), administrative unlock.
- **2.18 CSRF Protection**: Double-Submit Cookie Pattern with HMAC-SHA256 signatures (`XSRF-TOKEN`), strict Origin verification.
- **2.19 XSS Protection**: Recursive input sanitization middleware (`xss.middleware.js`) preserving password entropy, strict Helmet CSP.
- **2.20 Authentication Security Tests**: Comprehensive automated regression suites covering edge cases and error states.
- **2.21 Authentication Final Audit**: Formal security verification, zero requirement blockers, accepted non-blocking dependency risk.

### 4.2 Auditorium & Resource Management (`auditorium`)

- Auditorium CRUD, capacity, AV equipment inventory, maintenance mode toggles.

### 4.3 Reservation & Booking Engine (`booking`)

- **4.3.1 Single-Seat Selection & Real-Time Availability (Step 3)**: Authoritative seat mapping (360 seats: 48 faculty-reserved rows A-B, 312 student seats rows C-O), conflict detection, time-boundary validation.
- **4.3.2 Booking Confirmation & Success Flow (Step 4)**:
  - **Booking Summary Presentation**: Explicit display of non-modifiable event metadata (Event Name, Auditorium, Date, Start Time) and selected student seat prior to submission.
  - **Confirmation State Machine**: Disabled without selection (`Select a Seat`), enabled with single selection (`Confirm Booking`), locked with progress indicator during submission (`Booking...`), preventing duplicate requests.
  - **Authoritative Booking Success State**: Real-time rendering of backend-confirmed details (Booking Reference `BK-XXXXXXXX-XXXXXX`, Event Name, Auditorium Name, Seat Label/ID, Date, Time, Status `CONFIRMED`).
  - **HTTP 409 Conflict Handling**: Seamless notification ("That seat was just booked by another student. Please select another seat."), automatic state clearance, and background seat map refresh without exposing database internals.
  - **Sanitized Error States**: User-friendly handling for expired sessions (401), missing events (404), closed booking windows (422), with zero stack trace or internal disclosure.

### 4.4 Event Scheduling & Calendar (`event`)

- Public event directory, featured events, interactive calendar view, attendee ticketing/RSVP.

### 4.5 Real-Time Notifications & Alerts (`notification`)

- Email notifications, WebSockets live status alerts, system audit logs.

---

## 5. Non-Functional Requirements (NFRs)

- **Performance**: Sub-200ms API response time for availability searches under peak load.
- **Availability**: 99.9% uptime with graceful degradation.
- **Security**: Strict JWT expiration, Argon2id password hashing, OWASP security headers, double-submit CSRF, and recursive XSS defenses.
- **Scalability**: Modular Monolith design ready for microservice extraction.

---

## 6. Document Revision & Expansion History

| Version  | Date       | Author                    | Description                                                                |
| :------- | :--------- | :------------------------ | :------------------------------------------------------------------------- |
| `v1.0.0` | 2026-08-08 | Senior Software Architect | Initial PRD Template Initialization                                        |
| `v1.1.0` | 2026-09-07 | Senior Software Architect | Document Sprint 2 Completion (2.1–2.21 100% Complete & Accepted); Argon2id |
