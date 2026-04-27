# Backend Audit Report - InsightO

## Scope Audited

- `package.json`
- `tsconfig.json`
- Entire TypeScript backend tree (`modules`, `middlewares`, `utils`, `config`, `app.ts`, `server.ts`)
- Note: there is no `src` folder in this repository snapshot; code is organized from project root.

---

## 🟢 Fully Implemented & Working

- Auth core flows exist: Register, OTP verify, Login, Forgot Password, Reset Password, and Profile route.
- OTP + email integration is implemented via Nodemailer utility.
- OTP expiration handling is implemented in verification logic.
- Global JWT auth guard exists (`protect`) and is used.
- Role-based access middleware exists (`authorizeRoles`) and is used.
- Global error handler exists and is mounted at app level.
- Core schemas implemented: `User`, `PendingUser`, `Form`, `Question`, `Submission`.

---

## 🟡 Partially Implemented (WIP)

- Architecture is hybrid, not strictly one style:
  - Feature domains under `modules/*`
  - Cross-cutting layered concerns under `middlewares`, `utils`, `config`
- Dev tooling partially aligned:
  - `ts-node-dev` is installed but not used in scripts.
  - Current dev script uses `tsx watch server.ts`.
- Dependency overlap exists:
  - Both `bcrypt` and `bcryptjs` are installed.
  - Auth code currently uses `bcryptjs`.
- User role model and route guards are inconsistent:
  - Schema enum uses `HEAD_OF_DEP`
  - Route guards check `"HOD"`
- Question routes are implemented in a route file but not mounted in `app.ts`.
- Submission unique index is incomplete relative to target:
  - Current: `(form_id, evaluator_id)`
  - Target requested: `(form_id, evaluator_id, subject_id)`

### Current `package.json` scripts

- `id: "dev-script"` (non-standard script key; effectively metadata/no-op)
- `dev: "tsx watch server.ts"`

### Active API Endpoints currently exposed

- `GET /health`
- `POST /api/register`
- `POST /api/register/verify`
- `POST /api/login`
- `POST /api/forgotPassword`
- `PATCH /api/resetPassword`
- `GET /api/profile`
- `POST /api/v1/form/`
- `GET /api/v1/form/`
- `GET /api/v1/form/:id`
- `DELETE /api/v1/form/:id`
- `PATCH /api/v1/form/:id/settings`
- `POST /api/forms/:formId/submissions`
- `POST /api/upload/`

### Implemented Schemas and Core Fields (Audit Summary)

- **User**
  - Core fields: `firstName`, `lastName`, `email`, `password`, `role`, `nationalId`
  - Conditional fields: `departmentId` (required when role is not ADMIN), `academicYear` (required when role is STUDENT)
  - Security/account fields: `isVerified`, `otp`, `otpExpires`
- **PendingUser**
  - Temporary registration record including OTP and expiry fields
- **Form**
  - Includes `evaluator_roles`, `subject_role`, `questions`, `creator_id`, `department_id`, flags
- **Question**
  - Includes `type`, `order`, `label`, `required`, `options`, `file_config`
- **Submission**
  - Includes `form_id`, `evaluator_id`, `subject_id`, `answers[]`

---

## 🔴 Missing Entirely

- `Question.ai_tag` field is not implemented.
- Submission compound unique index `(form_id, evaluator_id, subject_id)` is not implemented.
- `Task` schema not found.
- `TaskSubmission` schema not found.
- `Department` schema not found (only referenced by `ref: 'Department'` in other schemas).

---

## 📝 Architectural Notes / Red Flags

- Requested `src`-focused architecture does not match current repo shape (root-organized modules).
- Role naming drift (`HEAD_OF_DEP` vs `HOD`) can break RBAC behavior.
- JWT fallback secret (`fallback_secret`) is used when env var is missing; risky for production.
- Mixed naming conventions (`departmentId` vs `department_id`) can cause API/model inconsistency.
- Duplicate or unused dependencies/scripts increase maintenance noise (`bcrypt` + `bcryptjs`, installed `ts-node-dev` not used).
- Question routes are currently unreachable unless mounted in `app.ts`.

---

## Appendix: Requested Checks (Pass/Fail Snapshot)

### 1) Architecture & Environment

- Feature-based only structure: **No** (hybrid)
- Scripts reviewed: **Yes**
- `ts-node-dev` actively used: **No**
- Conflicting/redundant deps check (`bcrypt` vs `bcryptjs`): **Yes (both present)**

### 2) Database Models (Mongoose)

- `User` has conditional fields and target roles: **Partially**
  - Conditional fields: **Yes** (`departmentId`, `academicYear`)
  - Roles: **Partially** (`ADMIN`, `HEAD_OF_DEP`, `INSTRUCTOR`, `STUDENT`) vs requested (`ADMIN`, `HOD`, `INSTRUCTOR`, `STUDENT`)
- `Form` has `evaluator_roles`, `subject_role`, `questions`: **Yes**
- `Question` has `type`, `order`, `ai_tag`: **Partially** (`type` and `order` yes, `ai_tag` missing)
- `Submission` unique index `[form_id, evaluator_id, subject_id]`: **No**
- `Task`, `TaskSubmission`, `Department` schemas implemented: **No**

### 3) Authentication & Security

- Register/Login implemented: **Yes**
- OTP via Nodemailer with expiration handling: **Yes**
- Global middlewares (JWT guard, error handler, RBAC): **Yes**

### 4) Routes & Controllers

- Active API endpoints listed: **Yes**

