# Entity-Relationship Diagram (ERD)

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Domain Entity Relationship Map

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : generates
    USER ||--o{ SESSION : owns
    AUDITORIUM ||--o{ BOOKING : reserved_for
    AUDITORIUM ||--o{ EQUIPMENT : contains
    BOOKING ||--o| EVENT : hosts
    BOOKING }o--o{ EQUIPMENT : requests

    USER {
        string _id PK
        string name
        string email UK
        string phone
        string passwordHash
        string role
        string status
        string department
        boolean isEmailVerified
        boolean isPhoneVerified
        date lastLoginAt
        number tokenVersion
        date createdAt
        date updatedAt
    }

    SESSION {
        string sessionId PK
        string userId FK
        string refreshTokenHash
        string ipAddress
        string userAgent
        date lastActivityAt
        date expiresAt
    }

    AUDITORIUM {
        string _id PK
        string name
        string code UK
        number capacity
        json location
        json seatingLayout
        boolean isOperational
        date createdAt
        date updatedAt
    }

    EQUIPMENT {
        string _id PK
        string auditoriumId FK
        string name
        string category
        number quantity
        string status
        date createdAt
    }

    BOOKING {
        string _id PK
        string userId FK
        string auditoriumId FK
        datetime startTime
        datetime endTime
        string status
        string purpose
        number expectedAttendees
        string rejectionReason
        string approvedBy FK
        datetime approvedAt
        date createdAt
        date updatedAt
    }

    EVENT {
        string _id PK
        string bookingId FK
        string title
        string description
        string bannerUrl
        string category
        boolean isPublic
        boolean registrationRequired
        number maxRegistrations
        date createdAt
        date updatedAt
    }

    NOTIFICATION {
        string _id PK
        string recipientId FK
        string type
        string title
        string message
        boolean isRead
        json data
        date createdAt
    }

    AUDIT_LOG {
        string _id PK
        string userId FK
        string action
        string resource
        string resourceId
        string ipAddress
        string userAgent
        json metadata
        date timestamp
    }
```

---

## 2. Entity Cardinalities & Relational Rules

1. **User ↔ Booking (`1 : N`)**: A user can initiate multiple booking requests across different dates and times.
2. **User ↔ Session (`1 : N`)**: A user can maintain multiple concurrent active device sessions tracked in Redis and indexed for session management.
3. **Auditorium ↔ Booking (`1 : N`)**: An auditorium venue can host multiple sequential bookings, strictly constrained to non-overlapping time slots.
4. **Auditorium ↔ Equipment (`1 : N`)**: An auditorium owns multiple assigned AV, lighting, and physical equipment items.
5. **Booking ↔ Event (`1 : 1`)**: An approved booking may optionally host exactly one public event listing.
6. **Booking ↔ Equipment (`N : M`)**: A booking reservation can request multiple assigned equipment items.
7. **User ↔ Notification (`1 : N`)**: A user receives individualized booking updates and security alerts.
8. **User ↔ Audit Log (`1 : N`)**: User actions and state transitions trigger immutable audit log entries.

---

## 3. Relational Integrity & Deletion Rules

- **User Deactivation**: Hard deletion of active users is restricted. Inactive accounts are marked `status: 'DEACTIVATED'` to preserve historical booking and audit references.
- **Auditorium Maintenance**: Setting `isOperational: false` prevents new bookings without deleting historical reservations.
- **Booking Cancellation**: Bookings cannot be deleted from persistent storage; status is set to `CANCELLED` with timestamps for audit compliance.
