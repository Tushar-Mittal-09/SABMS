# Testing Strategy & Quality Assurance

## Smart Auditorium Booking & Management System (SABMS)

---

## 1. Testing Pyramid Architecture

```text
       / \
      / E2E \       <- Playwright / Cypress E2E flows
     /-------\
    / Integration \   <- Supertest + MongoMemoryServer (API layer)
   /---------------\
  /    Unit Tests   \  <- Jest / React Testing Library (Pure functions & components)
 /-------------------\
```

---

## 2. Test Suite Classification

| Level                   | Scope                                               | Framework             | Coverage Goal     |
| :---------------------- | :-------------------------------------------------- | :-------------------- | :---------------- |
| **Unit Testing**        | Utility functions, business services, state hooks   | Jest                  | 85%+              |
| **Integration Testing** | Express API endpoints, MongoDB queries, middlewares | Jest + Supertest      | 80%+              |
| **Frontend UI Testing** | React components, User interactions                 | React Testing Library | 75%+              |
| **E2E Testing**         | Complete reservation & approval workflows           | Playwright            | Key user journeys |

---

## 3. Continuous Integration Quality Gates

1. Pre-commit hooks run ESLint and Prettier formatting checks.
2. Pull Request validation triggers automated Jest unit and integration test runs.
3. Code coverage threshold enforced at minimum 80% before merging to `main`.

---

## 4. Test Expansion Register

- [x] **Auth Module Test Specs**: Refer to [`docs/modules/authentication/TEST_CASES.md`](./modules/authentication/TEST_CASES.md)
- [ ] Auditorium Module Test Specs
- [ ] Booking Engine Concurrent Collision Test Specs
