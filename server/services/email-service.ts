import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface EmailStatus {
  isConnected: boolean;
  lastChecked: Date | null;
  isMonitoring: boolean;
  recentEmails: {
    subject: string;
    from: string;
    date: Date;
    status: 'processed' | 'pending' | 'error';
  }[];
}

export class EmailService {
  private imap: Imap;
  private static instance: EmailService | null = null;
  private status: EmailStatus = {
    isConnected: false,
    lastChecked: null,
    isMonitoring: false,
    recentEmails: []
  };
  private monitoringInterval: NodeJS.Timeout | null = null;

  static getInstance(credentials?: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  }): EmailService {
    if (credentials) {
      if (EmailService.instance?.monitoringInterval) {
        clearInterval(EmailService.instance.monitoringInterval);
      }
      if (EmailService.instance?.imap.state === 'authenticated') {
        EmailService.instance.imap.end();
      }
      EmailService.instance = new EmailService(credentials);
    } else if (!EmailService.instance) {
      throw new Error('Email service not initialized');
    }
    return EmailService.instance;
  }

  private constructor(credentials: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  }) {
    const password = credentials.password.replace(/\s+/g, '');

    this.imap = new Imap({
      ...credentials,
      password,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: credentials.host
      },
      authTimeout: 10000,
      keepalive: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.on('error', (err: Error) => {
      console.error('IMAP connection error:', err);
      this.status.isConnected = false;
      this.status.isMonitoring = false;
    });

    this.imap.on('end', () => {
      console.log('IMAP connection ended');
      this.status.isConnected = false;
      this.status.isMonitoring = false;
    });
  }

  getStatus(): EmailStatus {
    return this.status;
  }

  private async promisifyImapOpen(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('IMAP connection established');
        this.status.isConnected = true;
        resolve(true);
      });

      this.imap.once('error', (err) => {
        this.status.isConnected = false;
        if (err.message.includes('Application-specific password required')) {
          reject(new Error('Gmail requires an App Password for IMAP access. Please generate one from your Google Account settings.'));
        } else if (err.source === 'authentication') {
          reject(new Error('Gmail authentication failed. Please make sure you are using an App Password, not your regular Gmail password.'));
        } else {
          reject(err);
        }
      });

      try {
        this.imap.connect();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async checkEmailConnection(): Promise<boolean> {
    try {
      await this.promisifyImapOpen();
      return true;
    } catch (error) {
      console.error('Email connection check failed:', error);
      return false;
    } finally {
      if (this.imap.state === 'authenticated') {
        this.imap.end();
      }
    }
  }

  public async startMonitoring(): Promise<void> {
    try {
      await this.processNewEmails();
      this.status.isMonitoring = true;

      // Check for new emails every 5 minutes
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.processNewEmails();
        } catch (error) {
          console.error('Error in monitoring interval:', error);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      throw error;
    }
  }

  public async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.status.isMonitoring = false;
    if (this.imap.state === 'authenticated') {
      this.imap.end();
    }
  }

  private parseOriginalRecipient(email: ParsedMail): string | undefined {
    // Check the forwarded email headers
    const originalTo = email.headers.get('x-forwarded-to') || 
                      email.headers.get('delivered-to') ||
                      email.headers.get('x-original-to');

    if (originalTo && typeof originalTo === 'string' && originalTo.endsWith('@seatxfer.com')) {
      return originalTo;
    }

    // If not found in headers, try to find in the email body
    const toMatch = (email.text || '').match(/To: ([^\n]*@seatxfer\.com)/i);
    if (toMatch && toMatch[1]) {
      return toMatch[1].trim();
    }

    // Return the direct recipient as fallback
    return email.to?.text;
  }

  private async processNewEmails() {
    try {
      console.log('Starting email processing with detailed logging...');
      await this.promisifyImapOpen();
      this.status.lastChecked = new Date();

      return new Promise((resolve, reject) => {
        this.imap.openBox('INBOX', false, async (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }

          console.log('Successfully opened INBOX, box info:', box);

          try {
            console.log('Searching for all emails in inbox...');
            const results = await this.promisifyImapSearch(['ALL']);

            console.log(`Found ${results.length} total emails in inbox`);
            this.status.recentEmails = [];

            // Process all emails from newest to oldest
            const emailsToProcess = results.reverse().slice(0, 20); // Process last 20 emails
            console.log(`Processing ${emailsToProcess.length} most recent emails`);

            for (const messageId of emailsToProcess) {
              try {
                const email = await this.fetchEmail(messageId);
                console.log('Processing email:', {
                  messageId,
                  subject: email.subject,
                  from: email.from?.text,
                  to: email.to?.text,
                  date: email.date,
                  textAsHtml: email.textAsHtml?.substring(0, 100) // First 100 chars of content
                });

                // Find the original @seatxfer.com recipient
                const originalRecipient = this.parseOriginalRecipient(email);
                console.log('Original recipient found:', originalRecipient);

                const emailInfo = {
                  subject: email.subject || '',
                  from: email.from?.text || '',
                  date: email.date || new Date(),
                  status: 'pending' as const
                };

                // Try to parse ticket information from email body
                const ticketInfo = this.parseTicketInfo(email.text || '');
                console.log('Extracted ticket info:', ticketInfo);

                // Check for user with the original seatxfer.com email
                const [user] = await db
                  .select()
                  .from(users)
                  .where(eq(users.uniqueEmail, originalRecipient));

                if (user) {
                  console.log('Found matching user for email:', {
                    username: user.username,
                    uniqueEmail: user.uniqueEmail,
                    originalRecipient
                  });

                  await storage.createPendingTicket({
                    userId: user.id,
                    emailSubject: email.subject || '',
                    emailFrom: email.from?.text || '',
                    rawEmailData: email,
                    extractedData: {
                      eventName: ticketInfo.eventName || email.subject?.split(' - ')[0] || '',
                      eventDate: ticketInfo.eventDate || email.date?.toISOString() || '',
                      venue: ticketInfo.venue || '',
                      section: ticketInfo.section || '',
                      row: ticketInfo.row || '',
                      seat: ticketInfo.seat || '',
                    },
                  });

                  emailInfo.status = 'processed';
                  console.log('Successfully processed email and created pending ticket');
                } else {
                  console.log('No matching user found for original recipient:', originalRecipient);
                  emailInfo.status = 'error';
                }

                this.status.recentEmails.push(emailInfo);
              } catch (error) {
                console.error('Error processing individual email:', error);
                this.status.recentEmails.push({
                  subject: 'Error processing email',
                  from: 'unknown',
                  date: new Date(),
                  status: 'error'
                });
              }
            }
            resolve(true);
          } catch (error) {
            console.error('Error during email search:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error in processNewEmails:', error);
      throw error;
    } finally {
      if (this.imap.state === 'authenticated') {
        this.imap.end();
      }
    }
  }

  private parseTicketInfo(emailText: string) {
    const info: {
      eventName?: string;
      eventDate?: string;
      venue?: string;
      section?: string;
      row?: string;
      seat?: string;
    } = {};

    // Simple pattern matching for common ticket information formats
    const patterns = {
      eventName: /Event:\s*([^\n]+)/i,
      eventDate: /Date:\s*([^\n]+)/i,
      venue: /Venue:\s*([^\n]+)/i,
      section: /Section:\s*([^\n]+)/i,
      row: /Row:\s*([^\n]+)/i,
      seat: /Seat:\s*([^\n]+)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = emailText.match(pattern);
      if (match && match[1]) {
        info[key as keyof typeof info] = match[1].trim();
      }
    }

    return info;
  }

  private promisifyImapSearch(criteria: any[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  private async fetchEmail(messageId: number): Promise<ParsedMail> {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(messageId, { bodies: '' });

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          try {
            const parsed = await simpleParser(stream);
            resolve(parsed);
          } catch (err) {
            reject(err);
          }
        });
      });

      fetch.once('error', reject);
    });
  }
}