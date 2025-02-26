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
        reject(err);
      });

      try {
        this.imap.connect();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async startMonitoring(): Promise<void> {
    try {
      await this.processNewEmails();
      this.status.isMonitoring = true;

      // Check for new emails every 2 minutes
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.processNewEmails();
        } catch (error) {
          console.error('Error in monitoring interval:', error);
        }
      }, 2 * 60 * 1000);
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

            // Process emails from newest to oldest
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

                const emailInfo = {
                  subject: email.subject || '',
                  from: email.from?.text || '',
                  date: email.date || new Date(),
                  status: 'pending' as const
                };

                // Extract ticket information using multiple parsing strategies
                const ticketInfo = await this.extractTicketInfo(email);
                console.log('Extracted ticket info:', ticketInfo);

                // Check if the email is addressed to a unique email in our system
                const [user] = await db
                  .select()
                  .from(users)
                  .where(eq(users.uniqueEmail, email.to?.text || ''));

                if (user) {
                  console.log('Found matching user for email:', {
                    username: user.username,
                    uniqueEmail: user.uniqueEmail,
                    emailTo: email.to?.text
                  });

                  await storage.createPendingTicket({
                    userId: user.id,
                    emailSubject: email.subject || '',
                    emailFrom: email.from?.text || '',
                    rawEmailData: email,
                    extractedData: ticketInfo,
                  });

                  emailInfo.status = 'processed';
                  console.log('Successfully processed email and created pending ticket');
                } else {
                  console.log('No matching user found for email address:', email.to?.text);
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

  private async extractTicketInfo(email: ParsedMail) {
    const info = {
      eventName: '',
      eventDate: '',
      venue: '',
      section: '',
      row: '',
      seat: '',
    };

    try {
      // Strategy 1: Look for structured patterns in email body
      const patterns = {
        eventName: [/Event:\s*([^\n]+)/i, /Event Name:\s*([^\n]+)/i],
        eventDate: [/Date:\s*([^\n]+)/i, /Event Date:\s*([^\n]+)/i, /When:\s*([^\n]+)/i],
        venue: [/Venue:\s*([^\n]+)/i, /Location:\s*([^\n]+)/i, /Where:\s*([^\n]+)/i],
        section: [/Section:\s*([^\n]+)/i, /Sect(?:ion)?\.?\s*([^\n]+)/i],
        row: [/Row:\s*([^\n]+)/i, /Row\.?\s*([^\n]+)/i],
        seat: [/Seat(?:s)?:\s*([^\n]+)/i, /Seat\.?\s*([^\n]+)/i],
      };

      const emailText = email.text || '';
      const emailHtml = email.html || '';

      // Try each pattern for each field
      for (const [field, fieldPatterns] of Object.entries(patterns)) {
        for (const pattern of fieldPatterns) {
          const match = emailText.match(pattern) || emailHtml.match(pattern);
          if (match && match[1]) {
            info[field as keyof typeof info] = match[1].trim();
            break;
          }
        }
      }

      // Strategy 2: Parse subject line for event name and date
      if (!info.eventName && email.subject) {
        const subjectParts = email.subject.split(' - ');
        if (subjectParts.length > 0) {
          info.eventName = info.eventName || subjectParts[0].trim();
        }
      }

      // Strategy 3: Look for date patterns in the text
      if (!info.eventDate) {
        const datePatterns = [
          /\d{1,2}\/\d{1,2}\/\d{2,4}/,
          /\d{4}-\d{2}-\d{2}/,
          /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}/i
        ];

        for (const pattern of datePatterns) {
          const match = emailText.match(pattern);
          if (match) {
            info.eventDate = match[0];
            break;
          }
        }
      }

      console.log('Extracted ticket information:', info);
      return info;
    } catch (error) {
      console.error('Error extracting ticket information:', error);
      return info;
    }
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