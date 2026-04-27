# InsightO Backend - Full Handoff Report

Generated: 2026-04-27

## 1) Current Architecture Snapshot

- Language/Runtime: TypeScript + Node.js (ESM).
- Web framework: Express `5.2.1`.
- DB layer: Mongoose `9.4.1`.
- Validation: Zod.
- Structure style: **Hybrid**
  - Feature modules under `modules/*` (auth, form, question, submission, profile, department, course).
  - Shared layered concerns under `middlewares`, `utils`, `config`.
- Important: repository currently does **not** use a `src` root; code is organized at project root.

## 2) Environment & Build Tooling

### package scripts

- `id: "dev-script"` (non-standard script key; metadata-like/no-op)
- `dev: "tsx watch server.ts"`

### TypeScript config

- `module`: `nodenext`
- `target`: `ES2022`
- `strict`: `true`
- `rootDir`: `./`
- `outDir`: `./dist`

### Dependency notes

- Both `bcrypt` and `bcryptjs` are installed; auth code uses `bcryptjs`.
- `ts-node-dev` is installed but not used in scripts.
- `@types/multer` has been added and upload typing issues were fixed.

## 3) Core Runtime Wiring

### app bootstrap

- `app.ts` mounts:
  - `/api/` -> auth routes
  - `/api/v1/form` -> form routes
  - `/api/forms` -> submission routes
  - `/api/upload` -> upload routes
- Static files:
  - `/uploads` served from `UPLOAD_DIR` (shared from multer config).
- Global error handler is mounted.

### server bootstrap

- DB connection runs from `server.ts`.
- Express 5 catch-all route was fixed from `app.all("*", ...)` to `app.all(/.*/, ...)` to avoid `path-to-regexp` crash.

## 4) Database Model Status

## Auth Domain

### `User` (refactored to core auth identity)

- Fields now: `firstName`, `lastName`, `email`, `password`, `nationalId`, `role`, `isActive`, `isVerified`, `otp`, `otpExpires`.
- Removed from `User`: `departmentId`, `academicYear`, and extra profile-related data.

### `PendingUser` (refactored for approval pipeline)

- Stores registration waiting state:
  - identity: `firstName`, `lastName`, `email`, `password`, `nationalId`, `role`
  - otp state: `otp`, `otpExpires`, `otpVerified`
  - approval state: `approvalStatus` (`PENDING_OTP`, `PENDING_ADMIN_APPROVAL`, `APPROVED`, `REJECTED`)
- TTL/expiry window expanded to keep pending records long enough for admin approval flow.

## New Profile Pattern (1:1 with User)

### `StudentProfile`

- `userId` (ref User, unique)
- `academicYear` (required)
- `enrolledCourses` (array of Course refs)

### `InstructorProfile`

- `userId` (ref User, unique)
- `departmentId` (ref Department, required)
- `teachingCourses` (array of Course refs)

### `HODProfile`

- `userId` (ref User, unique)
- `departmentId` (ref Department, required)

## New Academic Domain Models

### `Department`

- `name` (required)
- `code` (unique)
- `description`
- timestamps enabled

### `Course`

- `name` (required)
- `courseCode` (required, unique)
- `departmentId` (ref Department, required)
- `instructorId` (ref User, required)
- `credits`
- timestamps enabled

## Existing Evaluation Models

- `Form` model exists and includes `evaluator_roles`, `subject_role`, `questions`.
- `Question` model exists with `type`, `order`, etc. (`ai_tag` still not implemented).
- `Submission` model exists; current unique index is `(form_id, evaluator_id)` (not triple key with `subject_id`).

## 5) Auth & Approval Flow (Current Behavior)

### Register

- Creates `PendingUser` only (no profile creation).
- Generates OTP and sends email.

### OTP Verify

- Verifies OTP on pending user.
- Moves state to `PENDING_ADMIN_APPROVAL`.
- Does **not** create final `User` immediately anymore.

### Admin Approval (new)

- Endpoint added: `POST /api/admin/pending/:pendingUserId/approve`
- Guarded by `protect` + `authorizeRoles('ADMIN')`.
- Validation logic:
  - STUDENT approval requires `academicYear`.
  - INSTRUCTOR/HOD approval requires `departmentId`.
- On approval transaction:
  1. create `User`
  2. create the correct profile document linked by `userId`
  3. remove pending record

## 6) API Endpoint Inventory (currently mounted)

### Health

- `GET /health`

### Auth

- `POST /api/register`
- `POST /api/register/verify`
- `POST /api/login`
- `POST /api/forgotPassword`
- `PATCH /api/resetPassword`
- `GET /api/profile`
- `POST /api/admin/pending/:pendingUserId/approve` (ADMIN)

### Forms

- `POST /api/v1/form/`
- `GET /api/v1/form/`
- `GET /api/v1/form/:id`
- `DELETE /api/v1/form/:id`
- `PATCH /api/v1/form/:id/settings`

### Submissions

- `POST /api/forms/:formId/submissions`

### Uploads

- `POST /api/upload/`

## 7) Security & Middleware Status

- JWT auth middleware exists and is used.
- Role-based authorization middleware exists and is used on critical routes.
- Global error handler exists and is mounted.
- Upload route now handles Multer errors (size/type) with clean 400 responses.
- Static upload serving is correctly wired to the same configured upload directory.

## 8) Known Risks / Follow-up Items

- Role naming legacy:
  - `utils/User.ts` now aliases `HEAD_OF_DEP` to `HOD` to reduce breakage.
  - Team should standardize all code/DB to one role token (`HOD`).
- Validation schema alignment:
  - `userValidation` and request DTO rules should be updated to match new approval-based flow.
- Duplicate dependencies:
  - choose one hashing package (`bcryptjs` currently used).
- Questions routes:
  - question routing file exists in codebase but may still not be mounted in `app.ts`.
- Submission uniqueness:
  - if product requires one submission per `(form, evaluator, subject)`, update unique index accordingly.

## 9) Files Added/Updated in this refactor track

### Added

- `modules/profile/model/StudentProfile.ts`
- `modules/profile/model/InstructorProfile.ts`
- `modules/profile/model/HODProfile.ts`
- `modules/department/model/Department.ts`
- `modules/course/model/Course.ts`
- `BACKEND_HANDOFF_REPORT.md`

### Updated

- `modules/auth/model/User_Schema.ts`
- `modules/auth/model/PendingUser.TS`
- `modules/auth/controller/authController.ts`
- `modules/auth/routes/authRoutes.ts`
- `utils/User.ts`
- `utils/upload/multerConfig.ts`
- `utils/upload/uploadRoutes.ts`
- `app.ts`
- `server.ts`
- `package.json` (dev dependency update: `@types/multer`)

