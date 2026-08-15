# RESTful API Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. REST API Standards & Conventions

- **Base URL**: `/api/v1`
- **Protocol**: HTTPS / TLS 1.3
- **Data Format**: `application/json`
- **Authentication**: `Authorization: Bearer <JWT_TOKEN>`

---

## 2. Standard Response Envelope

### 2.1 Success Response (`200 OK` / `201 Created`)

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {}
}
```

### 2.2 Error Response (`400` / `401` / `403` / `404` / `422` / `500`)

```json
{
  "success": false,
  "message": "Detailed description of error",
  "error": {
    "details": []
  }
}
```

---

## 3. Core API Endpoint Catalog Summary

### 3.1 Base Health Endpoint

- **`GET /health`**: Public system health & uptime status.

### 3.2 Authentication Endpoints (`/api/v1/auth`)

- **`POST /api/v1/auth/register`**: Register new user account.
- **`POST /api/v1/auth/login`**: Authenticate credentials and issue JWT tokens.
- **`GET /api/v1/auth/me`**: Fetch current user profile.

### 3.3 Auditorium Endpoints (`/api/v1/auditoriums`)

- **`GET /api/v1/auditoriums`**: List all auditoriums.
- **`POST /api/v1/auditoriums`**: Create new auditorium (Admin only).

### 3.4 Booking Endpoints (`/api/v1/bookings`)

- **`GET /api/v1/bookings`**: Query bookings with filters.
- **`POST /api/v1/bookings`**: Submit booking reservation request.
- **`PATCH /api/v1/bookings/:id/status`**: Update booking status (Approve/Reject).

---

## 4. API Specification Extension Register

- [ ] OpenAPI 3.0 / Swagger YAML Spec Integration
- [ ] Endpoint Request/Response Schemas per Module
