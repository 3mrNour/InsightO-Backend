# Project Logic Documentation

This document explains the core logic and flow for the main modules in the project: **Auth**, **Form**, and **Question**.

---

## Pending User Logic

A **Pending User** is a user who has started the registration process but has not yet completed OTP verification. The system handles pending users as follows:

- When a user registers, their data is validated. If valid, a user record is created in the database with `isVerified: false` and an OTP is generated and sent to their email.
- While `isVerified` remains `false`, the user is considered "pending" and cannot log in or access protected resources.
- Only after successful OTP verification is `isVerified` set to `true`, and the user becomes fully active.
- If the OTP expires or is never verified, the user remains in the pending state. You may implement periodic cleanup of unverified users if needed.
- No sensitive actions (login, form creation, etc.) are allowed for pending users.

---

## 1. Auth Module

### Registration Flow
- **Validation:** Incoming registration data is validated (using Zod schemas) for required fields (name, email, password, role, etc.).
- **User Existence Check:** If the email is already registered, the process stops with an error.
- **User Creation:**
  - If validation passes, a new user is created in the database with `isVerified: false`.
  - The password is hashed before saving.
- **OTP Generation:**
  - An OTP is generated and stored in the user document with an expiry time.
  - The OTP is sent to the user's email.
- **OTP Verification:**
  - The user submits the OTP to verify their account.
  - If the OTP is valid and not expired, `isVerified` is set to `true` and a JWT token is generated and returned.
- **Login:**
  - Users can log in with email and password (only if `isVerified: true`).
  - On successful login, a JWT token is generated and returned.

### Security Notes
- If any required parameter is missing or invalid, the user is **not** created in the database.
- OTP and verification logic ensure only valid users can activate their accounts.

---

## 2. Form Module

### Form Creation
- **Validation:** Only authenticated users with roles `ADMIN`, `HOD`, or `INSTRUCTOR` can create forms. Input is validated for required fields (title, evaluator roles, subject role, etc.).
- **Form Storage:**
  - A new form is created with the provided data and the creator's user ID.
  - The form is saved in the database.

### Form Management
- **Get All Forms:** Authenticated users can retrieve all forms they have created.
- **Get Form by ID:**
  - Only the creator of the form can access its details.
  - The form must be active.
- **Delete Form:**
  - Only the creator (with proper role) can delete a form.
  - Deleting a form also deletes all its associated questions.
- **Update Form Settings:**
  - Only allowed for users with the right roles.

---

## 3. Question Module

### Question Creation
- **Validation:** Only authenticated users with roles `ADMIN`, `HOD`, or `INSTRUCTOR` can add questions to a form.
- **Ownership Check:** Only the creator of the form can add questions to it.
- **Question Storage:**
  - A new question is created and linked to the form.
  - The form's `questions` array is updated with the new question's ID.

### Question Management
- **Get Questions:** Retrieve all questions for a specific form, sorted by order.
- **Update Question:** Update question details (partial updates allowed).
- **Delete Question:**
  - Only allowed for users with the right roles.
  - Deleting a question removes it from the form's `questions` array.
- **Reorder Questions:** Bulk update the order of questions within a form.

---

## Data Models (Summary)

### User
- Fields: firstName, lastName, email, password, role, isVerified, otp, otpExpires, etc.

### Form
- Fields: title, description, creator_id, evaluator_roles, subject_role, questions, is_anonymous, is_active, department_id, timestamps

### Question
- Fields: form_id, label, type (short_text, long_text, linear_scale, multiple_choice), required, options, order, timestamps

---

## Notes
- All routes are protected by authentication and role-based authorization where appropriate.
- Validation is enforced at both the middleware and model levels.
- Error handling is consistent using a custom `AppError` utility.

---

For more details, see the respective controller, route, and model files in each module.
