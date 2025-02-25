import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface EmailStatus {
  isConnected: boolean;
  lastChecked: Date | null;
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
    recentEmails: []
  };

  static getInstance(credentials?: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  }): EmailService {
    // If credentials are provided, always create a new instance
    if (credentials) {
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

    this.imap.on('error', (err: Error) => {
      console.error('IMAP connection error:', err);
      this.status.isConnected = false;
    });
  }

  getStatus(): EmailStatus {
    return this.status;
  }

  private promisifyImapOpen = () => {
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

      this.imap.once('end', () => {
        console.log('IMAP connection ended');
        this.status.isConnected = false;
      });

      try {
        this.imap.connect();
      } catch (err) {
        reject(err);
      }
    });
  };

  private promisifyImapSearch = (criteria: any[]): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  };

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

  public async checkEmailConnection(): Promise<boolean> {
    try {
      console.log('Testing IMAP connection with settings:', {
        user: process.env.EMAIL_IMAP_USER,
        host: process.env.EMAIL_IMAP_HOST,
        port: process.env.EMAIL_IMAP_PORT,
        tls: true
      });

      await this.promisifyImapOpen();
      console.log('IMAP connection test successful');
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

  async processNewEmails() {
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

          console.log('Opened inbox, searching for new emails...');
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          try {
            const results = await this.promisifyImapSearch([
              ['SINCE', yesterday.toISOString()],
              'UNSEEN'
            ]);

            console.log(`Found ${results.length} new emails to process`);
            this.status.recentEmails = [];

            for (const messageId of results) {
              try {
                const email = await this.fetchEmail(messageId);
                const emailInfo = {
                  subject: email.subject || '',
                  from: email.from?.text || '',
                  date: email.date || new Date(),
                  status: 'pending' as const
                };

                console.log('Processing email:', {
                  subject: email.subject,
                  from: email.from?.text,
                  to: email.to?.text
                });

                // Find user by the recipient email
                const [user] = await db
                  .select()
                  .from(users)
                  .where(eq(users.uniqueEmail, email.to?.text || ''));

                if (user) {
                  console.log('Found matching user:', user.username);

                  // Create pending ticket
                  await storage.createPendingTicket({
                    userId: user.id,
                    emailSubject: email.subject || '',
                    emailFrom: email.from?.text || '',
                    rawEmailData: email,
                    extractedData: {
                      eventName: email.subject?.split(' - ')[0] || '',
                      eventDate: email.date?.toISOString() || '',
                      venue: '',
                      section: '',
                      row: '',
                      seat: '',
                    },
                  });

                  emailInfo.status = 'processed';
                  console.log('Created pending ticket successfully');
                } else {
                  console.log('No matching user found for email:', email.to?.text);
                  emailInfo.status = 'error';
                }

                this.status.recentEmails.push(emailInfo);
              } catch (error) {
                console.error('Error processing email:', error);
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
            reject(error);
          }
        });
      });
    } finally {
      if (this.imap.state === 'authenticated') {
        this.imap.end();
      }
    }
  }
}