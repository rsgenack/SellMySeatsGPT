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
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: EmailConfig) {
    this.config = {
      ...config,
      tlsOptions: { 
        rejectUnauthorized: false, // Allow self-signed certificates
        timeout: 30000 // 30 second timeout
      },
      connTimeout: 30000, // Connection timeout
      authTimeout: 30000  // Auth timeout
    };

    this.setupImap();
  }

  private setupImap() {
    console.log('Setting up IMAP connection to:', this.config.host);
    this.imap = new Imap(this.config);

    this.imap.on('error', (err: Error) => {
      console.error('IMAP Error:', err);
      this.scheduleReconnect();
    });

    this.imap.on('end', () => {
      console.log('IMAP connection ended');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.reconnect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, 10000); // Wait 10 seconds before reconnecting
  }

  private async reconnect() {
    try {
      this.setupImap();
      await this.connect();
      console.log('Successfully reconnected to IMAP server');
    } catch (error) {
      console.error('Failed to reconnect:', error);
      this.scheduleReconnect();
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('Connecting to IMAP server:', {
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        tls: this.config.tls
      });

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
        this.imap.destroy();
      }, 30000);

      this.imap.once('ready', () => {
        clearTimeout(connectTimeout);
        console.log('IMAP connection ready');
        resolve(undefined);
      });

      this.imap.once('error', (err) => {
        clearTimeout(connectTimeout);
        console.error('IMAP connection error:', err);
        reject(err);
      });

      try {
        this.imap.connect();
      } catch (error) {
        clearTimeout(connectTimeout);
        console.error('Error during IMAP connect:', error);
        reject(error);
      }
    });
  }

  async processEmail(email: any) {
    try {
      const parsed = await simpleParser(email);
      const toAddress = parsed.to?.text || '';
      const fromAddress = parsed.from?.text || '';

      console.log('Processing new email:', {
        from: fromAddress,
        to: toAddress,
        subject: parsed.subject
      });

      // Extract username from the unique email
      console.log('Processing email sent to:', toAddress);
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

      console.log('Found user:', user.username, 'for email:', toAddress);

      // Extract ticket information from email
      const extractedData = this.extractTicketInfo(parsed.text || '', parsed.subject || '');
      console.log('Extracted ticket data:', extractedData);

      // Create pending ticket
      await db.insert(pendingTickets).values({
        userId: user.id,
        emailSubject: parsed.subject || '',
        emailFrom: fromAddress,
        rawEmailData: parsed,
        extractedData,
        status: 'pending',
      });

      console.log('Successfully created pending ticket for user:', user.username);
    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  private extractTicketInfo(emailText: string, subject: string): ExtractedTicketData {
    console.log('Extracting ticket info from:', { subject, textLength: emailText.length });

    // Common patterns in ticket forwarding emails, including Ticketmaster specific patterns
    const patterns = {
      // Standard patterns
      eventName: /(?:Event|Show|Concert):\s*([^\n]+)/i,
      eventDate: /(?:Date|Event Date|When):\s*([^\n]+)/i,
      venue: /(?:Venue|Location|Where):\s*([^\n]+)/i,
      section: /(?:Section|Sect)\.?\s*#?\s*([^\n]+)/i,
      row: /(?:Row|Rw)\.?\s*#?\s*([^\n]+)/i,
      seat: /(?:Seat|St)(?:s)?\.?\s*#?\s*([^\n]+)/i,
      price: /(?:Price|Amount|Total):\s*\$?(\d+(?:\.\d{2})?)/i,

      // Ticketmaster specific patterns
      tmEventName: /Your tickets for\s+(.+?)(?:\s+at|\s+on|$)/i,
      tmDate: /(?:Performance|Event) Date:\s*([^\n]+)/i,
      tmVenue: /(?:Venue|Location):\s*([^\n]+)/i,
      tmSection: /Section\s*([A-Z0-9]+)/i,
      tmRow: /Row\s*([A-Z0-9]+)/i,
      tmSeat: /Seat\s*([A-Z0-9]+(?:\s*,\s*[A-Z0-9]+)*)/i,
    };

    // Try to extract information from the email body
    const extracted: Partial<ExtractedTicketData> = {};

    // Try standard patterns first
    for (const [key, pattern] of Object.entries(patterns)) {
      if (key.startsWith('tm')) continue; // Skip TM specific patterns for first pass
      const match = emailText.match(pattern);
      if (match) {
        console.log(`Found ${key}:`, match[1].trim());
        if (key === 'price' && match[1]) {
          extracted[key] = parseFloat(match[1]);
        } else {
          extracted[key as keyof ExtractedTicketData] = match[1].trim();
        }
      }
    }

    // If standard patterns didn't find everything, try Ticketmaster specific patterns
    if (!extracted.eventName) {
      const match = emailText.match(patterns.tmEventName);
      if (match) {
        console.log('Found Ticketmaster event name:', match[1].trim());
        extracted.eventName = match[1].trim();
      }
    }

    // Similarly try other TM specific patterns if needed
    for (const [key, pattern] of Object.entries(patterns)) {
      if (!key.startsWith('tm')) continue;
      const standardKey = key.replace('tm', '') as keyof ExtractedTicketData;
      if (!extracted[standardKey]) {
        const match = emailText.match(pattern);
        if (match) {
          console.log(`Found Ticketmaster ${standardKey}:`, match[1].trim());
          if (standardKey === 'price' && match[1]) {
            extracted[standardKey] = parseFloat(match[1]);
          } else {
            extracted[standardKey] = match[1].trim();
          }
        }
      }
    }

    // If event name is still not found in the patterns, use the subject line
    if (!extracted.eventName && subject) {
      extracted.eventName = subject.replace(/(?:FWD|FW)?: /i, '').trim();
      console.log('Using subject as event name:', extracted.eventName);
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

      this.imap.openBox('INBOX', false, (err: Error | null, box: any) => {
        if (err) {
          console.error('Error opening mailbox:', err);
          return;
        }

        console.log('Successfully connected to email inbox');

        // Process existing unread messages
        console.log('Checking for existing messages...');
        const fetch = this.imap.seq.fetch('1:*', {
          bodies: '',
          markSeen: false
        });

        fetch.on('message', (msg: any) => {
          console.log('Processing existing message...');
          msg.on('body', (stream: any) => {
            this.processEmail(stream).catch(error => {
              console.error('Error processing message:', error);
            });
          });
        });

        // Listen for new emails
        this.imap.on('mail', (numNew: number) => {
          console.log(`${numNew} new email(s) received`);
          const fetch = this.imap.seq.fetch(box.messages.total - numNew + 1 + ':*', {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg: any) => {
            console.log('Processing new message...');
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
      this.scheduleReconnect();
    }
  }
}