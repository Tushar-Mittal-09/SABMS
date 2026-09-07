# Deployment & DevOps Guide

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Environment Topology

```text
Local Dev -> Staging Environment -> Production Environment
 (Docker)       (Vercel / Render)    (AWS / GCP / K8s Cluster)
```

---

## 2. Containerization & Docker Blueprint

Both client and server workspaces are containerized using multi-stage Dockerfiles for minimal production image footprints:

- **Client Dockerfile**: Multi-stage build with Node.js builder and NGINX Alpine runtime.
- **Server Dockerfile**: Multi-stage build installing production `node_modules` only.

---

## 3. Continuous Integration & Deployment (CI/CD)

GitHub Actions pipelines defined under `.github/workflows/`:

1. **`ci.yml`**: Triggers on PR to `main` — runs `lint`, `format:check`, `npm test`, and Vite build.
2. **`cd.yml`**: Triggers on push to `main` — builds Docker images and triggers cloud deployment.

---

## 4. Operational Maintenance & Monitoring

- **Log Aggregation**: Structured JSON logs via Winston directed to stdout and file rotators (`logs/error.log`).
- **Health Checks**: Automated monitoring endpoints pinging `/health` every 30 seconds.

---

## 5. Production Environment Variables & Secrets Validation (Sprint 2.20 / M-04)

The backend boot pipeline enforces strict environment validation via Zod in `server/src/config/env.config.js`. In `production` (`NODE_ENV === 'production'`), the server fails fast on boot if default or insecure secrets are detected:

| Variable             | Requirement in Production     | Description                                                 |
| :------------------- | :---------------------------- | :---------------------------------------------------------- |
| `NODE_ENV`           | Must be `'production'`        | Enables strict cookie flags, HSTS, trust proxy (1)          |
| `PORT`               | Required (Default: `5000`)    | Server HTTP listening port                                  |
| `CLIENT_URL`         | Required valid URL            | Canonical frontend origin for strict CORS whitelisting      |
| `MONGODB_URI`        | Required MongoDB URI          | Persistent database cluster connection string               |
| `REDIS_URL`          | Required Redis URI            | Ephemeral store for OTP, rate limiting, and session caching |
| `JWT_ACCESS_SECRET`  | Required string (>= 32 chars) | Dedicated signing secret for short-lived access tokens      |
| `JWT_REFRESH_SECRET` | Required string (>= 32 chars) | Dedicated signing secret for long-lived refresh tokens      |
| `COOKIE_SECRET`      | Required string (>= 32 chars) | Secret for signing double-submit CSRF tokens                |
| `OTP_HASH_SECRET`    | Required string (>= 32 chars) | Secret for HMAC-SHA256 hashing of OTP codes in Redis        |

> [!CAUTION]
> Production boot strictly rejects default placeholders such as `dev-jwt-access-secret-key...`, `dev-cookie-secret...`, or secrets shorter than 32 characters.

### 5.1 Cookie & Network Configuration

- **Refresh Token Cookie**: Issued with attributes: `HttpOnly`, `SameSite=Strict`, `Secure: true` (in production), and `Path=/api/v1/auth`. Reverse proxies must route all `/api/v1/auth/*` requests to the Express backend.
- **CSRF Double-Submit Cookie**: Issued as `XSRF-TOKEN` with `SameSite=Strict`, `httpOnly: false`, `Secure: true` (in production), and `Path=/`.
- **CORS Allowed Origins**: Strict whitelist configured via `CLIENT_URL`; wildcard origins (`*`) are prohibited when credentials are enabled.

---

## 6. Deployment Checklist Register

- [x] Production Environment Variables Checklist (Validated via Zod `.superRefine()`)
- [x] Cookie Path Scoping (`Path=/api/v1/auth` verified in integration tests)
- [x] Zero In-Code Fallback Secrets in Production
- [x] Anti-Caching Headers active on `/api/v1/auth/*`
- [ ] Database Replication & Backup Runbook
- [ ] Domain Name & SSL Certificate Configuration (TLS 1.3 mandated)
