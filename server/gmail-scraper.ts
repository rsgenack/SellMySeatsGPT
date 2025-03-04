import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { JSDOM } from 'jsdom';
import { db } from './db';
import { users, pendingTickets, type InsertPendingTicket } from '@shared/schema';
import { eq } from 'drizzle-orm';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const CATCHALL_EMAIL = 'Forwarding@sellmyseats.com';

export class GmailScraper {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private isMonitoringActive: boolean = false;
  private lastChecked: Date | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials are required');
    }

    console.log('Initializing Gmail scraper with client ID:', process.env.GOOGLE_CLIENT_ID.substring(0, 8) + '...');

    // Use the deployment URL or localhost for development
    const baseUrl = process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';

    const redirectUri = `${baseUrl}/api/gmail/callback`;
    console.log('Using redirect URI:', redirectUri);

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Try to load existing token
    const token = process.env.GOOGLE_TOKEN;
    if (token) {
      try {
        this.oauth2Client.setCredentials(JSON.parse(token));
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        console.log('Successfully loaded existing Gmail credentials');
      } catch (error) {
        console.error('Error loading stored Gmail credentials:', error);
      }
    } else {
      console.log('No existing Gmail token found, authentication will be required');
    }
  }

  isMonitoring(): boolean {
    return this.isMonitoringActive;
  }

  getLastChecked(): Date | null {
    return this.lastChecked;
  }

  async getRecentEmails() {
    try {
      if (!this.gmail) {
        console.log('Gmail API not initialized');
        return [];
      }

      console.log(`Checking emails for catchall address: ${CATCHALL_EMAIL}`);
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: `to:${CATCHALL_EMAIL}`,
        maxResults: 20
      });

      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} messages for catchall address`);
      const recentEmails = [];

      for (const message of messages) {
        const email = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const headers = email.data.payload.headers;
        const toAddress = headers.find((h: any) => h.name === 'To')?.value;
        const fromAddress = headers.find((h: any) => h.name === 'From')?.value;
        const subject = headers.find((h: any) => h.name === 'Subject')?.value;
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        // Extract forwarded recipient if it's a forwarded email
        const originalRecipient = this.extractOriginalRecipient(email.data.payload);
        const recipientEmail = originalRecipient || toAddress;

        console.log('Processing email:', {
          to: toAddress,
          originalRecipient,
          from: fromAddress,
          subject,
          date
        });

        let emailHtml = '';
        if (email.data.payload.body?.data) {
          emailHtml = Buffer.from(email.data.payload.body.data, 'base64').toString();
        } else if (email.data.payload.parts) {
          const htmlPart = email.data.payload.parts.find((part: any) => part.mimeType === 'text/html');
          if (htmlPart?.body?.data) {
            emailHtml = Buffer.from(htmlPart.body.data, 'base64').toString();
          }
        }

        // Only process if we can identify the original @seatxfer.com recipient
        if (recipientEmail?.endsWith('@seatxfer.com')) {
          const ticketInfo = this.parseTicketmasterEmail(emailHtml, recipientEmail);

          if (ticketInfo.length > 0) {
            console.log(`Found ticket information for ${recipientEmail}`);
            recentEmails.push({
              subject,
              from: fromAddress,
              date: new Date(date).toISOString(),
              status: 'pending',
              recipientEmail,
              userName: await this.getUsernameFromEmail(recipientEmail),
              ticketInfo: ticketInfo[0]
            });
          }
        }
      }

      return recentEmails;
    } catch (error) {
      console.error('Error getting recent emails:', error);
      return [];
    }
  }

  private extractOriginalRecipient(payload: any): string | null {
    // Try to find the original recipient from email headers or body
    // This is needed when emails are forwarded to the catchall address
    try {
      const headers = payload.headers;
      // Check common forwarded email headers
      const originalTo = headers.find((h: any) =>
        h.name === 'X-Original-To' ||
        h.name === 'Delivered-To' ||
        h.name === 'X-Forwarded-To'
      )?.value;

      if (originalTo?.endsWith('@seatxfer.com')) {
        return originalTo;
      }

      // If not found in headers, try to parse from email body
      let emailBody = '';
      if (payload.body?.data) {
        emailBody = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.parts) {
        const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          emailBody = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      // Look for email addresses ending with @seatxfer.com in the body
      const matches = emailBody.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
      if (matches && matches.length > 0) {
        return matches[0];
      }

      return null;
    } catch (error) {
      console.error('Error extracting original recipient:', error);
      return null;
    }
  }

  private parseTicketmasterEmail(html: string, recipientEmail: string): Partial<InsertPendingTicket>[] {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const tickets: Partial<InsertPendingTicket>[] = [];

    // Extract event name (first p tag after h1)
    const eventNameElement = Array.from(doc.getElementsByTagName('p'))
      .find(p => p instanceof HTMLParagraphElement &&
        !p.textContent?.toLowerCase().includes('transfer'));
    const eventName = eventNameElement?.textContent?.trim() || 'Unknown Event';

    // Extract date and time
    const dateTimeElement = Array.from(doc.getElementsByTagName('p'))
      .find(p => p instanceof HTMLParagraphElement &&
        p.textContent?.includes('@'));
    const dateTimeText = dateTimeElement?.textContent?.trim() || '';

    let eventDate: Date | null = null;
    let eventTime = '';
    if (dateTimeText) {
      const [datePart, timePart] = dateTimeText.split('@').map(part => part.trim());
      const dateStr = datePart.split(', ')[1];
      eventTime = timePart;
      try {
        const parsedDate = new Date(`${dateStr}, 2025 ${timePart}`);
        eventDate = parsedDate;
      } catch (error) {
        console.error('Error parsing date:', error);
        eventDate = null;
      }
    }

    // Extract venue, city, and state
    const locationElement = Array.from(doc.getElementsByTagName('p'))
      .find(p => p instanceof HTMLParagraphElement &&
        p.textContent?.includes(','));
    const locationText = locationElement?.textContent?.trim() || '';

    let [venue, city, state] = ['', '', ''];
    if (locationText) {
      const parts = locationText.split(',').map(part => part.trim());
      if (parts.length >= 3) {
        [venue, city, state] = parts;
      } else if (parts.length === 2) {
        venue = parts[0];
        city = parts[0];
        state = parts[1];
      }
    }

    // Extract seating information
    const seatingInfos = Array.from(doc.getElementsByTagName('p'))
      .filter(p => p instanceof HTMLParagraphElement &&
        (p.textContent?.includes('Section') ||
          p.textContent?.toUpperCase().includes('GENERAL ADMISSION')));

    if (seatingInfos.length === 0 && doc.body.textContent?.toUpperCase().includes('GENERAL ADMISSION')) {
      tickets.push({
        eventName,
        eventDate,
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
            eventDate,
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
              eventDate,
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

  async getUsernameFromEmail(email: string): Promise<string> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.uniqueEmail, email));
      return user?.username || 'Unknown User';
    } catch (error) {
      console.error('Error getting username:', error);
      return 'Unknown User';
    }
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

  async scrapeTickets() {
    try {
      console.log('Starting to scrape tickets from Gmail...');
      this.lastChecked = new Date();
      const recentEmails = await this.getRecentEmails();
      for (const email of recentEmails) {
        if (email.ticketInfo) {
          try {
            const pendingTicket: InsertPendingTicket = {
              userId: (await this.getUsernameFromEmail(email.recipientEmail)).id,
              recipientEmail: email.recipientEmail,
              eventName: email.ticketInfo.eventName || '',
              eventDate: email.ticketInfo.eventDate || new Date().toISOString(),
              eventTime: email.ticketInfo.eventTime || '',
              venue: email.ticketInfo.venue || '',
              city: email.ticketInfo.city || '',
              state: email.ticketInfo.state || '',
              section: email.ticketInfo.section || '',
              row: email.ticketInfo.row || '',
              seat: email.ticketInfo.seat || '',
              emailSubject: email.subject || '',
              emailFrom: email.from || '',
              rawEmailData: '', //Not implemented in new method
              extractedData: email.ticketInfo,
              status: 'pending'
            };

            await db.insert(pendingTickets).values(pendingTicket);
            console.log('Successfully created pending ticket for user:', email.userName);
          } catch (error) {
            console.error('Error inserting pending ticket:', error);
          }
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

    this.isMonitoringActive = true;
    console.log('Starting Gmail monitoring...');
    this.monitoringInterval = setInterval(async () => {
      await this.scrapeTickets();
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoringActive = false;
      console.log('Gmail monitoring stopped.');
    }
  }
}

export async function initGmailScraper() {
  try {
    console.log('Initializing Gmail scraper...');
    const scraper = new GmailScraper();

    // Add explicit error handling for authentication
    try {
      const authResult = await scraper.authenticate();

      if (!authResult.isAuthenticated && authResult.authUrl) {
        console.log('Authentication required. Please visit this URL to authenticate:');
        console.log(authResult.authUrl);
        return { scraper, authUrl: authResult.authUrl };
      } else {
        console.log('Gmail scraper authenticated successfully.');
        return { scraper, authUrl: null };
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return { error: 'Failed to authenticate with Gmail API' };
    }
  } catch (error) {
    console.error('Failed to initialize Gmail scraper:', error);
    return { error: 'Failed to initialize Gmail scraper' };
  }
}