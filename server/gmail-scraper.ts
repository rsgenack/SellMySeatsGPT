// server/gmail-scraper.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { users, tickets, type User, type InsertTicket } from '@shared/schema'; // Update with your actual schema import
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

// Gmail API scopes (read-only access)
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export class GmailScraper {
  private oauth2Client: OAuth2Client;
  private gmail: any; // Google Gmail API client

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID, // Store in Replit Secrets
      process.env.GOOGLE_CLIENT_SECRET, // Store in Replit Secrets
      'http://localhost:5000' // Callback URL (adjust for Replit)
    );
  }

  async authenticate() {
    // Load or refresh token from Replit Secrets or file
    const token = process.env.GOOGLE_TOKEN; // Store in Replit Secrets after initial auth
    if (token) {
      this.oauth2Client.setCredentials(JSON.parse(token));
    } else {
      // First-time auth (manual step)
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });
      console.log('Authorize this app by visiting this URL:', authUrl);
      // After authorization, you’ll get a code. Use it to get a token:
      // const { tokens } = await this.oauth2Client.getToken(code);
      // Store tokens in process.env.GOOGLE_TOKEN or a file
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async scrapeTickets() {
    try {
      // Fetch unread emails from forwarding@sellmyseats.com
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'from:@seatxfer.com is:unread', // Only unread emails from @seatxfer.com
      });

      const messages = response.data.messages || [];
      for (const message of messages) {
        const msg = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
        });

        const headers = msg.data.payload?.headers || [];
        let senderEmail: string | undefined;
        for (const header of headers) {
          if (header.name === 'From') {
            senderEmail = header.value?.match(/<([^>]+)>/)?.[1]; // Extract email from "From: Name <email>"
            break;
          }
        }

        if (senderEmail && senderEmail.endsWith('@seatxfer.com')) {
          // Find the user by uniqueEmail
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.uniqueEmail, senderEmail));

          if (!user) {
            console.log(`No user found for email: ${senderEmail}`);
            continue;
          }

          // Look for attachments (e.g., PDFs)
          const parts = msg.data.payload?.parts || [];
          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              const attachment = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id!,
                id: part.body.attachmentId,
              });

              const fileData = Buffer.from(attachment.data.data!, 'base64');
              const fileName = part.filename;
              const filePath = path.join('tickets', `${user.id}_${fileName}`);

              // Save attachment locally (or to cloud storage in production)
              await fs.mkdir('tickets', { recursive: true });
              await fs.writeFile(filePath, fileData);

              // Store ticket in database
              const ticket: InsertTicket = {
                userId: user.id,
                filePath,
                eventName: '', // You’d need to parse this from the email or attachment
                eventDate: '', // Parse from email/attachment
                venue: '',    // Parse from email/attachment
                section: '',  // Parse from email/attachment
                row: '',      // Parse from email/attachment
                seat: '',     // Parse from email/attachment
                askingPrice: 0,
                status: 'pending',
              };

              await db.insert(tickets).values(ticket);
            }
          }

          // Mark email as read
          await this.gmail.users.messages.modify({
            userId: 'me',
            id: message.id!,
            requestBody: { removeLabelIds: ['UNREAD'] },
          });
        }
      }
    } catch (error) {
      console.error('Error scraping tickets:', error);
    }
  }

  async startMonitoring(intervalMs = 300000) { // Check every 5 minutes
    await this.authenticate();
    this.scrapeTickets(); // Initial scrape
    setInterval(() => this.scrapeTickets(), intervalMs);
  }
}

// Usage example (integrate into your server)
export async function initGmailScraper() {
  const scraper = new GmailScraper();
  await scraper.startMonitoring();
}