import 'dotenv/config';
import { sendPasswordChangedEmail } from '../dist/lib/email.js';

const to = process.argv[2] || 'test@example.com';
const name = (process.argv[3] || to.split('@')[0]).replace(/[^a-zA-Z0-9 _-]/g, '');
const date = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Chicago' });

(async () => {
  try {
    const ok = await sendPasswordChangedEmail(to, name, date);
    console.log(JSON.stringify({ ok }));
  } catch (err) {
    console.error('Error sending password changed:', err);
    process.exitCode = 1;
  }
})();
