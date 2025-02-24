import { simpleParser } from 'mailparser';
import Imap from 'imap';
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

interface ExtractedTicketData {
  eventName: string;
  eventDate: string;
  venue: string;
  section: string;
  row: string;
  seat: string;
  price: number;
}

export class EmailService {
  private config: EmailConfig;
  private imap: Imap;

  constructor(config: EmailConfig) {
    this.config = config;
    this.imap = new Imap(config);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', resolve);
      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  async processEmail(email: any) {
    try {
      const parsed = await simpleParser(email);
      const toAddress = parsed.to?.text || '';

      // Extract username from the unique email
      const uniqueEmailMatch = toAddress.match(/(.+)\.([a-f0-9]{12})@seatxfer.com/);
      if (!uniqueEmailMatch) {
        console.log('Invalid email address format:', toAddress);
        return;
      }

      // Find the user by unique email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.uniqueEmail, toAddress));

      if (!user) {
        console.log('User not found for email:', toAddress);
        return;
      }

      // Extract ticket information from email
      const extractedData = this.extractTicketInfo(parsed.text || '', parsed.subject || '');

      // Create pending ticket
      await db.insert(pendingTickets).values({
        userId: user.id,
        emailSubject: parsed.subject || '',
        emailFrom: parsed.from?.text || '',
        rawEmailData: parsed,
        extractedData,
        status: 'pending',
      });

      console.log('Successfully processed ticket email for user:', user.username);
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  private extractTicketInfo(emailText: string, subject: string): ExtractedTicketData {
    // Common patterns in ticket forwarding emails
    const patterns = {
      eventName: /Event:\s*([^\n]+)/i,
      eventDate: /Date:\s*([^\n]+)/i,
      venue: /Venue:\s*([^\n]+)/i,
      section: /Section:\s*([^\n]+)/i,
      row: /Row:\s*([^\n]+)/i,
      seat: /Seat(?:s)?:\s*([^\n]+)/i,
      price: /Price:\s*\$?(\d+(?:\.\d{2})?)/i,
    };

    // Try to extract information from the email body
    const extracted: Partial<ExtractedTicketData> = {};

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = emailText.match(pattern);
      if (match) {
        extracted[key as keyof ExtractedTicketData] = match[1].trim();
      }
    }

    // If event name is not found in the patterns, use the subject line
    if (!extracted.eventName && subject) {
      extracted.eventName = subject.replace(/FWD?: /i, '').trim();
    }

    // Convert price to number if found
    if (extracted.price) {
      extracted.price = parseFloat(extracted.price);
    }

    // Return extracted data with fallbacks
    return {
      eventName: extracted.eventName || 'Unknown Event',
      eventDate: extracted.eventDate || 'TBD',
      venue: extracted.venue || 'Unknown Venue',
      section: extracted.section || '',
      row: extracted.row || '',
      seat: extracted.seat || '',
      price: extracted.price || 0,
    };
  }

  async startListening() {
    try {
      await this.connect();

      this.imap.openBox('INBOX', false, (err: Error, box: any) => {
        if (err) {
          console.error('Error opening mailbox:', err);
          return;
        }

        console.log('Successfully connected to email inbox');

        this.imap.on('mail', (numNew: number) => {
          console.log(`Processing ${numNew} new emails`);
          const fetch = this.imap.seq.fetch(box.messages.total - numNew + 1 + ':*', {
            bodies: '',
          });

          fetch.on('message', (msg: any) => {
            msg.on('body', (stream: any) => {
              this.processEmail(stream).catch(error => {
                console.error('Error processing message:', error);
              });
            });
          });
        });
      });
    } catch (error) {
      console.error('Error starting email listener:', error);
    }
  }
}