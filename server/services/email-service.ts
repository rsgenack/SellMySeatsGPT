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
  private status: EmailStatus = {
    isConnected: false,
    lastChecked: null,
    recentEmails: []
  };

  constructor(credentials: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  }) {
    // Gmail requires specific configuration for IMAP
    // Remove any spaces from the password as Google displays it with spaces
    const password = credentials.password.replace(/\s+/g, '');

    this.imap = new Imap({
      ...credentials,
      password,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: credentials.host // Required for Gmail's SSL certificate validation
      },
      authTimeout: 10000, // Increase auth timeout to handle Gmail's 2FA process
      keepalive: false // Prevent keepalive issues with Gmail
    });

    // Add error handling for IMAP connection
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
        // Handle common Gmail authentication errors
        if (err.message.includes('Application-specific password required')) {
          reject(new Error('Gmail requires an App Password for IMAP access. Please generate one from your Google Account settings.'));
        } else if (err.source === 'authentication') {
          reject(new Error('Gmail authentication failed. Please make sure you are using an App Password, not your regular Gmail password.'));
        } else {
          reject(err);
        }
      });
      this.imap.connect();
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

  private async testConnection(): Promise<void> {
    try {
      console.log('Testing IMAP connection with settings:', {
        user: process.env.EMAIL_IMAP_USER,
        host: process.env.EMAIL_IMAP_HOST,
        port: process.env.EMAIL_IMAP_PORT,
        tls: true
      });

      await this.promisifyImapOpen();
      console.log('IMAP connection test successful');
      this.imap.end();
    } catch (error: any) {
      console.error('IMAP connection test failed:', error);
      let errorMessage = 'Failed to connect to IMAP server: ';

      // Enhanced error messaging for Gmail-specific issues
      if (error.message.includes('Application-specific password required')) {
        errorMessage = 'Gmail requires an App Password for IMAP access. Please generate one from your Google Account settings: https://support.google.com/accounts/answer/185833';
      } else if (error.source === 'authentication') {
        errorMessage = 'Invalid username or password. For Gmail accounts, make sure you are using an App Password, not your regular Gmail password.';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += 'Could not connect to server (connection refused)';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage += 'Could not resolve hostname';
      } else {
        errorMessage += error.message;
      }
      throw new Error(errorMessage);
    }
  }

  public async checkEmailConnection(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      console.error('Email connection check failed:', error);
      return false;
    }
  }

  async processNewEmails() {
    try {
      console.log('Starting email processing...');
      await this.promisifyImapOpen();
      this.status.lastChecked = new Date();

      this.imap.openBox('INBOX', false, async (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          throw err;
        }

        console.log('Opened inbox, searching for new emails...');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

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
              from: email.from?.value?.[0]?.address || '',
              date: email.date || new Date(),
              status: 'pending' as const
            };

            console.log('Processing email:', {
              subject: email.subject,
              from: email.from?.value?.[0]?.address,
              to: email.to?.value?.[0]?.address
            });

            // Find user by the recipient email
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.uniqueEmail, email.to?.value?.[0]?.address || ''));

            if (user) {
              console.log('Found matching user:', user.username);

              // Extract ticket information using regex patterns
              const ticketInfo = {
                eventName: email.subject?.split(' - ')[0] || '',
                eventDate: email.text?.match(/Date:\s*(.*)/)?.[1] || '',
                venue: email.text?.match(/Venue:\s*(.*)/)?.[1] || '',
                section: email.text?.match(/Section:\s*(.*)/)?.[1] || '',
                row: email.text?.match(/Row:\s*(.*)/)?.[1] || '',
                seat: email.text?.match(/Seat:\s*(.*)/)?.[1] || '',
              };

              console.log('Extracted ticket information:', ticketInfo);

              // Create pending ticket
              await storage.createPendingTicket({
                userId: user.id,
                emailSubject: email.subject || '',
                emailFrom: email.from?.value?.[0]?.address || '',
                rawEmailData: email,
                extractedData: ticketInfo,
              });

              emailInfo.status = 'processed';
              console.log('Created pending ticket successfully');
            } else {
              console.log('No matching user found for email:', email.to?.value?.[0]?.address);
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
      });
    } finally {
      this.imap.end();
    }
  }
}