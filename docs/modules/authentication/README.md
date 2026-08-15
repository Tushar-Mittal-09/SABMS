# Authentication & User Identity Module (`auth`)

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Module Overview

The **Authentication Module** is a core bounded context within the SABMS Modular Monolith. It is responsible for identity provisioning, credential validation, multi-factor verification via One-Time Passwords (OTP), token lifecycle management (Access & Refresh tokens), concurrent session tracking, and role-based request authorization guards.

> **Status Notice**:
>
> - **Sprint 2.4 Implemented**: User Registration Workflow (`POST /api/v1/auth/register`), `auth.schema.js`, `auth.controller.js`, `auth.service.js`, `auth.response.js`, Argon2id password hashing via `password.security.js`, canonical defaults (`STUDENT` role, `PENDING` status, unverified), and persistence via `UserRepository`.
> - **Roadmap**: Canonical OTP verification dispatch (Sprint 2.5), Phone OTP (Sprint 2.6), Login & JWT token issuance (Sprint 2.7+).

---

## 2. Authentication Documentation Index

| Document                                   | Description                                                                                                                                 |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** | Conceptual tiered architecture, layer responsibilities, dependency boundaries, token/session/Redis strategies, and Mongoose vs Redis split. |
| **[`FLOWS.md`](./FLOWS.md)**               | End-to-end data flow diagrams and comprehensive mapping for Sequence Diagrams **SD-01 through SD-17**.                                      |
| **[`ENDPOINTS.md`](./ENDPOINTS.md)**       | RESTful API endpoint specifications, versioning (`/api/v1/auth`), request/response contracts, and query parameters.                         |
| **[`SECURITY.md`](./SECURITY.md)**         | Threat model, zero-trust security boundaries, token theft detection, rate limiting, and sensitive data logging policies.                    |
| **[`ERROR_CODES.md`](./ERROR_CODES.md)**   | Standardized authentication error definitions, HTTP status mappings, and client payload envelopes.                                          |
| **[`TEST_CASES.md`](./TEST_CASES.md)**     | Test strategy, unit test matrices, integration scenarios, and security validation cases for Sprint 2.                                       |

---

## 3. Core Architectural Decisions Summary

1. **Modular Monolith Placement**: Resides strictly under `server/src/modules/auth/` without external microservice fragmentation.
2. **Tiered Separation of Concerns**: `Route → Controller → Service → Repository` with isolated `Security Utilities`.
3. **Canonical Verification Mechanism**: **OTP (Email & Phone)** is the canonical verification mechanism for Sprint 2. Legacy verification-link flows (SD-02, SD-10) are retained as optional/legacy reference architecture.
4. **Dual-Token System**:
   - **Access Token**: Short-lived JSON Web Token (`JWT`, ~15 min lifetime) transmitted via `Authorization: Bearer <token>`.
   - **Refresh Token**: Long-lived high-entropy opaque random string (64 bytes, ~7 days lifetime) transmitted via `HttpOnly`, `SameSite=Strict`, `Secure` cookie with single-use rotation and reuse detection.
5. **State Storage Partitioning**:
   - **MongoDB (Persistent)**: User accounts, role definitions, password hashes, and persistent security audit records.
   - **Redis (Ephemeral)**: OTP hashes & attempt counters (5 min TTL), refresh token rotation families & session state (7 day TTL), failed login lockout counters (15–30 min TTL), and JTI revocation blocklists.
6. **Zero-Trust Security Boundary**: Plaintext passwords, OTPs, refresh tokens, and secret keys are never logged, never exposed to client JavaScript, and sanitized across all response and error pipelines.

---

## 4. Sprint 2 Implementation Roadmap

```text
Sprint 2.1  ──> Authentication Architecture & Documentation (Current)
Sprint 2.2  ──> User & Role Credential Foundation (Mongoose Models & Schemas)
Sprint 2.3  ──> Password Security & Cryptographic Hashing (Argon2/bcrypt)
Sprint 2.4  ──> User Registration Flow (Controller, Service, Repository)
Sprint 2.5  ──> Email OTP Verification Transport & Redis State
Sprint 2.6  ──> Phone OTP Verification Transport & SMS Gateway
Sprint 2.7  ──> User Login & Credential Verification Pipeline
Sprint 2.8  ──> Access Token Generation & JWT Authentication Middleware
Sprint 2.9  ──> Refresh Token Management & Secure Cookie Storage
Sprint 2.10 ──> Single-Use Refresh Token Rotation & Theft Detection
Sprint 2.11 ──> User Logout & Session Invalidation
Sprint 2.12 ──> Forgot Password Workflow
Sprint 2.13 ──> Reset Password with OTP Verification
Sprint 2.14 ──> Change Password & Global Session Revocation
Sprint 2.15 ──> Resend OTP Flow & Throttling
Sprint 2.16 ──> Multi-Device Concurrent Session Security
Sprint 2.17 ──> Authentication Rate Limiting & Brute-Force Throttling
Sprint 2.18 ──> CSRF Protection Architecture
Sprint 2.19 ──> XSS Defense & Input Sanitization
Sprint 2.20 ──> Authentication Security & Integration Test Suite
Sprint 2.21 ──> Authentication Module Final Audit & Acceptance
```
