# Entity-Relationship Diagram (ERD)

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Domain Entity Relationship Map

```mermaid
erDiagram
    USER ||--o{ BOOKING : creates
    USER }|--|| ROLE : assigned
    AUDITORIUM ||--o{ BOOKING : reserved_for
    AUDITORIUM ||--o{ EQUIPMENT : contains
    BOOKING ||--o| EVENT : hosts
    BOOKING ||--o{ APPROVAL_LOG : audited_by
    USER ||--o{ NOTIFICATION : receives

    USER {
        string _id PK
        string name
        string email
        string passwordHash
        string roleId FK
        string department
        date createdAt
    }

    AUDITORIUM {
        string _id PK
        string name
        string code
        number capacity
        string location
        boolean isOperational
    }

    EQUIPMENT {
        string _id PK
        string auditoriumId FK
        string name
        string category
        number quantity
    }

    BOOKING {
        string _id PK
        string userId FK
        string auditoriumId FK
        datetime startTime
        datetime endTime
        string status
        string purpose
    }

    EVENT {
        string _id PK
        string bookingId FK
        string title
        string description
        string bannerUrl
        boolean isPublic
    }
```

---

## 2. Entity Cardinalities & Relational Rules

1. **User ↔ Booking**: One user can submit multiple booking requests (1 : N).
2. **Auditorium ↔ Booking**: An auditorium can host multiple scheduled bookings across non-overlapping time slots (1 : N).
3. **Auditorium ↔ Equipment**: An auditorium contains multiple assigned equipment items (1 : N).
4. **Booking ↔ Event**: An approved booking may optionally host a public event (1 : 1).

---

## 3. ERD Extension & Migration Log

- [ ] Sprint 2: User & Auth ERD Refinement
- [ ] Sprint 3: Auditorium & Equipment Schema Addition
- [ ] Sprint 4: Booking Engine SlotLock Schema Addition
