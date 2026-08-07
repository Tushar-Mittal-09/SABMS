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

## 5. Deployment Checklist Register

- [ ] Production Environment Variables Checklist
- [ ] Database Replication & Backup Runbook
- [ ] Domain Name & SSL Certificate Configuration
