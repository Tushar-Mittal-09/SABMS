# Database Design Specification
## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Database Architecture & Engine

- **Database Engine**: MongoDB `v7.0+`
- **Object Data Modeling (ODM)**: Mongoose `v8.x+`
- **Primary Database**: `sabms_db`
- **Storage Strategy**: Document-oriented schema design balancing normalization for core relational entities (Users, Bookings) with embedding for atomic sub-documents (Seating grids, Approval logs).

---

## 2. Collection Indexing Strategy

| Collection | Target Fields | Index Type | Business Justification |
| :--- | :--- | :--- | :--- |
| `users` | `email` | Unique | Fast authentication lookup & identity integrity. |
| `bookings` | `{ auditoriumId: 1, startTime: 1, endTime: 1 }` | Compound Index | Prevents time-slot overlapping and accelerates availability searches. |
| `bookings` | `status` | Single Field | Optimizes dashboard filtering (Pending, Approved, Rejected). |
| `events` | `{ isPublic: 1, date: 1 }` | Compound Index | Fast queries for upcoming public events calendar. |

---

## 3. Detailed Collection Schemas

### 3.1 `users` Collection Schema Placeholder
```javascript
{
  _id: ObjectId,
  name: String,
  email: String, // indexed, unique
  passwordHash: String,
  role: String, // 'ADMIN', 'MANAGER', 'ORGANIZER'
  department: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.2 `bookings` Collection Schema Placeholder
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // ref: 'User'
  auditoriumId: ObjectId, // ref: 'Auditorium'
  startTime: Date,
  endTime: Date,
  status: String, // 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  purpose: String,
  equipmentRequested: [ObjectId],
  createdAt: Date
}
```

---

## 4. Database Expansion Register

- [ ] Collection Schemas for `auditoriums` & `equipment`
- [ ] Collection Schemas for `notifications` & `audit_logs`
- [ ] MongoDB Aggregation Pipelines for Usage Analytics
