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
    // If there's no instance yet, try to create one from environment variables
    if (!EmailService.instance) {
      if (process.env.EMAIL_IMAP_USER && 
          process.env.EMAIL_IMAP_PASSWORD && 
          process.env.EMAIL_IMAP_HOST && 
          process.env.EMAIL_IMAP_PORT) {
        EmailService.instance = new EmailService({
          user: process.env.EMAIL_IMAP_USER,
          password: process.env.EMAIL_IMAP_PASSWORD,
          host: process.env.EMAIL_IMAP_HOST,
          port: parseInt(process.env.EMAIL_IMAP_PORT),
          tls: true
        });
      }
    }

    // If credentials are provided, update the instance
    if (credentials) {
      if (EmailService.instance?.monitoringInterval) {
        clearInterval(EmailService.instance.monitoringInterval);
      }
      if (EmailService.instance?.imap.state === 'authenticated') {
        EmailService.instance.imap.end();
      }
      EmailService.instance = new EmailService(credentials);
    }

    if (!EmailService.instance) {
      throw new Error('Email service not initialized and no credentials provided');
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
    // Remove any spaces from the password as Google displays it with spaces
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

  private async processNewEmails() {
    try {
      console.log('Starting email processing...');
      await this.promisifyImapOpen();
      this.status.lastChecked = new Date();

      return new Promise((resolve, reject) => {
        this.imap.openBox('INBOX', false, async (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }

          console.log('Opened inbox, searching for emails...');

          try {
            // Search for all emails
            console.log('Searching for all emails in inbox...');
            const results = await this.promisifyImapSearch(['ALL']);

            console.log(`Found ${results.length} total emails in inbox`);
            this.status.recentEmails = [];

            // Process all emails in batches of 10
            const emailBatches = [];
            for (let i = 0; i < results.length; i += 10) {
              emailBatches.push(results.slice(i, i + 10));
            }

            console.log(`Processing ${emailBatches.length} batches of emails`);

            for (const batch of emailBatches) {
              for (const messageId of batch) {
                try {
                  const email = await this.fetchEmail(messageId);
                  console.log('Processing email:', {
                    messageId,
                    subject: email.subject,
                    from: email.from?.text,
                    to: email.to?.text,
                    date: email.date
                  });

                  const emailInfo = {
                    subject: email.subject || '',
                    from: email.from?.text || '',
                    date: email.date || new Date(),
                    status: 'pending' as const
                  };

                  const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.uniqueEmail, email.to?.text || ''));

                  if (user) {
                    console.log('Found matching user:', user.username);

                    await storage.createPendingTicket({
                      userId: user.id,
                      emailSubject: email.subject || '',
                      emailFrom: email.from?.text || '',
                      rawEmailData: email,
                      extractedData: {
                        eventName: email.subject?.split(' - ')[0] || '',
                        eventDate: email.date?.toISOString() || '',
                        venue: email.text || '',
                        section: '',
                        row: '',
                        seat: '',
                      },
                    });

                    emailInfo.status = 'processed';
                    console.log('Successfully processed email:', email.subject);
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