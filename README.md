# Zenith Event Management System - API Documentation
भारत के स्वतंत्रता दिवस के पावन अवसर पर हम सभी देशवासियों को हार्दिक शुभकामनाएँ। 15 अगस्त हमें उन वीर सपूतों की याद दिलाता है जिन्होंने अपने बलिदान से हमें आज़ादी की अमूल्य धरोहर सौंपी। यह दिन हमें एकता, अखंडता और देशप्रेम का संदेश देता है। आइए हम सब मिलकर संकल्प लें कि ईमानदारी, परिश्रम और आपसी भाईचारे के साथ अपने राष्ट्र को प्रगति के पथ पर आगे बढ़ाएँगे। जय हिंद! 
Table of Contents

---

1. [Overview](about:blank#overview)
2. [System Architecture](about:blank#system-architecture)
3. [Authentication](about:blank#authentication)
4. [Core Features](about:blank#core-features)
5. [API Endpoints](about:blank#api-endpoints)
6. [Database Schemas](about:blank#database-schemas)
7. [Business Logic](about:blank#business-logic)
8. [Error Handling](about:blank#error-handling)
9. [Implementation Checklist](about:blank#implementation-checklist)

---

## Overview

The Zenith Event Management System is a comprehensive platform for managing hackathon/competition events with three main components:

- **Main Website**: Participant registration, team formation, and submission
- **Admin Portal**: Participant and team management, evaluator assignment
- **Evaluator Portal**: Team evaluation and scoring

### Key Capabilities

- Individual and team registration
- Dynamic team formation with unique team codes
- Team discovery (looking for members/teams)
- Submission management (video pitch + PDF)
- Multi-stage evaluation workflow
- RSVP tracking for selected teams

---

## System Architecture

### Technology Stack

- **Backend**: Node.js/Express (recommended)
- **Database**: MongoDB
- **Authentication**: Firebase Auth
- **File Storage**: Cloudinary (resumes, profile pictures, submissions)
- **Video Hosting**: YouTube (validated links)

### Important Configuration

- **Submission Deadline**: Configurable deadline after which no submission updates are allowed
- **RSVP Requirement**: All team members must individually RSVP for team to be finalized

### User Roles

1. **Participant**: Register, form/join teams, submit applications
2. **Admin**: Manage participants, teams, evaluators, and final selections
3. **Evaluator**: Review and score team submissions

---

## Authentication

### Firebase Authentication

All endpoints (except `/register` and `/login`) require Firebase authentication token in the request header:

```
Authorization: Bearer <firebase_token>
```

### Authentication Flow

1. **User Registration**: Create Firebase user → Store user data in MongoDB
2. **User Login**: Authenticate with Firebase → Return Firebase token + user data
3. **Subsequent Requests**: Include Firebase token in Authorization header
4. **Token Verification**: Backend verifies token with Firebase Admin SDK on each request

### Token Verification Middleware

```jsx
// Pseudo-code for authentication middleware
async function authenticateUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
      });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Fetch user from MongoDB using Firebase UID
    const user = await User.findOne({ uid: decodedToken.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // Attach user to request
    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: 'Invalid authentication token' }
    });
  }
}
```

### Role-Based Access Control (RBAC)

### Authorization Middleware

```jsx
// Check if user is admin
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
  }
  next();
}

// Check if user is evaluator
function requireEvaluator(req, res, next) {
  if (req.user.role !== 'evaluator') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Evaluator access required'
      }
    });
  }
  next();
}

// Check if user is team lead
async function requireTeamLead(req, res, next) {
  const { teamCode } = req.params || req.body;

  const team = await Team.findOne({ teamCode });

  if (!team) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Team not found' }
    });
  }

  if (team.teamLead !== req.user.uid) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_TEAM_LEAD',
        message: 'Only team lead can perform this action'
      }
    });
  }

  req.team = team;
  next();
}

// Check if user is team member
async function requireTeamMember(req, res, next) {
  const { teamCode } = req.params || req.body;

  const team = await Team.findOne({ teamCode });

  if (!team) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Team not found' }
    });
  }

  const isMember = team.teamMembers.some(
    member => member.uid === req.user.uid
  );

  if (!isMember) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Must be a team member'
      }
    });
  }

  req.team = team;
  next();
}
```

### Endpoint Protection Examples

```jsx
{
  "name": "John Doe",
  "bio": "Updated bio text",
  "phone": "+1234567890",
  "organisation": "Updated University",
  "resume": "<base64_encoded_pdf>",
  "profile_picture": "<base64_encoded_image>",
  "github_link": "https://github.com/johndoe",
  "linkedin_link": "https://linkedin.com/in/johndoe",
  "portfolio_link": "https://johndoe.dev",
  "isLooking": true
}// Public endpoints (no authentication)
app.post('/api/user/register', registerUser);
app.post('/api/user/login', loginUser);
app.get('/api/problem-statements', getProblemStatements);

// Authenticated user endpoints
app.get('/api/user/profile', authenticateUser, getUserProfile);
app.put('/api/user/profile', authenticateUser, updateUserProfile);

// Team lead only endpoints
app.post('/api/team/upload-submission',
  authenticateUser,
  requireTeamLead,
  uploadSubmission
);
app.put('/api/team/remove-member',
  authenticateUser,
  requireTeamLead,
  removeMember
);

// Team member endpoints
app.put('/api/user/rsvp',
  authenticateUser,
  requireTeamMember,
  submitRSVP
);

// Admin only endpoints
app.get('/api/admin/participants',
  authenticateUser,
  requireAdmin,
  getParticipants
);
app.put('/api/admin/finalize-teams',
  authenticateUser,
  requireAdmin,
  finalizeTeams
);

// Evaluator only endpoints
app.get('/api/evaluator/teams',
  authenticateUser,
  requireEvaluator,
  getAssignedTeams
);
app.put('/api/evaluator/evaluate',
  authenticateUser,
  requireEvaluator,
  submitEvaluation
);
```

### Role Assignment

User roles are stored in MongoDB and synchronized with Firebase custom claims:

```jsx
// Setting role in MongoDB and Firebase
async function assignRole(uid, role) {
  // Update MongoDB
  await User.updateOne({ uid }, { role });

  // Set Firebase custom claim
  await admin.auth().setCustomUserClaims(uid, { role });

  return { success: true };
}
```

### Access Control Matrix

| Endpoint Category | Participant | Team Lead | Admin | Evaluator |
| --- | --- | --- | --- | --- |
| Registration/Login | ✅ | ✅ | ✅ | ✅ |
| Profile Management | ✅ (own) | ✅ (own) | ✅ (all) | ✅ (own) |
| Team Creation | ✅ | - | ✅ | ❌ |
| Join Team | ✅ | - | ✅ | ❌ |
| Leave Team | ✅ | ✅ | ✅ | ❌ |
| Remove Member | ❌ | ✅ (own team) | ✅ | ❌ |
| Upload Submission | ❌ | ✅ (own team) | ✅ | ❌ |
| Submit Application | ❌ | ✅ (own team) | ✅ | ❌ |
| Individual RSVP | ✅ (if selected) | ✅ (if selected) | ✅ | ❌ |
| View All Participants | ❌ | ❌ | ✅ | ❌ |
| View All Teams | ❌ | ❌ | ✅ | ✅ (assigned) |
| Assign Evaluators | ❌ | ❌ | ✅ | ❌ |
| Evaluate Teams | ❌ | ❌ | ✅ | ✅ (assigned) |
| Finalize Selection | ❌ | ❌ | ✅ | ❌ |

---

## Core Features

### Admin Portal Features

### 1. View All Participants

- Display complete list with pagination (recommended: 50 per page)
- Individual participant details with expandable view
- Export functionality (CSV/Excel)

### 2. View All Teams

- Comprehensive team list with:
    - Team submissions (video + PDF)
    - Member details
    - Evaluation status and scores
- **Filtering:**
    - Status: Selected, Rejected, Waitlisted, Pending
    - Problem statement
    - RSVP status (Yes/No/Pending)
    - Evaluation status (Evaluated/Not Evaluated)
- **Sorting:**
    - By total score (descending)
    - By problem statement
    - By submission date
    - Alphabetical by team name
- **Search:**
    - Team name (fuzzy search)
    - Participant name (searches across all team members)
    - Team code
    - Problem statement

### 3. Admin & Evaluator Management

- Single admin account with elevated privileges
- Multiple evaluator accounts
- Assign specific problem statements or teams to evaluators
- Track evaluation progress dashboard
- Override evaluation scores if needed

### Main Website Features

### Team Management

**Team Creation:**
- Unique team name validation (real-time check)
- Automatic team code generation (6-8 alphanumeric characters)
- Team lead designation (creator becomes lead)

**Team Discovery:**
- “Looking for Team” page (individuals seeking teams)
- “Looking for Team Members” page (teams seeking members)
- Discord integration link

**Team Operations:**
- Join team via encoded team code
- Leave team (updates `isLooking` status)
- Remove member (team lead only)
- Upload video pitch (YouTube link validation)
- Upload PDF submission
- Submit application

### Individual Dashboard

- View/edit personal details
- Resume upload/update
- Social profile links management
- Team status display
- Leave team option
- RSVP interface (if selected)
- Toggle “Looking for Team” status

---

## API Endpoints

### Base URL

```
https://api.zenith.example.com/v1
```

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "error": null,
  "timestamp": "2024-12-26T10:30:00Z"
}
```

---

## User Endpoints

### 1. Register User

**Endpoint:** `POST /api/user/register`

**Status:** ✅ Implemented (requires modification)

**Description:** Register a new user with complete profile information

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "SecurePass123!",
  "age": 21,
  "organisation": "University XYZ",
  "bio": "Passionate developer interested in AI/ML",
  "resume": "<base64_encoded_pdf>",
  "profile_picture": "<base64_encoded_image>",
  "leetcode_profile": "https://leetcode.com/johndoe",
  "github_link": "https://github.com/johndoe",
  "linkedin_link": "https://linkedin.com/in/johndoe",
  "codeforces_link": "https://codeforces.com/profile/johndoe",
  "kaggle_link": "https://kaggle.com/johndoe",
  "devfolio_link": "https://devfolio.co/@johndoe",
  "portfolio_link": "https://johndoe.dev",
  "ctf_profile": "https://ctftime.org/user/johndoe",
  "isLooking": false
}
```

**Validation Rules:**
- `name`: Required, 2-100 characters
- `email`: Required, valid email format, unique
- `phone`: Required, valid phone format
- `password`: Required, min 8 characters, must contain uppercase, lowercase, number, special char
- `age`: Required, 13-100
- `organisation`: Required, 2-200 characters
- `resume`: Optional, PDF format, max 5MB
- `profile_picture`: Optional, JPG/PNG, max 2MB
- All profile links: Optional, valid URL format

**Response:**

```json
{
    "message": "Registration successful",
    "uid": "iSH69fkohjQlfsBA6fehQYT6f042",
    "status": "pending_verification",
    "user": {
        "uid": "iSH69fkohjQlfsBA6fehQYT6f042",
        "email": "john@example.com",
        "name": "John Doe",
        "isAdmin": false,
        "profile_picture": null
    }
}
```

**Error Responses:**
- `400`: Validation error (missing/invalid fields)
- `409`: Email already exists
- `500`: Server error

---

### 2. Login User

**Endpoint:** `POST /api/user/login`

```
{
    "message": "Login successful",
    "status": "success",
    "user": {
        "uid": "iSH69fkohjQlfsBA6fehQYT6f042",
        "email": "john@example.com",
        "name": "John Doe",
        "isAdmin": false,
        "profile_picture": null,
        "status": "active"
    },
    "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk4OGQ1YTM3OWI3OGJkZjFlNTBhNDA5MTEzZjJiMGM3NWU0NTJlNDciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vemVuaXRoLWZzIiwiYXVkIjoiemVuaXRoLWZzIiwiYXV0aF90aW1lIjoxNzY2ODU3MzQ2LCJ1c2VyX2lkIjoiaVNINjlma29oalFsZnNCQTZmZWhRWVQ2ZjA0MiIsInN1YiI6ImlTSDY5ZmtvaGpRbGZzQkE2ZmVoUVlUNmYwNDIiLCJpYXQiOjE3NjY4NTczNDYsImV4cCI6MTc2Njg2MDk0NiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImpvaG5AZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.IJzRG4lEjLGk6JSenJTRbAf1ZFQi5KT2nQDyDG3ea93oeeAGXXF2_IiSV3a3ghZs_lNUdjLPyKrxDrlb51SpAjqKPoZpCtWkXTJ6IT_ul2OQwDd2d5HUHt6e3W57ir82egwuTxly3rCcTJJ9hzQUC0p7XoqfC6OUZ1PvSrMYs3Hd9kCzi624A-B9zKPltjjn-RDMu5JQrCnp1AWZDe1n2u1vtWiBCO1h1So6eWhjROmyVrTtKaT9TQ8YKfTdNv896vqvwC3jT6YxUVMUCF3Gsve2pyg4w3kFNaxv8wlnJh2J3K9WpTnTCBlyWGDNSOfO0O5ihvOPgh7-HvA4bmY9qA"
}
```

**Status:** ✅ Implemented

**Description:** Authenticate user and receive Firebase token

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**

```json
{
    "message": "Login successful",
    "status": "success",
    "user": {
        "uid": "iSH69fkohjQlfsBA6fehQYT6f042",
        "email": "john@example.com",
        "name": "John Doe",
        "isAdmin": false,
        "profile_picture": null,
        "status": "active"
    },
    "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk4OGQ1YTM3OWI3OGJkZjFlNTBhNDA5MTEzZjJiMGM3NWU0NTJlNDciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vemVuaXRoLWZzIiwiYXVkIjoiemVuaXRoLWZzIiwiYXV0aF90aW1lIjoxNzY2ODU3MzQ2LCJ1c2VyX2lkIjoiaVNINjlma29oalFsZnNCQTZmZWhRWVQ2ZjA0MiIsInN1YiI6ImlTSDY5ZmtvaGpRbGZzQkE2ZmVoUVlUNmYwNDIiLCJpYXQiOjE3NjY4NTczNDYsImV4cCI6MTc2Njg2MDk0NiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImpvaG5AZXhhbXBsZS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.IJzRG4lEjLGk6JSenJTRbAf1ZFQi5KT2nQDyDG3ea93oeeAGXXF2_IiSV3a3ghZs_lNUdjLPyKrxDrlb51SpAjqKPoZpCtWkXTJ6IT_ul2OQwDd2d5HUHt6e3W57ir82egwuTxly3rCcTJJ9hzQUC0p7XoqfC6OUZ1PvSrMYs3Hd9kCzi624A-B9zKPltjjn-RDMu5JQrCnp1AWZDe1n2u1vtWiBCO1h1So6eWhjROmyVrTtKaT9TQ8YKfTdNv896vqvwC3jT6YxUVMUCF3Gsve2pyg4w3kFNaxv8wlnJh2J3K9WpTnTCBlyWGDNSOfO0O5ihvOPgh7-HvA4bmY9qA"
}
```

**Error Responses:**
- `401`: Invalid credentials
- `404`: User not found
- `500`: Server error

---

### 3. Get User Profile

**Endpoint:** `GET /api/user/profile`

**Status:** ✅ Implemented

**Authentication:** Required

**Description:** Retrieve authenticated user’s complete profile

**Response:**

```json
{
   "uid": "AqlFsLz08URECXtKRkJ7iFh20Q32",
   "name": "Test User 1766686366",
   "email": "testuser1766686366@example.com",
   "phone": "+91-9876506366",
   "resume_link": "https://res.cloudinary.com/digfe37ob/raw/upload/v1766686368/resumes/a                   ymrbkp3zpjppvulyf.pdf",
   "profile_picture": null,
   "leetcode_profile": null,
   "github_link": "https://github.com/test",
   "linkedin_link": "https://linkedin.com/in/test",
   "codeforces_link": null,
   "kaggle_link": null,
   "devfolio_link": null,
   "portfolio_link": null,
   "ctf_profile": null,
   "bio": "Test bio",
   "age": 25,
   "organisation": "Test Org",
   "role": "user",
   "isLooking": false
}
```

---

### 4. Update User Profile

**Endpoint:** `PUT /api/user/profile`

**Status:** ✅ Implemented

**Authentication:** Required

**Description:** Update user profile information

**Request Body:**

```json
{
  "name": "John Doe",
  "bio": "Updated bio text",
  "phone": "+1234567890",
  "organisation": "Updated University",
  "resume": "<base64_encoded_pdf>",
  "profile_picture": "<base64_encoded_image>",
  "github_link": "https://github.com/johndoe",
  "linkedin_link": "https://linkedin.com/in/johndoe",
  "portfolio_link": "https://johndoe.dev",
  "isLooking": true
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**

```json
{
    "message": "User updated successfully",
    "id": "695018baef60ad62faa46882",
    "uid": "iSH69fkohjQlfsBA6fehQYT6f042",
    "status": "success"
}
```

---

### 5. Get Users Looking for Team

**Endpoint:** `GET /api/user/looking-for-team`

**Authentication:** Required

**Description:** Get list of individuals looking for teams

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `organisation`: Filter by organisation
- `skills`: Filter by skills (comma-separated)

**Response:**

```json
{
    "success": true,
    "data": {
        "users": [
            {
                "id": "KcwYhPfmgpZlilYqQJLDF1yXfDK2",
                "name": "Second User",
                "email": "seconduser@example.com",
                "organisation": "Another University",
                "bio": "I am a second test user",
                "profile_picture": null,
                "github_link": "https://github.com/seconduser",
                "linkedin_link": "https://linkedin.com/in/seconduser",
                "leetcode_profile": null
            },
            {
                "id": "tq6fDy9DDAOINEdrCPB6NuDLUKF2",
                "name": "Updated Test User",
                "email": "testuser@example.com",
                "organisation": "Updated Test Org",
                "bio": "This is an updated bio",
                "profile_picture": null,
                "github_link": null,
                "linkedin_link": null,
                "leetcode_profile": null
            }
        ],
        "pagination": {
            "currentPage": 1,
            "totalPages": 1,
            "totalUsers": 2,
            "limit": 20
        }
    }
}
```

---

### 6. Update Looking for Team Status

**Endpoint:** `PUT /api/user/looking-for-team`

**Authentication:** Required

**Description:** Toggle user’s “looking for team” status

**Request Body:**

```json
{
  "isLooking": true
}
```

**Validation:**
- User must not be part of a team to set `isLooking: true`
- Automatically sets to `false` when user joins a team

**Response:**

```json
{
    "success": true,
    "message": "Status updated successfully",
    "data": {
        "isLooking": true
    }
}
```

---

## Team Endpoints

### 7. Create Team

**Endpoint:** `POST /api/team/create`

**Status:** 🔴 To be implemented

**Authentication:** Required

**Description:** Create a new team with unique name and code

**Request Body:**

```json
{
  "teamName": "Code Warriors",
  "appliedFor": "problem_statement_id",
  "isLooking": false
}
```

**Validation:**
- User must not be part of any team
- Team name must be unique (case-insensitive)
- Problem statement must exist

**Response:**

```json
{
  "success": true,
  "message": "Team created successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "teamLead": "user_id",
    "teamMembers": [
      {
        "id": "user_id",
        "name": "John Doe",
        "role": "Team Lead"
      }
    ],
    "appliedFor": "problem_statement_id",
    "isLooking": false
  }
}
```

**Error Responses:**
- `400`: User already in a team
- `409`: Team name already exists
- `404`: Problem statement not found

---

### 8. Get Teams Looking for Members

**Endpoint:** `GET /api/team/looking-for-members`

**Authentication:** Required

**Description:** Get list of teams looking for members

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `appliedFor`: Filter by problem statement ID

**Response:**

```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "teamCode": "ZN7K4X",
        "teamName": "Code Warriors",
        "teamLead": {
          "id": "user_id",
          "name": "John Doe"
        },
        "teamMembers": [
          {
            "id": "user_id",
            "name": "John Doe",
            "organisation": "University XYZ"
          }
        ],
        "currentMemberCount": 1,
        "maxMembers": 4,
        "appliedFor": {
          "id": "ps_id",
          "title": "AI-Powered Healthcare"
        },
        "isLooking": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalTeams": 45,
      "limit": 20
    }
  }
}
```

---

### 9. Update Team Looking for Members Status

**Endpoint:** `PUT /api/team/looking-for-members`

**Authentication:** Required

**Description:** Toggle team’s “looking for members” status (team lead only)

**Request Body:**

```json
{
  "teamCode": "ZN7K4X",
  "isLooking": true
}
```

**Validation:**
- User must be team lead
- Team must exist

**Response:**

```json
{
  "success": true,
  "message": "Team status updated successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "isLooking": true
  }
}
```

**Error Responses:**
- `403`: User is not team lead
- `404`: Team not found

---

### 10. Join Team

**Endpoint:** `PUT /api/team/join`

**Authentication:** Required

**Description:** Join a team using team code

**Request Body:**

```json
{
  "teamCode": "ZN7K4X"
}
```

**Validation:**
- User must not be part of any team
- Team must exist
- Team must not be full (max 4 members recommended)
- Team must not have submitted application

**Response:**

```json
{
  "success": true,
  "message": "Successfully joined team",
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "teamMembers": [
      {
        "id": "user_id_1",
        "name": "John Doe",
        "role": "Team Lead"
      },
      {
        "id": "user_id_2",
        "name": "Jane Smith",
        "role": "Member"
      }
    ],
    "memberCount": 2
  }
}
```

**Error Responses:**
- `400`: User already in a team
- `404`: Invalid team code
- `409`: Team is full or already submitted

---

### 11. Leave Team

**Endpoint:** `PUT /api/team/leave`

**Authentication:** Required

**Description:** Leave current team

**Request Body:**

```json
{
  "setLookingStatus": true
}
```

**Business Logic:**
- If user is team lead and team has other members: transfer leadership to next member
- If user is team lead and only member: delete team
- If team has submitted: prevent leaving (must be withdrawn first by admin)
- Automatically sets user’s `isLooking` based on `setLookingStatus`

**Response:**

```json
{
  "success": true,
  "message": "Successfully left team",
  "data": {
    "formerTeam": "Code Warriors",
    "isLooking": true,
    "newTeamLead": "user_id_2" // if leadership was transferred
  }
}
```

**Error Responses:**
- `400`: User not part of any team
- `403`: Cannot leave after submission

---

### 12. Remove Member from Team

**Endpoint:** `PUT /api/team/remove-member`

**Authentication:** Required

**Description:** Remove a member from team (team lead only)

**Request Body:**

```json
{
  "teamCode": "ZN7K4X",
  "memberId": "user_id_to_remove",
  "setTheirLookingStatus": true
}
```

**Validation:**
- User must be team lead
- Cannot remove self (use leave team instead)
- Cannot remove after submission

**Response:**

```json
{
  "success": true,
  "message": "Member removed successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "removedMember": {
      "id": "user_id",
      "name": "Jane Smith"
    },
    "currentMemberCount": 2
  }
}
```

**Error Responses:**
- `403`: User is not team lead
- `404`: Member not found in team
- `400`: Cannot remove after submission

---

### 13. Upload Team Submission

**Endpoint:** `POST /api/team/upload-submission`

**Authentication:** Required

**Description:** Upload video pitch and PDF submission (team lead only)

**Request Headers:**

```
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

```
videoURL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
submissionPDF: <file>
anyOtherLink: https://github.com/team/project
```

**Validation:**
- User must be team lead
- videoURL must be valid YouTube link (watch or youtu.be format)
- PDF file max size: 10MB
- Team must not have submitted yet

**Response:**

```json
{
  "success": true,
  "message": "Submission uploaded successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "videoURL": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "submissionPDF": "https://res.cloudinary.com/zenith/submissions/team_submission.pdf",
    "anyOtherLink": "https://github.com/team/project",
    "uploadedAt": "2024-12-15T10:30:00Z"
  }
}
```

---

### 14. Submit Team Application

**Endpoint:** `POST /api/team/submit-application`

**Authentication:** Required

**Description:** Submit team application for evaluation (team lead only)

**Request Body:**

```json
{
  "teamCode": "ZN7K4X"
}
```

**Validation:**
- User must be team lead
- Team must have at least 1 member (can be just lead)
- Video pitch and PDF must be uploaded
- Cannot submit if already submitted

**Response:**

```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "teamStatus": "submitted",
    "submittedAt": "2024-12-15T10:30:00Z",
    "membersCount": 3
  }
}
```

**Error Responses:**
- `403`: User is not team lead
- `400`: Missing required uploads or invalid team size
- `409`: Already submitted

---

### 15. Update Submitted Application

**Endpoint:** `PUT /api/team/update-submission`

**Authentication:** Required (Team Lead only)

**Authorization:** `requireTeamLead` middleware

**Description:** Update submission after initial submission but before evaluation and deadline

**Request Body:**

```json
{
  "teamCode": "ZN7K4X",
  "videoURL": "https://www.youtube.com/watch?v=newvideo",
  "submissionPDF": "<base64_encoded_pdf>",
  "anyOtherLink": "https://github.com/team/updated-project"
}
```

**Validation:**
- User must be team lead of the team
- Can only update if `isEvaluated: false`
- Can only update if current date/time is before submission deadline
- Team status must be “submitted”

**Deadline Check:**

```jsx
// Check if deadline has passed
const deadline = new Date(process.env.SUBMISSION_DEADLINE);
const now = new Date();

if (now > deadline) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'DEADLINE_PASSED',
      message: 'Submission deadline has passed. No updates allowed.',
      deadline: deadline.toISOString()
    }
  });
}
```

**Response:**

```json
{
  "success": true,
  "message": "Submission updated successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "updatedAt": "2024-12-16T14:20:00Z",
    "deadline": "2024-12-20T23:59:59Z"
  }
}
```

**Error Responses:**
- `403`: User is not team lead
- `403`: Deadline has passed (DEADLINE_PASSED)
- `403`: Team already evaluated
- `400`: Invalid status for update

---

### 16. Individual RSVP for Selected Team

**Endpoint:** `PUT /api/user/rsvp`

**Authentication:** Required (Team Member)

**Authorization:** `requireTeamMember` middleware (must be part of shortlisted team)

**Description:** Individual team member confirms attendance after team is shortlisted. Team is only fully confirmed when ALL members RSVP.

**Request Body:**

```json
{
  "rsvpStatus": "confirmed"
}
```

**Validation:**
- User must be part of a team
- Team must be shortlisted (`isShortlisted: true`)
- Valid rsvpStatus values: “confirmed”, “declined”
- User can only RSVP once (cannot change after submission)

**Business Logic:**

```jsx
// 1. Verify team is shortlisted
if (!team.isShortlisted) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'TEAM_NOT_SHORTLISTED',
      message: 'Team must be shortlisted before RSVP'
    }
  });
}

// 2. Check if user already RSVPed
const existingRSVP = team.memberRSVPs.find(
  rsvp => rsvp.uid === req.user.uid
);

if (existingRSVP) {
  return res.status(409).json({
    success: false,
    error: {
      code: 'ALREADY_RSVPED',
      message: 'You have already submitted your RSVP'
    }
  });
}

// 3. Add user's RSVP to team
team.memberRSVPs.push({
  uid: req.user.uid,
  name: req.user.name,
  rsvpStatus: rsvpStatus,
  rsvpedAt: new Date()
});

// 4. Check if all members have RSVPed
const allRSVPed = team.teamMembers.every(member =>
  team.memberRSVPs.some(rsvp => rsvp.uid === member.uid)
);

// 5. Check if all RSVPs are confirmed
const allConfirmed = allRSVPed && team.memberRSVPs.every(
  rsvp => rsvp.rsvpStatus === 'confirmed'
);

// 6. Update team status if all members RSVPed and confirmed
if (allConfirmed) {
  team.teamStatus = 'rsvped';
  team.rsvpCompletedAt = new Date();
}

// 7. If any member declined, mark team as declined
const anyDeclined = team.memberRSVPs.some(
  rsvp => rsvp.rsvpStatus === 'declined'
);

if (anyDeclined) {
  team.teamStatus = 'rsvp_declined';
}

await team.save();
```

**Response:**

```json
{
  "success": true,
  "message": "RSVP submitted successfully",
  "data": {
    "userRSVP": {
      "uid": "user_id",
      "name": "John Doe",
      "rsvpStatus": "confirmed",
      "rsvpedAt": "2024-12-20T10:00:00Z"
    },
    "teamStatus": {
      "teamCode": "ZN7K4X",
      "teamName": "Code Warriors",
      "totalMembers": 3,
      "rsvpedMembers": 2,
      "pendingRSVPs": 1,
      "allRSVPed": false,
      "teamStatus": "shortlisted",
      "memberRSVPs": [
        {
          "uid": "user_id_1",
          "name": "John Doe",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T10:00:00Z"
        },
        {
          "uid": "user_id_2",
          "name": "Jane Smith",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T09:30:00Z"
        }
      ]
    }
  }
}
```

**Response when all members RSVP confirmed:**

```json
{
  "success": true,
  "message": "RSVP submitted successfully. Your team is now fully confirmed!",
  "data": {
    "userRSVP": {
      "uid": "user_id_3",
      "name": "Mike Wilson",
      "rsvpStatus": "confirmed",
      "rsvpedAt": "2024-12-20T11:00:00Z"
    },
    "teamStatus": {
      "teamCode": "ZN7K4X",
      "teamName": "Code Warriors",
      "totalMembers": 3,
      "rsvpedMembers": 3,
      "pendingRSVPs": 0,
      "allRSVPed": true,
      "teamStatus": "rsvped",
      "rsvpCompletedAt": "2024-12-20T11:00:00Z",
      "memberRSVPs": [
        {
          "uid": "user_id_1",
          "name": "John Doe",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T10:00:00Z"
        },
        {
          "uid": "user_id_2",
          "name": "Jane Smith",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T09:30:00Z"
        },
        {
          "uid": "user_id_3",
          "name": "Mike Wilson",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T11:00:00Z"
        }
      ]
    }
  }
}
```

**Error Responses:**
- `400`: User not part of any team (USER_NOT_IN_TEAM)
- `400`: Team not shortlisted (TEAM_NOT_SHORTLISTED)
- `400`: Invalid RSVP status (INVALID_RSVP_STATUS)
- `409`: Already submitted RSVP (ALREADY_RSVPED)

**Notes:**
- Each team member must individually RSVP
- Team status changes to “rsvped” only when ALL members confirm
- If any member declines, team status becomes “rsvp_declined”
- Team lead receives notification when all members complete RSVP
- Admin can see RSVP progress for each team

---

### 17. Get User RSVP Status

**Endpoint:** `GET /api/user/rsvp-status`

**Authentication:** Required

**Description:** Get user’s RSVP status and team’s overall RSVP progress

**Response:**

```json
{
  "success": true,
  "data": {
    "hasRSVPed": true,
    "userRSVP": {
      "rsvpStatus": "confirmed",
      "rsvpedAt": "2024-12-20T10:00:00Z"
    },
    "team": {
      "teamCode": "ZN7K4X",
      "teamName": "Code Warriors",
      "isShortlisted": true,
      "teamStatus": "shortlisted",
      "totalMembers": 3,
      "rsvpedMembers": 2,
      "pendingRSVPs": 1,
      "allRSVPed": false,
      "memberRSVPs": [
        {
          "name": "John Doe",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T10:00:00Z"
        },
        {
          "name": "Jane Smith",
          "rsvpStatus": "confirmed",
          "rsvpedAt": "2024-12-20T09:30:00Z"
        },
        {
          "name": "Mike Wilson",
          "rsvpStatus": null,
          "rsvpedAt": null
        }
      ]
    }
  }
}
```

---

## Admin Endpoints

**All admin endpoints require:**
- Authentication: `authenticateUser` middleware
- Authorization: `requireAdmin` middleware

---

### 18. Get All Participants

**Endpoint:** `GET /api/admin/participants`

**Authentication:** Required (Admin only)

**Description:** Get list of all registered participants with filtering and pagination

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50, max: 200)
- `search`: Search by name or email
- `organisation`: Filter by organisation
- `hasTeam`: Filter by team status (true/false)
- `isLooking`: Filter by looking status (true/false)
- `sortBy`: Sort field (name, email, createdAt)
- `sortOrder`: asc/desc (default: desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "participants": [
      {
        "id": "user_id",
        "uid": "firebase_uid",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "organisation": "University XYZ",
        "age": 21,
        "isLooking": false,
        "teamCode": "ZN7K4X",
        "teamName": "Code Warriors",
        "resume_link": "https://res.cloudinary.com/zenith/resume.pdf",
        "profile_picture": "https://res.cloudinary.com/zenith/profile.jpg",
        "github_link": "https://github.com/johndoe",
        "linkedin_link": "https://linkedin.com/in/johndoe",
        "createdAt": "2024-12-01T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalParticipants": 487,
      "limit": 50
    },
    "stats": {
      "totalParticipants": 487,
      "withTeams": 312,
      "lookingForTeam": 89,
      "individual": 86
    }
  }
}
```

---

### 19. Get Participant Details

**Endpoint:** `GET /api/admin/participants/:id`

**Authentication:** Required (Admin only)

**Description:** Get detailed information about specific participant

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "uid": "firebase_uid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "age": 21,
    "organisation": "University XYZ",
    "bio": "Passionate developer...",
    "resume_link": "https://res.cloudinary.com/zenith/resume.pdf",
    "profile_picture": "https://res.cloudinary.com/zenith/profile.jpg",
    "leetcode_profile": "https://leetcode.com/johndoe",
    "github_link": "https://github.com/johndoe",
    "linkedin_link": "https://linkedin.com/in/johndoe",
    "codeforces_link": "https://codeforces.com/profile/johndoe",
    "kaggle_link": "https://kaggle.com/johndoe",
    "devfolio_link": "https://devfolio.co/@johndoe",
    "portfolio_link": "https://johndoe.dev",
    "ctf_profile": "https://ctftime.org/user/johndoe",
    "isLooking": false,
    "teamInfo": {
      "teamCode": "ZN7K4X",
      "teamName": "Code Warriors",
      "role": "Team Lead",
      "teamStatus": "submitted"
    },
    "createdAt": "2024-12-01T10:30:00Z",
    "updatedAt": "2024-12-15T14:20:00Z"
  }
}
```

---

### 20. Get All Teams

**Endpoint:** `GET /api/admin/teams`

**Authentication:** Required (Admin only)

**Description:** Get list of all teams with comprehensive filtering and sorting

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50, max: 200)
- `search`: Search by team name or member name
- `teamStatus`: Filter by status (submitted, pending, withdrawn, rsvped)
- `appliedFor`: Filter by problem statement ID
- `isShortlisted`: Filter by selection status (true/false)
- `isEvaluated`: Filter by evaluation status (true/false)
- `evaluator`: Filter by evaluator ID
- `rsvpStatus`: Filter by RSVP (confirmed/declined/pending)
- `sortBy`: Sort field (teamName, totalScore, submittedAt, evaluatedAt)
- `sortOrder`: asc/desc (default: desc)
- `minScore`: Minimum total score filter
- `maxScore`: Maximum total score filter

**Response:**

```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "teamCode": "ZN7K4X",
        "teamName": "Code Warriors",
        "teamLead": {
          "id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "teamMembers": [
          {
            "id": "user_id_1",
            "name": "John Doe",
            "organisation": "University XYZ",
            "role": "Team Lead"
          },
          {
            "id": "user_id_2",
            "name": "Jane Smith",
            "organisation": "College ABC",
            "role": "Member"
          }
        ],
        "memberCount": 2,
        "appliedFor": {
          "id": "ps_id",
          "title": "AI-Powered Healthcare"
        },
        "teamStatus": "submitted",
        "isEvaluated": true,
        "evaluator": {
          "id": "eval_id",
          "name": "Dr. Smith"
        },
        "scores": {
          "tech": 85,
          "ux": 78,
          "presentation": 92,
          "total": 255
        },
        "comments": "Excellent implementation with room for UI improvement",
        "isShortlisted": true,
        "rsvpStatus": "confirmed",
        "videoURL": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "submissionPDF": "https://res.cloudinary.com/zenith/submissions/team.pdf",
        "anyOtherLink": "https://github.com/team/project",
        "submittedAt": "2024-12-15T10:30:00Z",
        "evaluatedAt": "2024-12-18T15:45:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 6,
      "totalTeams": 156,
      "limit": 50
    },
    "stats": {
      "totalTeams": 156,
      "submitted": 142,
      "evaluated": 98,
      "shortlisted": 24,
      "rsvpConfirmed": 18,
      "pendingEvaluation": 44
    }
  }
}
```

---

### 21. Get Team Details

**Endpoint:** `GET /api/admin/teams/:teamCode`

**Authentication:** Required (Admin only)

**Description:** Get comprehensive details about specific team

**Response:**

```json
{
  "success": true,
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "teamLead": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "organisation": "University XYZ",
      "resume_link": "https://res.cloudinary.com/zenith/resume.pdf",
      "github_link": "https://github.com/johndoe"
    },
    "teamMembers": [
      {
        "id": "user_id_1",
        "name": "John Doe",
        "email": "john@example.com",
        "organisation": "University XYZ",
        "role": "Team Lead",
        "joinedAt": "2024-12-05T10:00:00Z"
      },
      {
        "id": "user_id_2",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "organisation": "College ABC",
        "role": "Member",
        "joinedAt": "2024-12-06T14:30:00Z"
      }
    ],
    "appliedFor": {
      "id": "ps_id",
      "title": "AI-Powered Healthcare",
      "description": "Develop innovative healthcare solutions..."
    },
    "teamStatus": "submitted",
    "isLooking": false,
    "isEvaluated": true,
    "evaluator": {
      "id": "eval_id",
      "name": "Dr. Smith",
      "email": "drsmith@example.com"
    },
    "scores": {
      "tech": 85,
      "ux": 78,
      "presentation": 92,
      "total": 255
    },
    "comments": "Excellent implementation with room for UI improvement. Strong technical foundation.",
    "isShortlisted": true,
    "memberRSVPs": [
      {
        "uid": "user_id_1",
        "name": "John Doe",
        "rsvpStatus": "confirmed",
        "rsvpedAt": "2024-12-20T10:00:00Z"
      },
      {
        "uid": "user_id_2",
        "name": "Jane Smith",
        "rsvpStatus": "confirmed",
        "rsvpedAt": "2024-12-20T09:30:00Z"
      }
    ],
    "rsvpProgress": {
      "totalMembers": 2,
      "rsvpedMembers": 2,
      "pendingRSVPs": 0,
      "allRSVPed": true
    },
    "videoURL": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "submissionPDF": "https://res.cloudinary.com/zenith/submissions/team.pdf",
    "anyOtherLink": "https://github.com/team/project",
    "createdAt": "2024-12-05T10:00:00Z",
    "submittedAt": "2024-12-15T10:30:00Z",
    "evaluatedAt": "2024-12-18T15:45:00Z",
    "shortlistedAt": "2024-12-19T09:00:00Z",
    "rsvpCompletedAt": "2024-12-20T10:00:00Z"
  }
}
```

---

### 22. Update Team Status

**Endpoint:** `PUT /api/admin/teams/:teamCode`

**Authentication:** Required (Admin only)

**Description:** Update team status or shortlist status

**Request Body:**

```json
{
  "teamStatus": "withdrawn",
  "isShortlisted": false,
  "adminNotes": "Team withdrew due to scheduling conflict"
}
```

**Valid teamStatus values:**
- `submitted`: Initial submission
- `pending`: Under review
- `withdrawn`: Admin-withdrawn or team-withdrawn
- `shortlisted`: Shortlisted (enables RSVP)
- `rsvped`: All members confirmed RSVP
- `rsvp_declined`: One or more members declined RSVP

**Response:**

```json
{
  "success": true,
  "message": "Team status updated successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "teamStatus": "withdrawn",
    "isShortlisted": false,
    "updatedAt": "2024-12-20T14:30:00Z"
  }
}
```

---

### 23. Get All Evaluators

**Endpoint:** `GET /api/admin/evaluators`

**Authentication:** Required (Admin only)

**Description:** Get list of all evaluators with their assignment status

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)

**Response:**

```json
{
  "success": true,
  "data": {
    "evaluators": [
      {
        "id": "eval_id",
        "uid": "firebase_uid",
        "name": "Dr. Smith",
        "email": "drsmith@example.com",
        "assignedTeams": [
          {
            "teamCode": "ZN7K4X",
            "teamName": "Code Warriors",
            "isEvaluated": true,
            "totalScore": 255
          },
          {
            "teamCode": "AB8K9M",
            "teamName": "Tech Innovators",
            "isEvaluated": false,
            "totalScore": null
          }
        ],
        "assignedCount": 2,
        "evaluatedCount": 1,
        "pendingCount": 1,
        "averageScore": 255
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalEvaluators": 8,
      "limit": 50
    },
    "stats": {
      "totalEvaluators": 8,
      "totalAssignments": 156,
      "totalEvaluated": 98,
      "totalPending": 58
    }
  }
}
```

---

### 24. Assign Teams to Evaluator

**Endpoint:** `PUT /api/admin/evaluators/assign`

**Authentication:** Required (Admin only)

**Description:** Assign teams to specific evaluator (can be by team codes or problem statement)

**Request Body (Option 1 - Specific Teams):**

```json
{
  "evaluatorId": "eval_id",
  "teamCodes": ["ZN7K4X", "AB8K9M", "CD3P5Q"],
  "action": "add"
}
```

**Request Body (Option 2 - By Problem Statement):**

```json
{
  "evaluatorId": "eval_id",
  "problemStatementId": "ps_id",
  "action": "add"
}
```

**Valid action values:**
- `add`: Assign teams to evaluator
- `remove`: Unassign teams from evaluator
- `replace`: Replace all current assignments

**Response:**

```json
{
  "success": true,
  "message": "Teams assigned successfully",
  "data": {
    "evaluatorId": "eval_id",
    "evaluatorName": "Dr. Smith",
    "assignedTeams": ["ZN7K4X", "AB8K9M", "CD3P5Q"],
    "totalAssigned": 3,
    "previouslyAssigned": 0,
    "newAssignments": 3
  }
}
```

---

### 25. Finalize Team Selection

**Endpoint:** `PUT /api/admin/finalize-teams`

**Authentication:** Required (Admin only)

**Description:** Finalize shortlist status for teams (typically after all evaluations)

**Request Body:**

```json
{
  "teamCodes": ["ZN7K4X", "AB8K9M", "CD3P5Q"],
  "isShortlisted": true,
  "notificationEmail": true
}
```

**Business Logic:**
- Sends notification emails to ALL team members if `notificationEmail: true`
- Updates team status to “shortlisted” to enable RSVP functionality
- Can shortlist or reject multiple teams at once
- Email notifies members to individually RSVP

**Response:**

```json
{
  "success": true,
  "message": "24 teams finalized successfully",
  "data": {
    "shortlisted": 24,
    "rejected": 0,
    "notificationsSent": 72,
    "teams": [
      {
        "teamCode": "ZN7K4X",
        "teamName": "Code Warriors",
        "isShortlisted": true,
        "memberCount": 3,
        "notificationsSent": 3
      }
    ]
  }
}
```

---

### 26. Export Data

**Endpoint:** `GET /api/admin/export`

**Authentication:** Required (Admin only)

**Description:** Export participants or teams data to CSV/Excel

**Query Parameters:**
- `type`: Export type (participants/teams/evaluations)
- `format`: File format (csv/xlsx)
- `filters`: JSON string of filters (same as list endpoints)

**Response:**

```
Content-Type: text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="zenith_teams_export_20241226.csv"

[CSV/Excel file content]
```

---

## Evaluator Endpoints

**All evaluator endpoints require:**
- Authentication: `authenticateUser` middleware
- Authorization: `requireEvaluator` middleware

**Additional Authorization:**
- Evaluators can only access teams assigned to them
- Assignment verification is done in each endpoint

---

### 27. Get Assigned Teams

**Endpoint:** `GET /api/evaluator/teams`

**Authentication:** Required (Evaluator only)

**Description:** Get list of teams assigned to logged-in evaluator

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)
- `isEvaluated`: Filter by evaluation status (true/false)
- `appliedFor`: Filter by problem statement ID
- `sortBy`: Sort field (teamName, submittedAt, totalScore)
- `sortOrder`: asc/desc

**Response:**

```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "teamCode": "ZN7K4X",
        "teamName": "Code Warriors",
        "teamMembers": [
          {
            "name": "John Doe",
            "organisation": "University XYZ"
          }
        ],
        "memberCount": 2,
        "appliedFor": {
          "id": "ps_id",
          "title": "AI-Powered Healthcare"
        },
        "isEvaluated": false,
        "videoURL": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "submissionPDF": "https://res.cloudinary.com/zenith/submissions/team.pdf",
        "anyOtherLink": "https://github.com/team/project",
        "submittedAt": "2024-12-15T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTeams": 18,
      "limit": 50
    },
    "stats": {
      "totalAssigned": 18,
      "evaluated": 12,
      "pending": 6
    }
  }
}
```

---

### 28. Get Team for Evaluation

**Endpoint:** `GET /api/evaluator/teams/:teamCode`

**Authentication:** Required (Evaluator only)

**Authorization:** Team must be assigned to this evaluator

**Description:** Get detailed team information including complete member profiles for evaluation

**Validation:**
- Team must be assigned to this evaluator
- Returns error if team is not in evaluator’s assignment list

**Authorization Check:**

```jsx
// Verify team is assigned to this evaluator
const evaluator = await Evaluator.findOne({ uid: req.user.uid });

const isAssigned = evaluator.assignedTeams.some(
  team => team.teamCode === teamCode
);

if (!isAssigned) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'TEAM_NOT_ASSIGNED',
      message: 'This team is not assigned to you'
    }
  });
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "teamMembers": [
      {
        "id": "user_id_1",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "organisation": "University XYZ",
        "age": 21,
        "bio": "Passionate full-stack developer with 3 years of experience in React and Node.js. Interested in AI/ML applications.",
        "role": "Team Lead",
        "resume_link": "https://res.cloudinary.com/zenith/resumes/john_doe.pdf",
        "profile_picture": "https://res.cloudinary.com/zenith/profiles/john_doe.jpg",
        "leetcode_profile": "https://leetcode.com/johndoe",
        "github_link": "https://github.com/johndoe",
        "linkedin_link": "https://linkedin.com/in/johndoe",
        "codeforces_link": "https://codeforces.com/profile/johndoe",
        "kaggle_link": "https://kaggle.com/johndoe",
        "devfolio_link": "https://devfolio.co/@johndoe",
        "portfolio_link": "https://johndoe.dev",
        "ctf_profile": "https://ctftime.org/user/johndoe",
        "joinedAt": "2024-12-05T10:00:00Z"
      },
      {
        "id": "user_id_2",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phone": "+1234567891",
        "organisation": "College ABC",
        "age": 20,
        "bio": "UI/UX designer and frontend developer. Specializing in creating intuitive user experiences.",
        "role": "Member",
        "resume_link": "https://res.cloudinary.com/zenith/resumes/jane_smith.pdf",
        "profile_picture": "https://res.cloudinary.com/zenith/profiles/jane_smith.jpg",
        "github_link": "https://github.com/janesmith",
        "linkedin_link": "https://linkedin.com/in/janesmith",
        "portfolio_link": "https://janesmith.design",
        "joinedAt": "2024-12-06T14:30:00Z"
      },
      {
        "id": "user_id_3",
        "name": "Mike Wilson",
        "email": "mike@example.com",
        "phone": "+1234567892",
        "organisation": "Tech Institute",
        "age": 22,
        "bio": "Backend engineer with expertise in system architecture and database optimization.",
        "role": "Member",
        "resume_link": "https://res.cloudinary.com/zenith/resumes/mike_wilson.pdf",
        "github_link": "https://github.com/mikewilson",
        "linkedin_link": "https://linkedin.com/in/mikewilson",
        "codeforces_link": "https://codeforces.com/profile/mikewilson",
        "joinedAt": "2024-12-07T09:15:00Z"
      }
    ],
    "memberCount": 3,
    "appliedFor": {
      "id": "ps_id",
      "title": "AI-Powered Healthcare",
      "description": "Develop innovative healthcare solutions using artificial intelligence to improve accessibility, diagnosis accuracy, or patient care delivery."
    },
    "videoURL": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "submissionPDF": "https://res.cloudinary.com/zenith/submissions/team.pdf",
    "anyOtherLink": "https://github.com/team/project",
    "isEvaluated": false,
    "scores": null,
    "comments": null,
    "submittedAt": "2024-12-15T10:30:00Z",
    "evaluationCriteria": {
      "tech": {
        "label": "Technical Implementation",
        "maxScore": 100,
        "description": "Code quality, architecture, innovation, scalability"
      },
      "ux": {
        "label": "User Experience",
        "maxScore": 100,
        "description": "UI design, usability, accessibility, user flow"
      },
      "presentation": {
        "label": "Presentation Quality",
        "maxScore": 100,
        "description": "Video pitch clarity, communication, demo quality"
      }
    }
  }
}
```

**Note:** Evaluators receive complete profile information for all team members including:
- Full contact details
- Educational background
- Bio and interests
- Resume links (can download and review)
- All social/coding profiles
- Portfolio links

This allows evaluators to:
- Assess team composition and diversity
- Review individual member backgrounds
- Verify technical skills through profile links
- Contact members if clarification is needed

---

### 29. Submit Evaluation

**Endpoint:** `PUT /api/evaluator/evaluate`

**Authentication:** Required (Evaluator only)

**Authorization:** Team must be assigned to this evaluator

**Description:** Submit evaluation scores and comments for a team

**Request Body:**

```json
{
  "teamCode": "ZN7K4X",
  "scores": {
    "tech": 85,
    "ux": 78,
    "presentation": 92
  },
  "comments": "Excellent implementation with strong technical foundation. UI could be more polished but overall very impressive work. Video presentation was clear and well-structured."
}
```

**Validation:**
- Team must be assigned to this evaluator
- Each score must be between 0-100
- Comments are required (min 50 characters recommended)
- Cannot re-evaluate unless admin resets evaluation

**Authorization Check:**

```jsx
// Verify team is assigned to this evaluator
const evaluator = await Evaluator.findOne({ uid: req.user.uid });

const isAssigned = evaluator.assignedTeams.some(
  team => team.teamCode === teamCode
);

if (!isAssigned) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'TEAM_NOT_ASSIGNED',
      message: 'This team is not assigned to you'
    }
  });
}

// Check if already evaluated
if (team.isEvaluated) {
  return res.status(409).json({
    success: false,
    error: {
      code: 'ALREADY_EVALUATED',
      message: 'This team has already been evaluated by you'
    }
  });
}
```

**Response:**

```json
{
  "success": true,
  "message": "Evaluation submitted successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "teamName": "Code Warriors",
    "scores": {
      "tech": 85,
      "ux": 78,
      "presentation": 92,
      "total": 255
    },
    "comments": "Excellent implementation...",
    "isEvaluated": true,
    "evaluatedAt": "2024-12-18T15:45:00Z",
    "evaluatedBy": {
      "id": "eval_id",
      "name": "Dr. Smith"
    }
  }
}
```

**Error Responses:**
- `403`: Team not assigned to evaluator (TEAM_NOT_ASSIGNED)
- `400`: Invalid scores or missing comments (VALIDATION_ERROR)
- `409`: Already evaluated (ALREADY_EVALUATED)

---

### 30. Update Evaluation

**Endpoint:** `PUT /api/evaluator/evaluate/:teamCode/update`

**Authentication:** Required (Evaluator only)

**Authorization:** Must be the evaluator who submitted the original evaluation

**Description:** Update previously submitted evaluation

**Request Body:**

```json
{
  "scores": {
    "tech": 88,
    "ux": 80,
    "presentation": 92
  },
  "comments": "Updated evaluation: Excellent implementation with strong technical foundation. After reconsideration, the technical score has been increased."
}
```

**Validation:**
- Only evaluator who submitted original evaluation can update
- Can only update if admin hasn’t finalized selections

**Response:**

```json
{
  "success": true,
  "message": "Evaluation updated successfully",
  "data": {
    "teamCode": "ZN7K4X",
    "scores": {
      "tech": 88,
      "ux": 80,
      "presentation": 92,
      "total": 260
    },
    "previousTotal": 255,
    "updatedAt": "2024-12-19T10:15:00Z"
  }
}
```

---

## Problem Statement Endpoints

### 31. Get All Problem Statements

**Endpoint:** `GET /api/problem-statements`

**Authentication:** Optional (public endpoint)

**Description:** Get list of all active problem statements

**Response:**

```json
{
  "success": true,
  "data": {
    "problemStatements": [
      {
        "id": "ps_id_1",
        "title": "AI-Powered Healthcare",
        "description": "Develop innovative solutions that leverage AI to improve healthcare accessibility, diagnosis accuracy, or patient care delivery.",
        "teamCount": 45,
        "isActive": true
      },
      {
        "id": "ps_id_2",
        "title": "Sustainable Energy Solutions",
        "description": "Create technology solutions for renewable energy management and consumption optimization.",
        "teamCount": 32,
        "isActive": true
      },
      {
        "id": "ps_id_3",
        "title": "Financial Inclusion Technology",
        "description": "Build platforms that improve financial access and literacy for underserved communities.",
        "teamCount": 28,
        "isActive": true
      }
    ],
    "total": 3
  }
}
```

---

### 32. Get Problem Statement by ID

**Endpoint:** `GET /api/problem-statements/:id`

**Authentication:** Optional (public endpoint)

**Description:** Get detailed information about a specific problem statement

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ps_id_1",
    "title": "AI-Powered Healthcare",
    "description": "Develop innovative solutions that leverage AI to improve healthcare accessibility, diagnosis accuracy, or patient care delivery. Your solution should address real-world healthcare challenges and demonstrate practical implementation.",
    "teamCount": 45,
    "isActive": true,
    "createdAt": "2024-11-01T00:00:00Z"
  }
}
```

---

### 33. Create Problem Statement (Admin)

**Endpoint:** `POST /api/admin/problem-statements`

**Authentication:** Required (Admin only)

**Authorization:** `requireAdmin` middleware

**Description:** Create new problem statement

**Request Body:**

```json
{
  "title": "AI-Powered Healthcare",
  "description": "Develop innovative solutions that leverage AI to improve healthcare accessibility, diagnosis accuracy, or patient care delivery.",
  "isActive": true
}
```

**Validation:**
- `title`: Required, unique, 10-200 characters
- `description`: Required, 50-1000 characters
- `isActive`: Optional, boolean (default: true)

**Response:**

```json
{
  "success": true,
  "message": "Problem statement created successfully",
  "data": {
    "id": "ps_id_new",
    "title": "AI-Powered Healthcare",
    "description": "Develop innovative solutions...",
    "isActive": true,
    "teamCount": 0,
    "createdAt": "2024-12-26T10:30:00Z"
  }
}
```

---

### 34. Update Problem Statement (Admin)

**Endpoint:** `PUT /api/admin/problem-statements/:id`

**Authentication:** Required (Admin only)

**Authorization:** `requireAdmin` middleware

**Description:** Update existing problem statement

**Request Body:**

```json
{
  "title": "AI-Powered Healthcare Solutions",
  "description": "Updated description text...",
  "isActive": false
}
```

**Note:** All fields are optional. Only provided fields will be updated.

**Response:**

```json
{
  "success": true,
  "message": "Problem statement updated successfully",
  "data": {
    "id": "ps_id_1",
    "title": "AI-Powered Healthcare Solutions",
    "description": "Updated description text...",
    "isActive": false,
    "updatedAt": "2024-12-26T11:00:00Z"
  }
}
```

---

## Database Schemas

### Users Collection

```jsx
{
  _id: ObjectId,
  uid: String,                    // Firebase UID (unique, indexed)
  email: String,                  // Unique, indexed
  name: String,
  phone: String,
  age: Number,
  organisation: String,
  bio: String,

  // Profile links (all optional)
  resume_link: String,            // Cloudinary URL
  profile_picture: String,        // Cloudinary URL
  leetcode_profile: String,
  github_link: String,
  linkedin_link: String,
  codeforces_link: String,
  kaggle_link: String,
  devfolio_link: String,
  portfolio_link: String,
  ctf_profile: String,

  // Team information
  isLooking: Boolean,             // Default: false
  teamCode: String,               // Null if not in team, indexed

  // Timestamps
  createdAt: Date,
  updatedAt: Date,

  // Indexes
  indexes: [
    { uid: 1 },                   // Unique
    { email: 1 },                 // Unique
    { teamCode: 1 },
    { isLooking: 1 },
    { createdAt: -1 }
  ]
}
```

---

### Teams Collection

```jsx
{
  _id: ObjectId,
  teamCode: String,               // Unique 6-8 char code (indexed, unique)
  teamName: String,               // Unique (indexed, unique)
  teamLead: String,               // User UID (indexed)

  // Team status
  isLooking: Boolean,             // Looking for members
  teamMembers: [                  // Array of user UIDs
    {
      uid: String,
      joinedAt: Date,
      role: String                // "Team Lead" or "Member"
    }
  ],
  memberCount: Number,            // Denormalized for queries

  // Application status
  teamStatus: String,             // Enum: submitted, pending, withdrawn, shortlisted, rsvped, rsvp_declined
  appliedFor: String,             // Problem statement ID (indexed)

  // Submission
  videoURL: String,               // YouTube URL
  submissionPDF: String,          // Cloudinary URL
  anyOtherLink: String,           // Optional additional link

  // Evaluation
  isEvaluated: Boolean,           // Default: false (indexed)
  evaluator: String,              // Evaluator UID (indexed)
  scores: {
    tech: Number,                 // 0-100
    ux: Number,                   // 0-100
    presentation: Number,         // 0-100
    total: Number                 // Auto-calculated
  },
  comments: String,

  // Selection and RSVP
  isShortlisted: Boolean,         // Default: false (indexed)
  memberRSVPs: [                  // Individual member RSVPs
    {
      uid: String,
      name: String,
      rsvpStatus: String,         // Enum: confirmed, declined
      rsvpedAt: Date
    }
  ],

  // Timestamps
  createdAt: Date,
  submittedAt: Date,
  evaluatedAt: Date,
  shortlistedAt: Date,
  rsvpCompletedAt: Date,          // When all members complete RSVP
  updatedAt: Date,

  // Indexes
  indexes: [
    { teamCode: 1 },              // Unique
    { teamName: 1 },              // Unique
    { teamLead: 1 },
    { appliedFor: 1 },
    { evaluator: 1 },
    { isEvaluated: 1 },
    { isShortlisted: 1 },
    { teamStatus: 1 },
    { 'scores.total': -1 },       // For leaderboard/sorting
    { 'memberRSVPs.uid': 1 },     // For RSVP queries
    { createdAt: -1 }
  ]
}
```

---

### Admins Collection

```jsx
{
  _id: ObjectId,
  uid: String,                    // Firebase UID (unique, indexed)
  email: String,                  // Unique
  name: String,
  role: String,                   // "admin"
  permissions: [String],          // Array of permission strings

  // Timestamps
  createdAt: Date,
  lastLoginAt: Date,

  // Indexes
  indexes: [
    { uid: 1 },                   // Unique
    { email: 1 }                  // Unique
  ]
}
```

---

### Evaluators Collection

```jsx
{
  _id: ObjectId,
  uid: String,                    // Firebase UID (unique, indexed)
  email: String,                  // Unique
  name: String,
  role: String,                   // "evaluator"

  // Assignments
  assignedTeams: [                // Array of team codes
    {
      teamCode: String,
      assignedAt: Date,
      isEvaluated: Boolean
    }
  ],
  assignedCount: Number,          // Denormalized count
  evaluatedCount: Number,         // Denormalized count

  // Statistics
  stats: {
    averageScore: Number,
    evaluationsCompleted: Number,
    evaluationsPending: Number
  },

  // Timestamps
  createdAt: Date,
  lastLoginAt: Date,
  lastEvaluationAt: Date,

  // Indexes
  indexes: [
    { uid: 1 },                   // Unique
    { email: 1 },                 // Unique
    { 'assignedTeams.teamCode': 1 }
  ]
}
```

---

### Problem Statements Collection

```jsx
{
  _id: ObjectId,
  title: String,                  // Unique, required
  description: String,            // Required (50-1000 characters)

  // Metadata
  teamCount: Number,              // Current team count (denormalized)
  isActive: Boolean,              // Is accepting applications (default: true)

  // Timestamps
  createdAt: Date,
  updatedAt: Date,

  // Indexes
  indexes: [
    { title: 1 },                 // Unique
    { isActive: 1 },
    { createdAt: -1 }
  ]
}
```

---

## Business Logic

### Team Code Generation

```jsx
// Generate unique 6-8 character alphanumeric team code
function generateTeamCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
  let code = '';

  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Check uniqueness in database
  // If exists, regenerate

  return code;
}
```

**Note:** Do NOT use bcrypt for team codes. Use a simple random alphanumeric generator. Bcrypt is for password hashing, not for generating readable codes.

---

### Team Name Uniqueness

```jsx
// Check team name uniqueness (case-insensitive)
async function isTeamNameUnique(teamName) {
  const existingTeam = await Team.findOne({
    teamName: { $regex: new RegExp(`^${teamName}$`, 'i') }
  });

  return !existingTeam;
}
```

---

### YouTube URL Validation

```jsx
function validateYouTubeURL(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/
  ];

  return patterns.some(pattern => pattern.test(url));
}
```

---

### File Upload Validation

```jsx
// Resume validation
const resumeValidation = {
  allowedFormats: ['application/pdf'],
  maxSize: 5 * 1024 * 1024, // 5MB
  cloudinaryFolder: 'zenith/resumes'
};

// Profile picture validation
const profilePicValidation = {
  allowedFormats: ['image/jpeg', 'image/png', 'image/jpg'],
  maxSize: 2 * 1024 * 1024, // 2MB
  cloudinaryFolder: 'zenith/profiles'
};

// Submission PDF validation
const submissionPDFValidation = {
  allowedFormats: ['application/pdf'],
  maxSize: 10 * 1024 * 1024, // 10MB
  cloudinaryFolder: 'zenith/submissions'
};
```

---

### Score Calculation

```jsx
function calculateTotalScore(scores) {
  const { tech, ux, presentation } = scores;

  // Validate individual scores
  if (tech < 0 || tech > 100 || ux < 0 || ux > 100 ||
      presentation < 0 || presentation > 100) {
    throw new Error('Scores must be between 0 and 100');
  }

  return tech + ux + presentation;
}
```

---

### Team Lead Transfer Logic

```jsx
async function transferTeamLeadership(teamCode, currentLeadUid) {
  const team = await Team.findOne({ teamCode });

  // Find next member who isn't the current lead
  const nextMember = team.teamMembers.find(
    member => member.uid !== currentLeadUid
  );

  if (!nextMember) {
    // No other members, delete team
    await Team.deleteOne({ teamCode });
    return null;
  }

  // Update team lead
  team.teamLead = nextMember.uid;
  team.teamMembers = team.teamMembers.map(member => ({
    ...member,
    role: member.uid === nextMember.uid ? 'Team Lead' : 'Member'
  }));

  await team.save();
  return nextMember.uid;
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information",
    "field": "fieldName" // For validation errors
  },
  "timestamp": "2024-12-26T10:30:00Z"
}
```

---
