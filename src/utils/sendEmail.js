const nodemailer = require('nodemailer');

// Chooses how to send based on which variables are set:
//  - BREVO_API_KEY + EMAIL_FROM_ADDRESS -> Brevo over HTTPS (works on Render's free tier)
//  - EMAIL_USER + EMAIL_PASS            -> Gmail SMTP (works locally, blocked on Render free)
async function sendWithBrevo({ to, subject, text, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'FoodSynk', email: process.env.EMAIL_FROM_ADDRESS },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

let transporter;
async function sendWithGmail({ to, subject, text, html }) {
  transporter ||= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({ from: `FoodSynk <${process.env.EMAIL_USER}>`, to, subject, text, html });
}

module.exports = async function sendEmail(message) {
  if (process.env.BREVO_API_KEY && process.env.EMAIL_FROM_ADDRESS) return sendWithBrevo(message);
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return sendWithGmail(message);
  throw new Error('Email is not configured: set BREVO_API_KEY + EMAIL_FROM_ADDRESS, or EMAIL_USER + EMAIL_PASS');
};