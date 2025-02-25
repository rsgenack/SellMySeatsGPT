import Imap from 'imap';
import { simpleParser } from 'mailparser';
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
    this.imap = new Imap(credentials);
  }

  private promisifyImapOpen = () => {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', resolve);
      this.imap.once('error', reject);
      this.imap.connect();
    });
  };

  private promisifyImapSearch = (criteria: any[]) => {
    return new Promise((resolve, reject) => {
      this.imap.search(criteria, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  };

  private async fetchEmail(messageId: number): Promise<any> {
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

  async processNewEmails() {
    try {
      await this.promisifyImapOpen();

      this.imap.openBox('INBOX', false, async (err, box) => {
        if (err) throw err;

        // Search for unread emails from the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const results: any = await this.promisifyImapSearch([
          ['SINCE', yesterday.toISOString()],
          'UNSEEN'
        ]);

        for (const messageId of results) {
          const email = await this.fetchEmail(messageId);

          // Find user by the recipient email
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.uniqueEmail, email.to.text));

          if (user) {
            // Create pending ticket for the user
            await storage.createPendingTicket({
              userId: user.id,
              emailSubject: email.subject,
              emailFrom: email.from.text,
              rawEmailData: email,
              extractedData: {
                eventName: email.subject.split(' - ')[0],
                eventDate: email.date,
                venue: email.text.match(/Venue:\s*(.*)/)?.[1] || '',
                section: email.text.match(/Section:\s*(.*)/)?.[1] || '',
                row: email.text.match(/Row:\s*(.*)/)?.[1] || '',
                seat: email.text.match(/Seat:\s*(.*)/)?.[1] || '',
              },
            });
          }
        }
      });
    } finally {
      this.imap.end();
    }
  }
}