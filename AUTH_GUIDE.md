# Authentication & Authorization Guide

## Overview

The authentication system now supports:

- **Global Roles**: `student` or `admin` (assigned during signup)
- **Team-Specific Roles**: Dynamic roles within teams (e.g., "lead", "member", "contributor")
- **Protected Routes**: All `/api/*` routes require authentication
- **Public Routes**: Only `/api/auth` routes are public

## JWT Token Structure

```json
{
  "id": 1,
  "email": "user@example.com",
  "roles": {
    "global": "student",
    "team": [
      { "teamId": 1, "role": "lead" },
      { "teamId": 2, "role": "member" },
      { "teamId": 3, "role": "contributor" }
    ]
  },
  "iat": 1234567890,
  "exp": 1234654290
}
```

## API Endpoints

### Public Endpoints (No Authentication Required)

#### Sign Up

```http
POST /api/auth/sign-up
Content-Type: application/json

{
  "email": "student@example.com",
  "fname": "John",
  "lname": "Doe",
  "userPassword": "password123",
  "role": "student",
  "bio": "Optional bio",
  "imgUrl": "optional-image-url"
}
```

**Response (201):**

```json
{
  "message": "User Created Successfully",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "fname": "John",
    "lname": "Doe",
    "roles": {
      "global": "student",
      "team": []
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Sign In

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "student@example.com",
  "userPassword": "password123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "student@example.com",
    "fname": "John",
    "lname": "Doe",
    "roles": {
      "global": "student",
      "team": [
        { "teamId": 1, "role": "lead" },
        { "teamId": 2, "role": "member" }
      ]
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Protected Endpoints (Authentication Required)

All endpoints under `/api/*` require authentication. Include the token in the `Authorization` header:

```http
GET /api/teams
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Using Authentication in Routes

### Example 1: Global Role Protection

Require users to be admins:

```typescript
import { Router } from "express";
import { requireGlobalRole } from "../middleware/validation.ts";
import { asyncHandler } from "../utils/wrappers.ts";

const router = Router();

router.delete(
  "/users/:id",
  requireGlobalRole(["admin"]),
  asyncHandler(deleteUser)
);

export default router;
```

### Example 2: Team Role Protection

Require users to be team lead:

```typescript
import { Router } from "express";
import { requireTeamRole } from "../middleware/validation.ts";
import { asyncHandler } from "../utils/wrappers.ts";

const router = Router();

// 'teamId' refers to the route param
router.post(
  "/teams/:teamId/settings",
  requireTeamRole("teamId", ["lead"]),
  asyncHandler(updateTeamSettings)
);

export default router;
```

### Example 3: Multiple Allowed Roles

Allow multiple team roles:

```typescript
router.put(
  "/teams/:teamId/members",
  requireTeamRole("teamId", ["lead", "manager"]),
  asyncHandler(updateMembers)
);
```

## Accessing User Info in Controllers

The authenticated user is available via `req.user`:

```typescript
export async function getTeamData(req: Request, res: Response) {
  const user = (req as any).user;

  console.log(user.id); // 1
  console.log(user.email); // "student@example.com"
  console.log(user.roles.global); // "student"
  console.log(user.roles.team); // [{ teamId: 1, role: "lead" }, ...]

  // Your logic here
  res.json({
    /* ... */
  });
}
```

## Error Responses

### Missing Token

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid authorization header"
}
```

### Invalid Token

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### Insufficient Global Role

```json
{
  "error": "Forbidden",
  "message": "This action requires one of the following global roles: admin"
}
```

### Insufficient Team Role

```json
{
  "error": "Forbidden",
  "message": "This action requires one of the following team roles: lead, manager"
}
```

## Server Configuration

The server is configured as follows:

```typescript
// Public routes
app.use("/api/auth", authRoutes);

// Health check (public)
app.get("/health", (req, res) => { ... });

// Authentication middleware - protects all routes below
app.use("/api", authenticate);

// All other /api/* routes require authentication
app.use("/api/teams", teamsRoutes);
app.use("/api/users", usersRoutes);
// etc.
```

## Flow Diagram

```
Client Request
    ↓
    ├─→ /api/auth/* → Public (no auth required)
    │
    └─→ /api/* → authenticate middleware
        ↓
        ├─ Valid token? Yes → Attach user to request
        │                    → Next middleware/handler
        │
        └─ Invalid token? → Return 401 Unauthorized
```
