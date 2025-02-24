import { simpleParser } from 'mailparser';
import { createConnection } from 'imap';
import { storage } from './storage';
import { db } from './db';
import { pendingTickets, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface EmailConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

export class EmailService {
  private config: EmailConfig;
  private imap: any;

  constructor(config: EmailConfig) {
    this.config = config;
    this.imap = createConnection(config);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', resolve);
      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  async processEmail(email: any) {
    const parsed = await simpleParser(email);
    const toAddress = parsed.to?.text || '';

    // Extract username from the unique email (format: username.random@seatxfer.com)
    const uniqueEmailMatch = toAddress.match(/(.+)\.([a-f0-9]{12})@seatxfer\.com/);
    if (!uniqueEmailMatch) return;

    // Find the user by unique email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.uniqueEmail, toAddress));

    if (!user) return;

    // Extract ticket information from email
    const extractedData = this.extractTicketInfo(parsed.text || '');

    // Create pending ticket
    await db.insert(pendingTickets).values({
      userId: user.id,
      emailSubject: parsed.subject || '',
      emailFrom: parsed.from?.text || '',
      rawEmailData: parsed,
      extractedData,
      status: 'pending',
    });
  }

  private extractTicketInfo(emailText: string) {
    // This is a placeholder for ticket information extraction logic
    // You would need to implement specific parsing based on the email format
    return {
      eventName: '',
      eventDate: '',
      venue: '',
      section: '',
      row: '',
      seat: '',
      price: 0,
    };
  }

  async startListening() {
    await this.connect();

    this.imap.openBox('INBOX', false, (err: Error, box: any) => {
      if (err) throw err;

      this.imap.on('mail', (numNew: number) => {
        // Process new emails
        const fetch = this.imap.seq.fetch(box.messages.total - numNew + 1 + ':*', {
          bodies: '',
        });

        fetch.on('message', (msg: any) => {
          msg.on('body', (stream: any) => {
            this.processEmail(stream);
          });
        });
      });
    });
  }
}