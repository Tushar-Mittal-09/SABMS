# Database Design Specification

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Database Architecture & Persistence Strategy

SABMS implements a hybrid persistence model:

- **Persistent Store**: MongoDB `v7.0+` using Mongoose ODM `v8.x+` for core business entities, relational references, and historical audit logs.
- **Ephemeral Store**: Redis `v7.x+` (`ioredis`) for high-throughput transient state, OTP verification codes, rate-limiting buckets, session indexes, and cryptographic token family tracking.

```text
┌───────────────────────────────────────┬───────────────────────────────────────┐
│         MONGODB (PERSISTENT)          │           REDIS (EPHEMERAL)           │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • User accounts & profiles            │ • 6-digit OTP verification codes      │
│ • Roles & permissions matrix          │ • OTP attempt counters & cooldowns    │
│ • Auditoriums & physical equipment    │ • Refresh token rotation families     │
│ • Bookings, approvals, & schedules    │ • Active multi-device session state   │
│ • Public events & ticketing metadata  │ • Failed login lockout counters       │
│ • Long-term security audit trails     │ • Revoked JWT access token blocklist  │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Redis Ephemeral Key Architecture & TTL Strategy

| Redis Key Pattern      | Purpose                                         | Data Type        | TTL                    |
| :--------------------- | :---------------------------------------------- | :--------------- | :--------------------- |
| `otp:email:<email>`    | Email verification OTP hash & attempt counter   | Hash / String    | 5 Minutes (`300s`)     |
| `otp:phone:<phone>`    | Phone verification OTP hash & attempt counter   | Hash / String    | 5 Minutes (`300s`)     |
| `otp:resend:<id>`      | Resend cooldown timer & rate limiter            | String / Integer | 1 Hour (`3600s`)       |
| `session:<sessionId>`  | Active session metadata & rotation state        | Hash             | 7 Days (`604800s`)     |
| `rt:family:<familyId>` | Refresh token family status & active token hash | Hash             | 7 Days (`604800s`)     |
| `lockout:<email>`      | Account lockout counter & lock flag             | Integer          | 15–30 Minutes          |
| `rl:auth:ip:<ip>`      | Authentication endpoint IP rate limiter counter | Integer          | 15 Minutes (`900s`)    |
| `bl:jti:<jti>`         | Revoked JWT access token identifier blocklist   | String           | Remaining JWT Lifetime |

---

## 3. MongoDB Collection Indexing Strategy

| Collection      | Target Fields                                   | Index Type     | Business Justification                                                |
| :-------------- | :---------------------------------------------- | :------------- | :-------------------------------------------------------------------- |
| `users`         | `email`                                         | Unique         | Fast authentication lookup & identity integrity.                      |
| `users`         | `phone`                                         | Sparse Unique  | Unique phone lookup when provided.                                    |
| `users`         | `{ role: 1, status: 1 }`                        | Compound Index | High-frequency administrative user filtering.                         |
| `bookings`      | `{ auditoriumId: 1, startTime: 1, endTime: 1 }` | Compound Index | Prevents time-slot overlapping and accelerates availability searches. |
| `bookings`      | `status`                                        | Single Field   | Optimizes dashboard filtering (`PENDING`, `APPROVED`, `REJECTED`).    |
| `bookings`      | `userId`                                        | Single Field   | Accelerates "My Bookings" query performance.                          |
| `events`        | `{ isPublic: 1, date: 1 }`                      | Compound Index | Fast queries for upcoming public events calendar.                     |
| `notifications` | `{ recipientId: 1, isRead: 1, createdAt: -1 }`  | Compound Index | Real-time notification inbox query performance.                       |
| `audit_logs`    | `{ entityId: 1, timestamp: -1 }`                | Compound Index | Historical compliance and security audit trails.                      |

---

## 4. Detailed Collection Schemas

### 4.1 `users` Collection Schema

```javascript
{
  _id: ObjectId,
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // Excluded by default from query results
  },
  role: {
    type: String,
    enum: ['STUDENT', 'FACULTY', 'CLUB_MEMBER', 'EVENT_ORGANIZER', 'VENUE_MANAGER', 'ADMIN'],
    default: 'STUDENT',
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'],
    default: 'PENDING',
    index: true
  },
  department: {
    type: String,
    trim: true,
    default: null
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 4.2 `auditoriums` Collection Schema

```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  capacity: { type: Number, required: true, min: 1 },
  location: {
    building: String,
    floor: String,
    campus: String
  },
  seatingLayout: {
    totalRows: Number,
    seatsPerRow: Number,
    grid: Array
  },
  isOperational: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 `equipment` Collection Schema

```javascript
{
  _id: ObjectId,
  auditoriumId: { type: ObjectId, ref: 'Auditorium', required: true, index: true },
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['AUDIO', 'VISUAL', 'LIGHTING', 'STAGE', 'SEATING', 'OTHER'],
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['AVAILABLE', 'MAINTENANCE', 'FAULTY'],
    default: 'AVAILABLE'
  },
  createdAt: Date
}
```

### 4.4 `bookings` Collection Schema

```javascript
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  auditoriumId: { type: ObjectId, ref: 'Auditorium', required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  purpose: { type: String, required: true, maxlength: 500 },
  expectedAttendees: { type: Number, required: true, min: 1 },
  equipmentRequested: [{ type: ObjectId, ref: 'Equipment' }],
  rejectionReason: { type: String, default: null },
  approvedBy: { type: ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 4.5 `events` Collection Schema

```javascript
{
  _id: ObjectId,
  bookingId: { type: ObjectId, ref: 'Booking', required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  bannerUrl: { type: String, default: null },
  category: { type: String, required: true },
  isPublic: { type: Boolean, default: true, index: true },
  registrationRequired: { type: Boolean, default: false },
  maxRegistrations: { type: Number, default: null },
  createdAt: Date,
  updatedAt: Date
}
```

### 4.6 `notifications` & `audit_logs` Collections

```javascript
// notifications
{
  _id: ObjectId,
  recipientId: { type: ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['BOOKING_UPDATE', 'SECURITY_ALERT', 'SYSTEM_BROADCAST'], required: true },
  title: String,
  message: String,
  isRead: { type: Boolean, default: false },
  data: Object,
  createdAt: { type: Date, default: Date.now }
}

// audit_logs
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: String,
  ipAddress: String,
  userAgent: String,
  metadata: Object,
  timestamp: { type: Date, default: Date.now, index: true }
}
```
