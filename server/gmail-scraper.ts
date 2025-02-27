import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { users, pendingTickets, type InsertPendingTicket } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export class GmailScraper {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor() {
    const redirectUri = process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/gmail/callback`
      : 'http://localhost:5000/api/gmail/callback';

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials are required');
    }

    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  }

  async authenticate(): Promise<{ isAuthenticated: boolean; authUrl?: string }> {
    try {
      const token = process.env.GOOGLE_TOKEN;
      if (token) {
        this.oauth2Client.setCredentials(JSON.parse(token));
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        return { isAuthenticated: true };
      }

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: 'gmail_auth' // Optional: Add state for security
      });
      console.log('Please authorize the Gmail API by visiting this URL:', authUrl);
      return { isAuthenticated: false, authUrl };
    } catch (error) {
      console.error('Error during Gmail authentication:', error);
      return { isAuthenticated: false };
    }
  }

  async handleAuthCallback(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      // Store tokens in Replit Secrets securely
      process.env.GOOGLE_TOKEN = JSON.stringify(tokens);
      console.log('Gmail API authenticated successfully. Token stored in GOOGLE_TOKEN.');
    } catch (error) {
      console.error('Error handling auth callback:', error);
      throw error;
    }
  }

  private parseTicketmasterEmail(html: string, recipientEmail: string): Partial<InsertPendingTicket>[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tickets: Partial<InsertPendingTicket>[] = [];

    // Extract event name (first p tag after h1)
    const eventName = Array.from(doc.querySelectorAll('p'))
      .find(p => !p.textContent?.toLowerCase().includes('transfer'))
      ?.textContent?.trim() || 'Unknown Event';

    // Extract date and time
    const dateTimeText = Array.from(doc.querySelectorAll('p'))
      .find(p => p.textContent?.includes('@'))
      ?.textContent?.trim() || '';

    let eventDate = null;
    let eventTime = '';
    if (dateTimeText) {
      const [datePart, timePart] = dateTimeText.split('@').map(part => part.trim());
      const dateStr = datePart.split(', ')[1];
      eventTime = timePart;
      // Assume 2025 for all dates as specified
      eventDate = new Date(`${dateStr}, 2025 ${timePart}`);
    }

    // Extract venue, city, and state
    const locationText = Array.from(doc.querySelectorAll('p'))
      .find(p => p.textContent?.includes(','))
      ?.textContent?.trim() || '';

    let [venue, city, state] = ['', '', ''];
    if (locationText) {
      const parts = locationText.split(',').map(part => part.trim());
      if (parts.length >= 3) {
        [venue, city, state] = parts;
      } else if (parts.length === 2) {
        // Handle Toronto case
        venue = parts[0];
        city = parts[0];
        state = parts[1];
      }
    }

    // Extract seating information
    const seatingInfos = Array.from(doc.querySelectorAll('p'))
      .filter(p => p.textContent?.includes('Section') || p.textContent?.toUpperCase().includes('GENERAL ADMISSION'));

    if (seatingInfos.length === 0 && doc.body.textContent?.toUpperCase().includes('GENERAL ADMISSION')) {
      // Handle general admission case
      tickets.push({
        eventName,
        eventDate: eventDate?.toISOString() || null,
        eventTime,
        venue,
        city,
        state,
        section: 'FLOOR2',
        row: 'N/A',
        seat: 'N/A',
        recipientEmail,
        status: 'pending'
      });
    } else {
      for (const seatInfo of seatingInfos) {
        const text = seatInfo.textContent || '';
        const isGeneralAdmission = text.toUpperCase().includes('GENERAL ADMISSION');

        if (isGeneralAdmission) {
          tickets.push({
            eventName,
            eventDate: eventDate?.toISOString() || null,
            eventTime,
            venue,
            city,
            state,
            section: 'FLOOR2',
            row: 'N/A',
            seat: 'N/A',
            recipientEmail,
            status: 'pending'
          });
        } else {
          const match = text.match(/Section\s+(\w+),\s*Row\s+(\d+),\s*Seat\s+(\d+)/i);
          if (match) {
            tickets.push({
              eventName,
              eventDate: eventDate?.toISOString() || null,
              eventTime,
              venue,
              city,
              state,
              section: match[1],
              row: match[2],
              seat: match[3],
              recipientEmail,
              status: 'pending'
            });
          }
        }
      }
    }

    return tickets;
  }

  async scrapeTickets() {
    try {
      console.log('Starting to scrape tickets from Gmail...');
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'from:customer_support@email.ticketmaster.com is:unread'
      });

      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} unread Ticketmaster messages`);

      for (const message of messages) {
        try {
          console.log(`Processing message ID: ${message.id}`);
          const email = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          // Extract headers
          const headers = email.data.payload.headers;
          const toAddress = headers.find((h: any) => h.name === 'To')?.value;
          const fromAddress = headers.find((h: any) => h.name === 'From')?.value;
          const subject = headers.find((h: any) => h.name === 'Subject')?.value;

          console.log('Processing email:', {
            to: toAddress,
            from: fromAddress,
            subject: subject
          });

          if (!toAddress?.endsWith('@seatxfer.com')) {
            console.log('Skipping non-seatxfer email:', toAddress);
            continue;
          }

          // Find associated user
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.uniqueEmail, toAddress));

          if (!user) {
            console.log(`No user found for email: ${toAddress}`);
            continue;
          }

          console.log(`Found user for email ${toAddress}:`, user.username);

          // Extract HTML content
          let emailHtml = '';
          if (email.data.payload.body?.data) {
            emailHtml = Buffer.from(email.data.payload.body.data, 'base64').toString();
          } else if (email.data.payload.parts) {
            const htmlPart = email.data.payload.parts.find((part: any) => part.mimeType === 'text/html');
            if (htmlPart?.body?.data) {
              emailHtml = Buffer.from(htmlPart.body.data, 'base64').toString();
            }
          }

          console.log('Extracted HTML content length:', emailHtml.length);

          // Parse tickets from email
          const tickets = this.parseTicketmasterEmail(emailHtml, toAddress);
          console.log(`Extracted ${tickets.length} tickets from email:`, tickets);

          // Store each ticket
          for (const ticket of tickets) {
            try {
              const pendingTicket: InsertPendingTicket = {
                userId: user.id,
                recipientEmail: toAddress,
                eventName: ticket.eventName || '',
                eventDate: ticket.eventDate || new Date().toISOString(),
                eventTime: ticket.eventTime || '',
                venue: ticket.venue || '',
                city: ticket.city || '',
                state: ticket.state || '',
                section: ticket.section || '',
                row: ticket.row || '',
                seat: ticket.seat || '',
                emailSubject: subject || '',
                emailFrom: fromAddress || '',
                rawEmailData: emailHtml,
                extractedData: ticket,
                status: 'pending'
              };

              await db.insert(pendingTickets).values(pendingTicket);
              console.log('Successfully created pending ticket for user:', user.username);
            } catch (error) {
              console.error('Error inserting pending ticket:', error);
            }
          }

          // Mark email as read
          await this.gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: { removeLabelIds: ['UNREAD'] }
          });

          console.log('Marked email as read:', message.id);
        } catch (error) {
          console.error('Error processing individual email:', error);
        }
      }
    } catch (error) {
      console.error('Error scraping tickets:', error);
    }
  }

  async startMonitoring(intervalMs = 300000) { // Check every 5 minutes
    const authResult = await this.authenticate();
    if (!authResult.isAuthenticated && authResult.authUrl) {
      console.log('Gmail scraper not authenticated. Please authorize using this URL:', authResult.authUrl);
      return authResult; // Return authUrl for the client to handle
    }

    console.log('Starting Gmail monitoring...');
    await this.scrapeTickets();
    setInterval(() => this.scrapeTickets(), intervalMs);
  }
}

export async function initGmailScraper() {
  const scraper = new GmailScraper();
  try {
    const result = await scraper.startMonitoring();
    if (result && !result.isAuthenticated && result.authUrl) {
      // Here you might want to return or handle this URL in your server routes
      console.log('Authentication required. URL provided in logs.');
    }
  } catch (error) {
    console.error('Failed to initialize Gmail scraper:', error);
  }
}