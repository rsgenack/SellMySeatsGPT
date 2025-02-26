import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { users, pendingTickets, type InsertPendingTicket } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export class GmailScraper {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://' + process.env.REPL_SLUG + '.' + process.env.REPL_OWNER + '.repl.co'
    );
  }

  async authenticate() {
    if (!process.env.GOOGLE_TOKEN) {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('Authorize this app by visiting this URL:', authUrl);
      return false;
    }

    try {
      this.oauth2Client.setCredentials(JSON.parse(process.env.GOOGLE_TOKEN));
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      return true;
    } catch (error) {
      console.error('Error setting credentials:', error);
      return false;
    }
  }

  async handleAuthCallback(code: string): Promise<boolean> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      process.env.GOOGLE_TOKEN = JSON.stringify(tokens);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      return true;
    } catch (error) {
      console.error('Error handling auth callback:', error);
      return false;
    }
  }

  private extractTicketInfo(body: string): {
    eventName: string;
    eventDate: string;
    venue: string;
    section: string;
    row: string;
    seat: string;
  } {
    const info = {
      eventName: '',
      eventDate: '',
      venue: '',
      section: '',
      row: '',
      seat: '',
    };

    // Use regex patterns to extract ticket information
    const patterns = {
      eventName: [/Event:\s*([^\n]+)/i, /Event Name:\s*([^\n]+)/i],
      eventDate: [/Date:\s*([^\n]+)/i, /Event Date:\s*([^\n]+)/i],
      venue: [/Venue:\s*([^\n]+)/i, /Location:\s*([^\n]+)/i],
      section: [/Section:\s*([^\n]+)/i, /Sect(?:ion)?\.?\s*([^\n]+)/i],
      row: [/Row:\s*([^\n]+)/i, /Row\.?\s*([^\n]+)/i],
      seat: [/Seat(?:s)?:\s*([^\n]+)/i, /Seat\.?\s*([^\n]+)/i],
    };

    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      for (const pattern of fieldPatterns) {
        const match = body.match(pattern);
        if (match && match[1]) {
          info[field as keyof typeof info] = match[1].trim();
          break;
        }
      }
    }

    return info;
  }

  async processEmails() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'from:@seatxfer.com is:unread', // Filter for unread emails from seatxfer.com
      });

      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} unread messages from seatxfer.com`);

      for (const message of messages) {
        try {
          const email = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          // Extract email headers
          const headers = email.data.payload.headers;
          const toHeader = headers.find((h: any) => h.name === 'To');
          const fromHeader = headers.find((h: any) => h.name === 'From');
          const subjectHeader = headers.find((h: any) => h.name === 'Subject');

          const toAddress = toHeader?.value;
          console.log('Processing email sent to:', toAddress);

          // Find user by unique email
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.uniqueEmail, toAddress));

          if (!user) {
            console.log('No user found for email:', toAddress);
            continue;
          }

          // Extract email body
          let body = '';
          if (email.data.payload.parts) {
            const textPart = email.data.payload.parts.find(
              (part: any) => part.mimeType === 'text/plain'
            );
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString();
            }
          } else if (email.data.payload.body?.data) {
            body = Buffer.from(email.data.payload.body.data, 'base64').toString();
          }

          // Extract ticket information
          const ticketInfo = this.extractTicketInfo(body);
          console.log('Extracted ticket info:', ticketInfo);

          // Create pending ticket
          const pendingTicket: InsertPendingTicket = {
            userId: user.id,
            emailSubject: subjectHeader?.value || '',
            emailFrom: fromHeader?.value || '',
            rawEmailData: body,
            extractedData: ticketInfo,
            status: 'pending',
          };

          await db.insert(pendingTickets).values(pendingTicket);
          console.log('Created pending ticket for user:', user.username);

          // Mark email as read
          await this.gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: { removeLabelIds: ['UNREAD'] },
          });

        } catch (error) {
          console.error('Error processing individual email:', error);
        }
      }
    } catch (error) {
      console.error('Error processing emails:', error);
    }
  }

  async startMonitoring(intervalMs = 120000) { // Check every 2 minutes
    const isAuthenticated = await this.authenticate();
    if (!isAuthenticated) {
      console.log('Gmail scraper not authenticated. Please authorize first.');
      return;
    }

    console.log('Starting Gmail monitoring...');
    await this.processEmails(); // Initial check
    setInterval(() => this.processEmails(), intervalMs);
  }
}

export async function initGmailScraper() {
  const scraper = new GmailScraper();
  await scraper.startMonitoring();
}