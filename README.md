# Smart Auditorium Booking & Management System (SABMS)

> A Production-Grade, Enterprise-Level Auditorium Booking & Event Management System built on a **Modular Monolith Architecture** using the **MERN Stack** (MongoDB, Express, React, Node.js).

---

## 🏛️ Project Overview

**SABMS** is designed to streamline reservation workflows, scheduling, seat allocation, equipment request management, and real-time status tracking for institutional and commercial auditoriums.

The system adopts a **Modular Monolith Architecture** to maintain domain encapsulation and clear boundaries while minimizing operational overhead during initial deployment stages. Each core domain (e.g., Auth, Auditorium, Booking, Event, Notification) is structured as an isolated module ready to be extracted into microservices if high scalability demands arise in the future.

---

## 📁 Repository Structure

```text
SABMS/
├── .github/                  # GitHub configuration & workflows
│   ├── ISSUE_TEMPLATE/       # GitHub issue templates
│   ├── workflows/            # CI/CD GitHub Actions pipelines
│   └── PULL_REQUEST_TEMPLATE.md
├── client/                   # Frontend React Application
├── server/                   # Backend Node.js / Express Application
├── docs/                     # System architecture & API documentation
├── scripts/                  # Automation, setup & database seed scripts
├── .gitignore                # Global Git ignore patterns
├── LICENSE                   # Software License (MIT)
└── README.md                 # Root System Documentation
```

---

## 📂 Directory Taxonomy & Purpose

| Directory      | Purpose                   | Enterprise Role                                                                                                    |
| :------------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| **`client/`**  | Web Client Application    | Houses the user interface, page routes, state management, components, and static assets.                           |
| **`server/`**  | Core Application Server   | Houses HTTP server, REST APIs, domain services, database schemas, and business logic organized in bounded modules. |
| **`docs/`**    | System Documentation      | Architectural Decision Records (ADRs), ER diagrams, API schemas, and deployment guides.                            |
| **`scripts/`** | Utility & Tooling Scripts | Database seeds, migrations, environment setup scripts, and administrative CLI tools.                               |
| **`.github/`** | Repository Governance     | Automation workflows, pull request templates, issue templates, and CI/CD pipelines.                                |

---

## 🧱 Architectural Philosophy: Modular Monolith

The backend application (`server/`) strictly adheres to **Modular Monolith** principles:

- **Module Encapsulation**: Every business domain (e.g., `auditorium`, `booking`, `billing`, `user`) operates within its own self-contained folder containing its routes, controllers, services, models, and DTOs.
- **Strict Interfaces**: Cross-module communication occurs exclusively through explicit public service interfaces or internal event buses.
- **Zero Cross-Module Leakage**: Controllers in Module A cannot directly import database models of Module B.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` LTS or higher
- **npm**: `v10.x` or higher
- **MongoDB**: `v7.0` or higher
- **Git**: `v2.40` or higher

### Local Repository Setup

```bash
# 1. Clone repository
git clone https://github.com/organization/SABMS.git
cd SABMS

# 2. Workspace Initialization (Sprint 1 Roadmap)
# Dependencies and env files will be introduced in subsequent steps.
```

---

## 🛡️ Enterprise Guidelines & Conventions

- **Branch Naming**: `feature/<feature-name>`, `bugfix/<fix-name>`, `chore/<task-name>`, `hotfix/<issue-name>`
- **Commit Format**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`)
- **Code Style**: ESLint + Prettier enforcement across client & server workspaces.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more details.
