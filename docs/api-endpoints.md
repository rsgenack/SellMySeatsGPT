# API Endpoints

This document outlines the available API endpoints in the TicketTrader application.

## Authentication

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "username": "string",
  "email": "string",
  "isAdmin": "boolean"
}
```

### POST /api/auth/login
Authenticate a user and create a session.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "username": "string",
  "email": "string",
  "isAdmin": "boolean"
}
```

### POST /api/auth/logout
Log out the current user and destroy the session.

**Response:** 204 No Content

### GET /api/auth/me
Get the current authenticated user's information.

**Response:**
```json
{
  "id": "number",
  "username": "string",
  "email": "string",
  "isAdmin": "boolean"
}
```

### POST /api/auth/forgot-password
Request a password reset token.

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:** 200 OK

### POST /api/auth/reset-password
Reset password using a token.

**Request Body:**
```json
{
  "token": "string",
  "password": "string"
}
```

**Response:** 200 OK

## Tickets

### GET /api/tickets
Get all tickets for the authenticated user.

**Response:**
```json
[
  {
    "id": "number",
    "eventName": "string",
    "eventDate": "string",
    "venue": "string",
    "section": "string",
    "row": "string",
    "seat": "string",
    "askingPrice": "number",
    "status": "string",
    "createdAt": "string"
  }
]
```

### GET /api/tickets/:id
Get a specific ticket by ID.

**Response:**
```json
{
  "id": "number",
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number",
  "status": "string",
  "createdAt": "string"
}
```

### POST /api/tickets
Create a new ticket.

**Request Body:**
```json
{
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number"
}
```

**Response:**
```json
{
  "id": "number",
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number",
  "status": "string",
  "createdAt": "string"
}
```

### PUT /api/tickets/:id
Update an existing ticket.

**Request Body:**
```json
{
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number",
  "status": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number",
  "status": "string",
  "createdAt": "string"
}
```

### DELETE /api/tickets/:id
Delete a ticket.

**Response:** 204 No Content

## Pending Tickets

### GET /api/pending-tickets
Get all pending tickets for the authenticated user.

**Response:**
```json
[
  {
    "id": "number",
    "eventName": "string",
    "eventDate": "string",
    "venue": "string",
    "section": "string",
    "row": "string",
    "seat": "string",
    "status": "string",
    "createdAt": "string"
  }
]
```

### POST /api/pending-tickets/:id/approve
Approve a pending ticket, converting it to a regular ticket.

**Response:**
```json
{
  "id": "number",
  "eventName": "string",
  "eventDate": "string",
  "venue": "string",
  "section": "string",
  "row": "string",
  "seat": "string",
  "askingPrice": "number",
  "status": "string",
  "createdAt": "string"
}
```

### DELETE /api/pending-tickets/:id
Delete a pending ticket.

**Response:** 204 No Content

## Email Processing

### POST /api/email/check
Trigger a check for new emails with tickets.

**Response:**
```json
{
  "success": "boolean",
  "message": "string",
  "ticketsFound": "number"
}
```

## Admin Endpoints

### GET /api/admin/users
Get all users (admin only).

**Response:**
```json
[
  {
    "id": "number",
    "username": "string",
    "email": "string",
    "isAdmin": "boolean",
    "createdAt": "string"
  }
]
```

### PUT /api/admin/users/:id
Update a user (admin only).

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "isAdmin": "boolean"
}
```

**Response:**
```json
{
  "id": "number",
  "username": "string",
  "email": "string",
  "isAdmin": "boolean",
  "createdAt": "string"
}
```

### DELETE /api/admin/users/:id
Delete a user (admin only).

**Response:** 204 No Content 