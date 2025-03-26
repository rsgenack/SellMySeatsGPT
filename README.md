# TicketTrader

A platform for transferring and managing event tickets. This application allows users to import tickets from email providers (Gmail) and manage ticket listings.

## Features

- User authentication and account management
- Ticket import from Gmail
- Ticket listings and management
- Admin dashboard
- Responsive UI with Shadcn/UI components

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Drizzle ORM
- **API Integration**: Gmail API

## Project Structure

```
/
├── client/              # Frontend React application
├── server/              # Backend Express application
├── shared/              # Shared TypeScript definitions and utilities
├── migrations/          # Database migrations
├── scripts/             # Utility scripts
├── public/              # Static assets
└── docs/                # Documentation
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- PostgreSQL database (or Neon.tech account)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/tickettrader.git
   cd tickettrader
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create `.env` file in the root directory with the following variables:
   ```
   # Database Configuration
   PGDATABASE=neondb
   PGPORT=5432
   PGUSER=your_username
   PGPASSWORD=your_password
   PGHOST=your_host.aws.neon.tech
   DATABASE_URL=postgresql://your_username:your_password@your_host.aws.neon.tech/neondb?sslmode=require

   # Email Configuration
   EMAIL_IMAP_HOST=imap.gmail.com
   EMAIL_IMAP_PORT=993
   EMAIL_IMAP_USER=your_email@example.com
   EMAIL_IMAP_PASSWORD=your_app_password

   # Google API Configuration
   GMAIL_CREDENTIALS={"installed":{"client_id":"your_client_id","project_id":"your_project_id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"your_client_secret","redirect_uris":["http://localhost"]}}
   GOOGLE_TOKEN={"access_token":"your_access_token","refresh_token":"your_refresh_token","token_type":"Bearer"}
   ```

4. Set up the database
   ```bash
   npm run db:setup
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run db:setup` - Set up database tables
- `npm run db:migrate` - Generate migration files
- `npm run db:push` - Push schema changes to the database

## Deployment

This application can be deployed to Heroku or any other Node.js hosting platform:

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Deployment

Last deployment: 2023-07-04T14:25:30.123Z 