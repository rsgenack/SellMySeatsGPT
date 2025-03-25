# Database Schema

This document outlines the database schema for the TicketTrader application, using PostgreSQL and Drizzle ORM.

## Tables

### users

Stores user account information.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| username | TEXT NOT NULL UNIQUE | Username for login |
| password | TEXT NOT NULL | Hashed password |
| email | TEXT NOT NULL | User's email address |
| uniqueEmail | VARCHAR(255) NOT NULL UNIQUE | Normalized email for uniqueness |
| isAdmin | BOOLEAN NOT NULL DEFAULT false | Admin status flag |
| created_at | TIMESTAMP DEFAULT now() | Account creation timestamp |

### password_reset_tokens

Stores tokens for password reset functionality.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| user_id | INTEGER NOT NULL | Reference to users.id |
| token | TEXT NOT NULL UNIQUE | Reset token |
| expires_at | TIMESTAMP NOT NULL | Token expiration time |
| created_at | TIMESTAMP DEFAULT now() | Token creation timestamp |
| used_at | TIMESTAMP | When token was used (if used) |

### pendingTickets

Stores tickets that are being imported from email but not yet finalized.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| user_id | INTEGER NOT NULL | Reference to users.id |
| recipient_email | VARCHAR(255) NOT NULL | Email where ticket was sent |
| event_name | TEXT | Name of the event |
| event_date | TIMESTAMP | Date of the event |
| event_time | TEXT | Time of the event |
| venue | TEXT | Venue name |
| city | TEXT | City name |
| state | TEXT | State name |
| section | TEXT | Seating section |
| row | TEXT | Seating row |
| seat | TEXT | Seat number |
| email_subject | TEXT | Subject of the email |
| email_from | TEXT | Sender of the email |
| raw_email_data | TEXT | Raw email content |
| extracted_data | JSONB | Structured data extracted from email |
| status | TEXT NOT NULL DEFAULT 'pending' | Status of ticket import |
| created_at | TIMESTAMP DEFAULT now() | Record creation timestamp |

### session

Stores user session data.

| Column | Type | Description |
|--------|------|-------------|
| sid | VARCHAR(255) NOT NULL PRIMARY KEY | Session ID |
| sess | JSONB NOT NULL | Session data |
| expire | TIMESTAMP NOT NULL | Session expiration time |

### tickets

Stores finalized tickets available for transfer/sale.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| user_id | INTEGER NOT NULL | Reference to users.id |
| event_name | TEXT | Name of the event |
| event_date | TIMESTAMP | Date of the event |
| venue | TEXT | Venue name |
| section | TEXT | Seating section |
| row | TEXT | Seating row |
| seat | TEXT | Seat number |
| asking_price | INTEGER DEFAULT 0 | Price in cents |
| status | TEXT NOT NULL DEFAULT 'pending' | Status of ticket |
| created_at | TIMESTAMP DEFAULT now() | Record creation timestamp |

### payments

Stores payment records.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique identifier |
| user_id | INTEGER NOT NULL | Reference to users.id |
| amount | INTEGER NOT NULL | Amount in cents |
| created_at | TIMESTAMP DEFAULT now() | Payment timestamp |

## Relationships

- `password_reset_tokens.user_id` → `users.id` (many-to-one)
- `pendingTickets.user_id` → `users.id` (many-to-one)
- `tickets.user_id` → `users.id` (many-to-one)
- `payments.user_id` → `users.id` (many-to-one)

## Indexes

- `pendingTickets`: Indexes on `user_id` and `status`
- `tickets`: Index on `user_id`
- `payments`: Index on `user_id`
- `session`: Index on `expire` 