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

    const baseUrl = 'https://api.sellmyseats.com';
    const redirectUri = `${baseUrl}/api/gmail/callback`;
    console.log('Using redirect URI:', redirectUri);

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Try to load existing token from Replit Secrets
    this.loadToken();
  }

  // Load token from Replit Secrets
  private loadToken(): void {
    try {
      const token = process.env.GOOGLE_TOKEN;
      if (token) {
        const parsedToken = JSON.parse(token);
        this.oauth2Client.setCredentials(parsedToken);
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        console.log('Successfully loaded Gmail token from Replit Secrets');
      } else {
        console.log('No Gmail token found in Replit Secrets, authentication will be required');
      }
    } catch (error) {
      console.error('Error loading token from Replit Secrets:', error.message);
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

      console.log(`Checking all recent emails in inbox`);
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: '',
        maxResults: 20
      });

      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} recent messages`);
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

        // Extract the recipient email (should be a @seatxfer.com address)
        const recipientEmail = this.extractOriginalRecipient(email.data.payload) || toAddress;

        console.log('Processing email:', {
          to: toAddress,
          recipientEmail,
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

        // Only process if we can identify the @seatxfer.com recipient
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
              userName: await this.getUsernameFromEmail(recipientEmail).then(user => user?.username || 'Unknown User'),
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
    try {
      const headers = payload.headers || [];
      // Check additional headers for forwarded emails
      const originalTo = headers.find((h: any) =>
        h.name === 'X-Original-To' ||
        h.name === 'Delivered-To' ||
        h.name === 'X-Forwarded-To' ||
        h.name === 'To' ||
        h.name === 'Original-To'
      )?.value;

      if (originalTo?.endsWith('@seatxfer.com')) {
        return originalTo;
      }

      // Check Received headers for the original recipient
      const receivedHeaders = headers.filter((h: any) => h.name === 'Received');
      for (const header of receivedHeaders) {
        const match = header.value?.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
        if (match && match.length > 0) {
          return match[0];
        }
      }

      let emailBody = '';
      if (payload.body?.data) {
        emailBody = Buffer.from(payload.body.data, 'base64').toString();
      } else if (payload.parts) {
        const textPart = payload.parts.find((part: any) => part.mimeType === 'text/plain');
        const htmlPart = payload.parts.find((part: any) => part.mimeType === 'text/html');
        if (textPart?.body?.data) {
          emailBody = Buffer.from(textPart.body.data, 'base64').toString();
        } else if (htmlPart?.body?.data) {
          emailBody = Buffer.from(htmlPart.body.data, 'base64').toString();
        }
      }

      // Look for @seatxfer.com in the body or subject
      const matches = emailBody.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
      if (matches && matches.length > 0) {
        return matches[0];
      }

      const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value;
      if (subjectHeader) {
        const subjectMatches = subjectHeader.match(/[a-zA-Z0-9._%+-]+@seatxfer\.com/g);
        if (subjectMatches && subjectMatches.length > 0) {
          return subjectMatches[0];
        }
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

    const eventNameElement = Array.from(doc.getElementsByTagName('p'))
      .find(p => p instanceof HTMLParagraphElement &&
        !p.textContent?.toLowerCase().includes('transfer'));
    const eventName = eventNameElement?.textContent?.trim() || 'Unknown Event';

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

  async getUsernameFromEmail(email: string): Promise<{ id: number; username: string } | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.uniqueEmail, email));
      return user ? { id: user.id, username: user.username } : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  async authenticate(): Promise<{ isAuthenticated: boolean; authUrl?: string }> {
    try {
      if (this.oauth2Client.credentials && this.oauth2Client.credentials.access_token) {
        if (this.oauth2Client.credentials.expiry_date && this.oauth2Client.credentials.expiry_date <= Date.now()) {
          console.log('Token expired, refreshing...');
          await this.oauth2Client.refreshAccessToken();
          const newTokens = this.oauth2Client.credentials;
          console.log('New token obtained after refresh:', newTokens);
          console.log('Please manually update the GOOGLE_TOKEN secret in Replit Secrets with the following value:');
          console.log(JSON.stringify(newTokens));
        }
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        return { isAuthenticated: true };
      }

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: 'gmail_auth'
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
      console.log('Handling auth callback with code:', code);
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('Received tokens:', tokens);
      this.oauth2Client.setCredentials(tokens);
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      // Log the token for manual update in Replit Secrets
      console.log('Gmail API authenticated successfully. Please manually update the GOOGLE_TOKEN secret in Replit Secrets with the following value:');
      console.log(JSON.stringify(tokens));
    } catch (error) {
      console.error('Error handling auth callback:', error.message);
      console.error('Error details:', error);
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
            const user = await this.getUsernameFromEmail(email.recipientEmail);
            if (!user) {
              console.error(`No user found for email: ${email.recipientEmail}`);
              continue;
            }

            const pendingTicket: InsertPendingTicket = {
              userId: user.id,
              recipientEmail: email.recipientEmail,
              eventName: email.ticketInfo.eventName || '',
              eventDate: email.ticketInfo.eventDate || new Date(),
              eventTime: email.ticketInfo.eventTime || '',
              venue: email.ticketInfo.venue || '',
              city: email.ticketInfo.city || '',
              state: email.ticketInfo.state || '',
              section: email.ticketInfo.section || '',
              row: email.ticketInfo.row || '',
              seat: email.ticketInfo.seat || '',
              emailSubject: email.subject || '',
              emailFrom: email.from || '',
              rawEmailData: '',
              extractedData: email.ticketInfo,
              status: 'pending'
            };

            await db.insert(pendingTickets).values(pendingTicket);
            console.log('Successfully created pending ticket for user:', user.username);
          } catch (error) {
            console.error('Error inserting pending ticket:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error scraping tickets:', error);
    }
  }

  async startMonitoring(intervalMs = 300000) {
    const authResult = await this.authenticate();
    if (!authResult.isAuthenticated && authResult.authUrl) {
      console.log('Gmail scraper not authenticated. Please authorize using this URL:', authResult.authUrl);
      return authResult;
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