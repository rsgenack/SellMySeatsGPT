import { simpleParser, type ParsedMail, type AddressObject } from 'mailparser';
import Imap from 'imap';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

type EmailStatus = {
  isConnected: boolean;
  lastChecked: Date | null;
  isMonitoring: boolean;
  recentEmails: {
    subject: string;
    from: string;
    date: Date;
    status: 'processed' | 'pending' | 'error';
  }[];
};

type TicketInfo = {
  eventName: string;
  eventDate: string;
  venue: string;
  section: string;
  row: string;
  seat: string;
};

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
    this.imap = new Imap({
      ...credentials,
      tlsOptions: { rejectUnauthorized: false },
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

  private async processNewEmails(): Promise<void> {
    try {
      console.log('Starting email processing with detailed logging...');
      await this.promisifyImapOpen();
      this.status.lastChecked = new Date();

      await new Promise<void>((resolve, reject) => {
        this.imap.openBox('INBOX', false, async (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }

          console.log('Successfully opened INBOX');

          try {
            const results = await this.promisifyImapSearch(['ALL']);
            console.log(`Found ${results.length} total emails in inbox`);

            const emailsToProcess = results.reverse().slice(0, 20);
            console.log(`Processing ${emailsToProcess.length} most recent emails`);

            for (const messageId of emailsToProcess) {
              try {
                const email = await this.fetchEmail(messageId);
                const toAddress = (email.to as AddressObject)?.text || '';
                const fromAddress = (email.from as AddressObject)?.text || '';

                // Only process emails from @seatxfer.com
                if (!fromAddress.includes('@seatxfer.com')) {
                  continue;
                }

                console.log('Processing email:', {
                  subject: email.subject,
                  from: fromAddress,
                  to: toAddress,
                });

                const [user] = await db
                  .select()
                  .from(users)
                  .where(eq(users.uniqueEmail, toAddress));

                if (user) {
                  console.log('Found matching user:', user.username);

                  const ticketInfo = await this.extractTicketInfo(email);
                  await storage.createPendingTicket({
                    userId: user.id,
                    emailSubject: email.subject || '',
                    emailFrom: fromAddress,
                    rawEmailData: JSON.stringify(email),
                    extractedData: ticketInfo,
                    status: 'pending'
                  });

                  console.log('Successfully processed ticket for user:', user.username);
                } else {
                  console.log('No matching user found for email address:', toAddress);
                }
              } catch (error) {
                console.error('Error processing individual email:', error);
              }
            }
            resolve();
          } catch (error) {
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

  private async extractTicketInfo(email: ParsedMail): Promise<TicketInfo> {
    const info: TicketInfo = {
      eventName: '',
      eventDate: '',
      venue: '',
      section: '',
      row: '',
      seat: '',
    };

    try {
      const emailText = email.text || '';
      const emailHtml = email.html || '';

      // Try to extract from text content first
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
          const match = emailText.match(pattern) || emailHtml.match(pattern);
          if (match && match[1]) {
            info[field as keyof TicketInfo] = match[1].trim();
            break;
          }
        }
      }

      // Fallback to subject line for event name if not found
      if (!info.eventName && email.subject) {
        const subjectParts = email.subject.split(' - ');
        if (subjectParts.length > 0) {
          info.eventName = subjectParts[0].trim();
        }
      }

      console.log('Extracted ticket information:', info);
      return info;
    } catch (error) {
      console.error('Error extracting ticket information:', error);
      return info;
    }
  }

  private async promisifyImapOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('IMAP connection established');
        this.status.isConnected = true;
        resolve();
      });

      this.imap.once('error', (err: Error) => {
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
  private promisifyImapSearch(criteria: any[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (err: Error | null, results: number[]) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }
}