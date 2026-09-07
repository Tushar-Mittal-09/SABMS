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

| Redis Key Pattern                 | Purpose                                       | Data Type     | TTL                 | Policy / Invariants                            |
| :-------------------------------- | :-------------------------------------------- | :------------ | :------------------ | :--------------------------------------------- |
| `auth:otp:email:<email>`          | Email verification OTP HMAC hash              | String (JSON) | 10 Minutes (`600s`) | CSPRNG 6-digit; plaintext never logged/stored  |
| `auth:otp:email:attempts:<email>` | Email OTP failed attempts counter             | Integer       | Matches parent OTP  | Atomic Redis `INCR`; invalidated at 5 attempts |
| `auth:otp:cooldown:<email>`       | Email OTP resend cooldown timer               | Integer       | 60 Seconds (`60s`)  | Prevents rapid consecutive resends             |
| `auth:otp:resend:<email>`         | Email OTP resend frequency counter            | Integer       | 1 Hour (`3600s`)    | Capped at 5 resends per hour                   |
| `auth:otp:phone:<phone>`          | Phone verification OTP HMAC hash              | String (JSON) | 10 Minutes (`600s`) | Isolated Redis key; E.164 formatted target     |
| `auth:otp:phone:attempts:<phone>` | Phone OTP failed attempts counter             | Integer       | Matches parent OTP  | Atomic Redis `INCR`; invalidated at 5 attempts |
| `auth:otp:phone:cooldown:<phone>` | Phone OTP resend cooldown timer               | Integer       | 60 Seconds (`60s`)  | Prevents SMS bombing                           |
| `auth:otp:phone:resend:<phone>`   | Phone OTP resend frequency counter            | Integer       | 1 Hour (`3600s`)    | Capped at 5 resends per hour                   |
| `auth:otp:reset:<email>`          | Password reset OTP HMAC hash                  | String (JSON) | 5 Minutes (`300s`)  | Zero-enumeration recovery; deleted upon reset  |
| `auth:otp:reset:attempts:<email>` | Password reset OTP failed attempts counter    | Integer       | Matches parent OTP  | Atomic Redis `INCR`; invalidated at 5 attempts |
| `auth:otp:reset:cooldown:<email>` | Password reset resend cooldown timer          | Integer       | 60 Seconds (`60s`)  | Enforced for both valid and invalid emails     |
| `auth:otp:reset:rate:<email>`     | Password reset hourly request limit           | Integer       | 1 Hour (`3600s`)    | Max 3 requests per hour                        |
| `auth:session:<familyId>`         | Active session snapshot & device cache        | Hash / JSON   | 7 Days (`604800s`)  | Tied to refresh token family lifecycle         |
| `lockout:<email>`                 | Account lockout attempt counter & flag        | Integer       | 15 Minutes (`900s`) | 5 consecutive failed logins = 15m lockout      |
| `rl:reg:<ip>`                     | Public registration IP rate limiter           | Integer       | 1 Hour (`3600s`)    | Max 10 registration attempts per hour per IP   |
| `rl:auth:ip:<ip>`                 | Global authentication IP rate limiter         | Integer       | 15 Minutes (`900s`) | Max 100 requests per 15 minutes per IP         |
| `bl:jti:<jti>`                    | Revoked JWT access token identifier blocklist | String        | Remaining JWT TTL   | Ephemeral blocklist for immediate token revoke |

### 2.1 Atomic OTP Counter Mechanism

To prevent Time-of-Check to Time-of-Use (TOCTOU) race conditions during concurrent OTP submissions, attempt tracking is decoupled from the stored hash payload and executed via atomic Redis operations:

1. **Atomic Increment**: Failed attempts invoke `redis.incr(attemptsKey)` in `auth.repository.js`. Redis guarantees single-threaded atomic increments without read-modify-write race conditions.
2. **TTL Synchronization**: On the first failed attempt (`attempts === 1`), the system retrieves the remaining TTL of the parent OTP key (`redis.ttl(key)`) and synchronizes the attempt counter's expiration via `redis.expire(attemptsKey, ttl)`.
3. **Threshold Enforcement & Clean Eviction**: If `attempts >= 5`, the active OTP record and attempts key are atomically deleted (`redis.del(key, attemptsKey)`), immediately invalidating the code.
4. **Successful Verification**: Upon valid match, both keys are cleared immediately to guarantee single-use validity.

---

## 3. MongoDB Collection Indexing Strategy

| Collection       | Target Fields                                   | Index Type     | Business Justification                                                |
| :--------------- | :---------------------------------------------- | :------------- | :-------------------------------------------------------------------- |
| `users`          | `email`                                         | Unique         | Fast authentication lookup & identity integrity.                      |
| `users`          | `phone`                                         | Sparse Unique  | Unique phone lookup when provided; permits multiple nulls.            |
| `users`          | `{ role: 1, status: 1 }`                        | Compound Index | High-frequency administrative user filtering.                         |
| `refresh_tokens` | `jti`                                           | Unique         | Primary cryptographic token lookup; prevents token collisions.        |
| `refresh_tokens` | `familyId`                                      | Single Field   | Rapid token family revocation during logout or reuse detection.       |
| `refresh_tokens` | `userId`                                        | Single Field   | Rapid multi-device session listing and user-wide revocation.          |
| `refresh_tokens` | `status`                                        | Single Field   | Filtering active vs consumed/revoked tokens.                          |
| `refresh_tokens` | `{ familyId: 1, status: 1 }`                    | Compound Index | Optimized atomic token consumption and rotation queries.              |
| `refresh_tokens` | `{ userId: 1, status: 1 }`                      | Compound Index | Accelerated active session management queries.                        |
| `refresh_tokens` | `{ userId: 1, status: 1, expiresAt: 1 }`        | Compound Index | Efficient query evaluation for valid non-expired user sessions.       |
| `refresh_tokens` | `expiresAt`                                     | Single Field   | Automated cleanup and TTL expiration evaluation.                      |
| `refresh_tokens` | `deviceHash`                                    | Single Field   | Device fingerprint validation during token refresh.                   |
| `bookings`       | `{ auditoriumId: 1, startTime: 1, endTime: 1 }` | Compound Index | Prevents time-slot overlapping and accelerates availability searches. |
| `bookings`       | `status`                                        | Single Field   | Optimizes dashboard filtering (`PENDING`, `APPROVED`, `REJECTED`).    |
| `bookings`       | `userId`                                        | Single Field   | Accelerates "My Bookings" query performance.                          |
| `events`         | `{ isPublic: 1, date: 1 }`                      | Compound Index | Fast queries for upcoming public events calendar.                     |
| `notifications`  | `{ recipientId: 1, isRead: 1, createdAt: -1 }`  | Compound Index | Real-time notification inbox query performance.                       |
| `audit_logs`     | `{ entityId: 1, timestamp: -1 }`                | Compound Index | Historical compliance and security audit trails.                      |

---

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

### 4.2 `refresh_tokens` Collection Schema (`refresh-token.model.js`)

The `refresh_tokens` collection stores persistent session tokens, cryptographic rotation lineage, and device fingerprints for token family revocation:

```javascript
{
  _id: ObjectId,
  jti: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  familyId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  userId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CONSUMED', 'REVOKED', 'REUSED'],
    default: 'ACTIVE',
    required: true,
    index: true
  },
  issuedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  consumedAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    default: null
  },
  replacedByTokenId: {
    type: String,
    default: null
  },
  reuseDetectedAt: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    default: null,
    trim: true
  },
  userAgent: {
    type: String,
    default: null,
    trim: true
  },
  deviceHash: {
    type: String,
    default: null,
    trim: true,
    index: true
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 `auditoriums` Collection Schema

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

### 4.4 `equipment` Collection Schema

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

### 4.5 `bookings` Collection Schema

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

### 4.6 `events` Collection Schema

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

### 4.7 `notifications` & `audit_logs` Collections

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
