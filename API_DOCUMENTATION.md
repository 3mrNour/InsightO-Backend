# InsightO Backend API Documentation

**Version:** 1.0  
**Base URL:** `http://localhost:5000/api`  
**Documentation for Frontend Team**

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Form Builder Endpoints](#form-builder-endpoints)
3. [Question Endpoints](#question-endpoints)
4. [Submission Endpoints](#submission-endpoints)
5. [Department Endpoints](#department-endpoints)
6. [User Administration Endpoints](#user-administration-endpoints)
7. [Utility Endpoints](#utility-endpoints)
8. [Error Handling](#error-handling)
9. [Data Types Reference](#data-types-reference)

---

## Authentication Endpoints

### 1. Register User - Step 1
**POST** `/register`

**Description:** Register a new user and send OTP to email

**Request Body:**
```json
{
  "firstName": "Ahmed",
  "lastName": "Hassan",
  "email": "ahmed@example.com",
  "password": "SecurePass123",
  "nationalId": "12345678901234",
  "role": "STUDENT",
  "departmentId": "507f1f77bcf86cd799439011",
  "academicYear": 2024
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "message": "Step 1 complete. OTP sent to your email",
  "email": "ahmed@example.com"
}
```

**Validation Rules:**
- firstName, lastName: min 2 characters
- email: valid email format, unique
- password: min 8 characters
- nationalId: exactly 14 digits
- role: ADMIN | HOD | INSTRUCTOR | STUDENT

---

### 2. Verify Registration OTP - Step 2
**POST** `/register/verify`

**Description:** Verify OTP and complete registration (account pending admin approval)

**Request Body:**
```json
{
  "email": "ahmed@example.com",
  "otp": "123456"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "OTP verified successfully. Your account is pending admin approval."
}
```

**Validation Rules:**
- OTP: 6 digits
- OTP validity: 10 minutes from registration
- Email must exist in PendingUser collection

---

### 3. User Login
**POST** `/login`

**Description:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "email": "ahmed@example.com",
  "password": "SecurePass123"
}
```

**Response (Success - 200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "email": "ahmed@example.com",
    "role": "STUDENT"
  }
}
```

**Headers (for subsequent requests):**
```
Authorization: Bearer <token>
```

**Token Validity:** 7 days

---

### 4. Forgot Password
**POST** `/forgotPassword`

**Description:** Request password reset and send OTP to email

**Request Body:**
```json
{
  "email": "ahmed@example.com"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "OTP sent to your email",
  "email": "ahmed@example.com"
}
```

---

### 5. Reset Password
**PATCH** `/resetPassword`

**Description:** Reset password using OTP

**Request Body:**
```json
{
  "email": "ahmed@example.com",
  "password": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Congratulations! Your password has been changed successfully."
}
```

**Validation Rules:**
- password === confirmPassword
- password: min 8 characters
- Requires valid OTP verification middleware

---

### 6. Get User Profile
**GET** `/profile`

**Auth Required:** Yes (Bearer Token)

**Description:** Get authenticated user's profile information

**Response (Success - 200):**
```json
{
  "status": "success",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "email": "ahmed@example.com",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2024-04-20T10:30:00Z",
    "updatedAt": "2024-04-20T10:30:00Z"
  }
}
```

---

### 7. Approve Pending User Registration
**POST** `/admin/pending/:pendingUserId/approve`

**Auth Required:** Yes (ADMIN role only)

**Description:** Admin approves a pending user and creates their profile

**Request Body:**
```json
{
  "departmentId": "507f1f77bcf86cd799439012",
  "academicYear": 2024
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Hassan",
      "email": "ahmed@example.com",
      "role": "STUDENT",
      "isActive": true,
      "departmentId": "507f1f77bcf86cd799439012",
      "academicYear": 2024
    }
  }
}
```

**Note:**
- departmentId: required for all roles
- academicYear: required for STUDENT role
- Creates role-specific profile (StudentProfile, InstructorProfile, or HODProfile)

---

### 8. Get Pending Users
**GET** `/admin/pending-users`

**Auth Required:** Yes (ADMIN role only)

**Description:** Get list of users pending admin approval

**Response (Success - 200):**
```json
{
  "status": "success",
  "results": 3,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Hassan",
      "email": "ahmed@example.com",
      "role": "STUDENT",
      "nationalId": "12345678901234",
      "departmentId": "507f1f77bcf86cd799439012",
      "otpVerified": true,
      "createdAt": "2024-04-20T10:30:00Z"
    }
  ]
}
```

---

## Form Builder Endpoints

### 9. Create Form
**POST** `/v1/form/`

**Auth Required:** Yes (ADMIN | HOD | INSTRUCTOR)

**Description:** Create a new evaluation form

**Request Body:**
```json
{
  "title": "Student Performance Evaluation",
  "description": "Evaluate student performance in the course",
  "evaluator_roles": ["STUDENT"],
  "subject_role": "INSTRUCTOR",
  "is_anonymous": false,
  "is_active": true,
  "department_id": "507f1f77bcf86cd799439012"
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "title": "Student Performance Evaluation",
    "description": "Evaluate student performance in the course",
    "creator_id": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Dr.",
      "lastName": "Smith"
    },
    "evaluator_roles": ["STUDENT"],
    "subject_role": "INSTRUCTOR",
    "questions": [],
    "is_anonymous": false,
    "is_active": true,
    "department_id": "507f1f77bcf86cd799439012",
    "createdAt": "2024-04-20T10:30:00Z",
    "updatedAt": "2024-04-20T10:30:00Z"
  }
}
```

**Validation Rules:**
- title: 5-100 characters
- description: max 500 characters
- evaluator_roles: array, min 1 element
- subject_role cannot be in evaluator_roles

---

### 10. Get All User Forms
**GET** `/v1/form/`

**Auth Required:** Yes

**Description:** Get all forms created by authenticated user

**Response (Success - 200):**
```json
{
  "status": "success",
  "count": 2,
  "data": [
    {
      "id": "507f1f77bcf86cd799439013",
      "title": "Student Performance Evaluation",
      "description": "Evaluate student performance in the course",
      "creator_id": {
        "id": "507f1f77bcf86cd799439011",
        "firstName": "Dr.",
        "lastName": "Smith"
      },
      "evaluator_roles": ["STUDENT"],
      "subject_role": "INSTRUCTOR",
      "questions": [
        {
          "id": "507f1f77bcf86cd799439014",
          "label": "Overall Performance",
          "type": "linear_scale",
          "required": true,
          "order": 1
        }
      ],
      "is_anonymous": false,
      "is_active": true,
      "createdAt": "2024-04-20T10:30:00Z"
    }
  ]
}
```

---

### 11. Get Form by ID
**GET** `/v1/form/:id`

**Auth Required:** Yes

**Description:** Get detailed information about a specific form

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "title": "Student Performance Evaluation",
    "description": "Evaluate student performance in the course",
    "creator_id": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Dr.",
      "lastName": "Smith",
      "email": "dr.smith@university.edu"
    },
    "evaluator_roles": ["STUDENT"],
    "subject_role": "INSTRUCTOR",
    "questions": [
      {
        "id": "507f1f77bcf86cd799439014",
        "label": "Overall Performance",
        "description": "Rate the overall performance",
        "type": "linear_scale",
        "required": true,
        "scale": { "min": 1, "max": 5 },
        "order": 1
      },
      {
        "id": "507f1f77bcf86cd799439015",
        "label": "Teaching Method",
        "description": "Rate the teaching method",
        "type": "multiple_choice",
        "required": true,
        "options": ["Excellent", "Good", "Average", "Poor"],
        "order": 2
      }
    ],
    "is_anonymous": false,
    "is_active": true,
    "department_id": "507f1f77bcf86cd799439012",
    "createdAt": "2024-04-20T10:30:00Z"
  }
}
```

**Error Responses:**
- 404: Form not found
- 403: Form is not active / User doesn't own this form

---

### 12. Delete Form
**DELETE** `/v1/form/:id`

**Auth Required:** Yes (ADMIN | HOD)

**Description:** Delete a form and all associated questions

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Form deleted successfully"
}
```

**Error Responses:**
- 404: Form not found
- 403: Unauthorized

---

### 13. Update Form Settings
**PATCH** `/v1/form/:id/settings`

**Auth Required:** Yes (ADMIN | HOD | INSTRUCTOR)

**Description:** Update form title, description, status, and anonymity

**Request Body:**
```json
{
  "title": "Updated Form Title",
  "description": "Updated description",
  "is_active": false,
  "is_anonymous": true
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "title": "Updated Form Title",
    "description": "Updated description",
    "is_active": false,
    "is_anonymous": true,
    "updatedAt": "2024-04-20T11:45:00Z"
  }
}
```

**Note:** All fields in request body are optional

---

## Question Endpoints

### 14. Create Question
**POST** `/v1/questions/:formId/questions`

**Auth Required:** Yes (ADMIN | HOD | INSTRUCTOR)

**Description:** Add a question to a form

**Request Body Examples:**

**Short Text Question:**
```json
{
  "label": "What is your name?",
  "type": "short_text",
  "required": true,
  "order": 1
}
```

**Multiple Choice Question:**
```json
{
  "label": "Rate your experience",
  "type": "multiple_choice",
  "required": true,
  "options": ["Excellent", "Good", "Average", "Poor"],
  "order": 2
}
```

**Linear Scale Question:**
```json
{
  "label": "Overall Satisfaction",
  "type": "linear_scale",
  "required": true,
  "scale": {
    "min": 1,
    "max": 5
  },
  "order": 3,
  "ai_tag": "satisfaction"
}
```

**File Upload Question:**
```json
{
  "label": "Upload your project",
  "type": "file",
  "required": true,
  "file_config": {
    "allowed_types": ["application/pdf", "application/zip"],
    "max_size": 5242880
  },
  "order": 4
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439014",
    "form_id": "507f1f77bcf86cd799439013",
    "label": "Rate your experience",
    "type": "multiple_choice",
    "required": true,
    "options": ["Excellent", "Good", "Average", "Poor"],
    "order": 2,
    "createdAt": "2024-04-20T10:35:00Z"
  }
}
```

**Validation Rules:**
- label: 3-200 characters
- type: short_text | long_text | linear_scale | multiple_choice | file
- required: boolean
- **For multiple_choice:** options array required with min 2 items
- **For linear_scale:** scale with min < max (both 1-10)
- **For file:** file_config with allowed_types array and max_size
- order: positive integer

---

### 15. Get All Questions for Form
**GET** `/v1/questions/:formId/questions`

**Auth Required:** Yes

**Description:** Get all questions in a form ordered by display order

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "507f1f77bcf86cd799439014",
      "form_id": "507f1f77bcf86cd799439013",
      "label": "Rate your experience",
      "type": "multiple_choice",
      "required": true,
      "options": ["Excellent", "Good", "Average", "Poor"],
      "order": 1,
      "createdAt": "2024-04-20T10:35:00Z"
    }
  ]
}
```

---

### 16. Update Question
**PATCH** `/v1/questions/:id`

**Auth Required:** Yes (ADMIN | HOD | INSTRUCTOR)

**Description:** Modify an existing question

**Request Body:**
```json
{
  "label": "Updated question label",
  "required": false,
  "order": 3
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439014",
    "label": "Updated question label",
    "type": "multiple_choice",
    "required": false,
    "options": ["Excellent", "Good", "Average", "Poor"],
    "order": 3,
    "updatedAt": "2024-04-20T11:00:00Z"
  }
}
```

---

### 17. Delete Question
**DELETE** `/v1/questions/:id`

**Auth Required:** Yes (ADMIN | HOD)

**Description:** Remove a question from a form

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Question deleted successfully"
}
```

---

### 18. Reorder Questions
**PATCH** `/v1/questions/:formId/questions/reorder`

**Auth Required:** Yes (ADMIN | HOD | INSTRUCTOR)

**Description:** Update the display order of multiple questions

**Request Body:**
```json
[
  {
    "id": "507f1f77bcf86cd799439014",
    "order": 3
  },
  {
    "id": "507f1f77bcf86cd799439015",
    "order": 1
  },
  {
    "id": "507f1f77bcf86cd799439016",
    "order": 2
  }
]
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Questions reordered successfully"
}
```

---

## Submission Endpoints

### 19. Create Submission (Submit Form Response)
**POST** `/forms/:formId/submissions`

**Auth Required:** Yes (STUDENT)

**Description:** Submit answers to a form

**Request Body:**
```json
{
  "subject_id": "507f1f77bcf86cd799439020",
  "answers": [
    {
      "question_id": "507f1f77bcf86cd799439014",
      "value": "Excellent"
    },
    {
      "question_id": "507f1f77bcf86cd799439015",
      "value": 4
    },
    {
      "question_id": "507f1f77bcf86cd799439016",
      "value": ["Option1", "Option2"]
    },
    {
      "question_id": "507f1f77bcf86cd799439017",
      "value": {
        "url": "https://storage.example.com/file123.pdf",
        "type": "application/pdf",
        "size": 1048576
      }
    }
  ]
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439030",
    "form_id": {
      "id": "507f1f77bcf86cd799439013",
      "title": "Student Performance Evaluation",
      "description": "Evaluate student performance in the course",
      "questions": [
        {
          "id": "507f1f77bcf86cd799439014",
          "label": "Rate your experience",
          "type": "multiple_choice",
          "required": true,
          "options": ["Excellent", "Good", "Average", "Poor"]
        }
      ]
    },
    "evaluator_id": "507f1f77bcf86cd799439021",
    "subject_id": "507f1f77bcf86cd799439020",
    "answers": [
      {
        "question_id": {
          "id": "507f1f77bcf86cd799439014",
          "label": "Rate your experience",
          "type": "multiple_choice"
        },
        "value": "Excellent"
      },
      {
        "question_id": {
          "id": "507f1f77bcf86cd799439015",
          "label": "Overall Satisfaction",
          "type": "linear_scale"
        },
        "value": 4
      }
    ],
    "createdAt": "2024-04-20T12:30:00Z"
  }
}
```

**Validation Rules:**
- Form must be active
- No duplicate question_id in answers
- Required questions must have answers
- **Text fields:** must be non-empty string
- **Numeric fields:** must be number within configured range
- **Multiple choice:** must be array with selected options
- **File fields:** must have url (valid URL) and type
- File type must match allowed_types in configuration
- File size must not exceed max_size

**Error Responses:**
- 404: Form not found
- 400: Form is not active / Invalid answers / Duplicate answers

---

## Department Endpoints

### 20. Create Department
**POST** `/admin/departments/`

**Auth Required:** Yes (ADMIN)

**Description:** Create a new department

**Request Body:**
```json
{
  "name": "Computer Science",
  "code": "CS",
  "description": "Department of Computer Science and Engineering"
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "name": "Computer Science",
    "code": "CS",
    "description": "Department of Computer Science and Engineering",
    "createdAt": "2024-04-20T10:30:00Z"
  }
}
```

---

### 21. Get All Departments
**GET** `/admin/departments/`

**Auth Required:** Yes (ADMIN)

**Description:** Get list of all departments

**Response (Success - 200):**
```json
{
  "status": "success",
  "count": 5,
  "data": [
    {
      "id": "507f1f77bcf86cd799439040",
      "name": "Computer Science",
      "code": "CS",
      "description": "Department of Computer Science and Engineering",
      "createdAt": "2024-04-20T10:30:00Z"
    }
  ]
}
```

---

### 22. Get Department by ID
**GET** `/admin/departments/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Get details of a specific department

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "name": "Computer Science",
    "code": "CS",
    "description": "Department of Computer Science and Engineering",
    "createdAt": "2024-04-20T10:30:00Z"
  }
}
```

---

### 23. Update Department
**PATCH** `/admin/departments/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Update department information

**Request Body:**
```json
{
  "name": "Computer Science & Engineering",
  "description": "Updated description"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439040",
    "name": "Computer Science & Engineering",
    "code": "CS",
    "description": "Updated description",
    "updatedAt": "2024-04-20T11:45:00Z"
  }
}
```

---

### 24. Delete Department
**DELETE** `/admin/departments/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Delete a department

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Department deleted successfully"
}
```

---

## User Administration Endpoints

### 25. List All Users
**GET** `/admin/users/`

**Auth Required:** Yes (ADMIN)

**Description:** Get list of all users with their profiles

**Response (Success - 200):**
```json
{
  "status": "success",
  "count": 15,
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Hassan",
      "email": "ahmed@example.com",
      "role": "STUDENT",
      "isActive": true,
      "departmentId": "507f1f77bcf86cd799439040",
      "academicYear": 2024,
      "profile": {
        "enrollmentNumber": "CS2024001",
        "cgpa": 3.8
      },
      "createdAt": "2024-04-20T10:30:00Z"
    }
  ]
}
```

---

### 26. Get User Details
**GET** `/admin/users/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Get complete information for a specific user

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "email": "ahmed@example.com",
    "role": "STUDENT",
    "isActive": true,
    "departmentId": "507f1f77bcf86cd799439040",
    "academicYear": 2024,
    "profile": {
      "enrollmentNumber": "CS2024001",
      "cgpa": 3.8
    },
    "createdAt": "2024-04-20T10:30:00Z"
  }
}
```

---

### 27. Update User
**PATCH** `/admin/users/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Update user information and role

**Request Body:**
```json
{
  "firstName": "Ahmed",
  "lastName": "Hassan",
  "email": "newemail@example.com",
  "role": "INSTRUCTOR",
  "isActive": true,
  "academicYear": 2024,
  "departmentId": "507f1f77bcf86cd799439040"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "email": "newemail@example.com",
    "role": "INSTRUCTOR",
    "isActive": true,
    "departmentId": "507f1f77bcf86cd799439040",
    "updatedAt": "2024-04-20T11:45:00Z"
  }
}
```

**Note:** Role changes trigger profile migration (handles role-specific data)

---

### 28. Delete User
**DELETE** `/admin/users/:id`

**Auth Required:** Yes (ADMIN)

**Description:** Delete a user and associated profiles

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "User deleted successfully"
}
```

---

## Utility Endpoints

### 29. Upload File
**POST** `/upload`

**Auth Required:** No (Public)

**Description:** Upload file and receive URL

**Request:**
- Form-data with `file` field

**Response (Success - 200):**
```json
{
  "status": "success",
  "url": "https://storage.example.com/uploads/file123.pdf",
  "fileName": "document.pdf",
  "size": 1048576
}
```

---

### 30. Health Check
**GET** `/health`

**Auth Required:** No

**Description:** Server health status check

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-04-20T12:30:00Z"
}
```

---

## Error Handling

### Standard Error Response Format

**400 - Bad Request:**
```json
{
  "status": "error",
  "message": "Validation error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**401 - Unauthorized:**
```json
{
  "status": "error",
  "message": "Authentication token required or invalid"
}
```

**403 - Forbidden:**
```json
{
  "status": "error",
  "message": "Insufficient permissions for this action"
}
```

**404 - Not Found:**
```json
{
  "status": "error",
  "message": "Resource not found"
}
```

**409 - Conflict:**
```json
{
  "status": "error",
  "message": "Resource already exists (duplicate)"
}
```

**500 - Server Error:**
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## Data Types Reference

### User Roles
```
ADMIN       - System administrator
HOD         - Head of Department
INSTRUCTOR  - Faculty member / Instructor
STUDENT     - Student
```

### Question Types
```
short_text      - Single line text input
long_text       - Multi-line text input
linear_scale    - Rating scale (1-10)
multiple_choice - Select one or more options
file            - File upload
```

### Form Status
```
is_active      - Form is available for responses
is_anonymous   - Responses are anonymous
```

### Validation Rules Summary

| Field | Rules |
|-------|-------|
| Email | Valid format, unique across system |
| Password | Min 8 characters, bcrypt hashed |
| National ID | Exactly 14 digits |
| OTP | 6 digits, 10 minute validity |
| Form Title | 5-100 characters |
| Form Description | Max 500 characters |
| Question Label | 3-200 characters |
| JWT Token | 7 day expiration |

---

## Authentication Header

All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

Obtain token from `/login` endpoint.

---

## Base Request Headers

```
Content-Type: application/json
Authorization: Bearer <token>  (for protected endpoints)
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-04-20 | Initial API documentation |

---

**Last Updated:** April 20, 2024  
**For Support:** Contact Backend Team
