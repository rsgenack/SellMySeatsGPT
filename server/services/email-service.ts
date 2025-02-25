import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class EmailService {
  private imap: Imap;

  constructor(credentials: {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean;
  }) {
    this.imap = new Imap({
      ...credentials,
      tlsOptions: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Add error handling for IMAP connection
    this.imap.on('error', (err: Error) => {
      console.error('IMAP connection error:', err);
    });
  }

  private promisifyImapOpen = () => {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('IMAP connection established');
        resolve(true);
      });
      this.imap.once('error', reject);
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

  async testConnection(): Promise<void> {
    try {
      console.log('Testing IMAP connection with settings:', {
        user: this.imap.user,
        host: this.imap.host,
        port: this.imap.port,
        tls: this.imap.options.tls
      });

      await this.promisifyImapOpen();
      console.log('IMAP connection test successful');
      this.imap.end();
    } catch (error: any) {
      console.error('IMAP connection test failed:', error);
      // Enhance error message based on common IMAP issues
      let errorMessage = 'Failed to connect to IMAP server: ';
      if (error.source === 'authentication') {
        errorMessage += 'Invalid username or password';
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

  async processNewEmails() {
    try {
      console.log('Starting email processing...');
      await this.promisifyImapOpen();

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

        for (const messageId of results) {
          try {
            const email = await this.fetchEmail(messageId);
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

              console.log('Created pending ticket successfully');
            } else {
              console.log('No matching user found for email:', email.to?.value?.[0]?.address);
            }
          } catch (error) {
            console.error('Error processing email:', error);
          }
        }
      });
    } finally {
      this.imap.end();
    }
  }
}