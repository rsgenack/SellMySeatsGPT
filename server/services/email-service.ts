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
            // First try to get all emails in the inbox
            console.log('Searching for all emails in inbox...');
            const results = await this.promisifyImapSearch(['ALL']);

            console.log(`Found ${results.length} total emails in inbox`);
            this.status.recentEmails = [];

            // Process the most recent 10 emails first
            const recentEmails = results.slice(-10);
            console.log(`Processing ${recentEmails.length} most recent emails`);

            for (const messageId of recentEmails) {
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