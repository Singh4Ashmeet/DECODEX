import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Sending test email from:', process.env.GMAIL_USER);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  debug: true, 
  logger: true 
});

transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: 'ashmeet.singh.talwar1@gmail.com',
  subject: 'Decodex Diagnostic Test',
  text: 'This is a raw test to verify SMTP delivery is working.'
}, (err, info) => {
  if (err) {
    console.error('SMTP ERROR:', err);
  } else {
    console.log('SMTP SUCCESS:', info.response);
  }
  process.exit(0);
});
