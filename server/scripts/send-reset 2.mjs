import 'dotenv/config';
import { sendPasswordResetEmail } from '../dist/lib/email.js';

const to = process.argv[2] || 'test@example.com';
const code = process.argv[3] || '654321';

(async () => {
  try {
    const ok = await sendPasswordResetEmail(to, code);
    console.log(JSON.stringify({ ok }));
  } catch (err) {
    console.error('Error sending password reset:', err);
    process.exitCode = 1;
  }
})();
