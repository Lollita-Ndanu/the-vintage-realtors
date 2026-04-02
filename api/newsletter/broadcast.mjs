import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, char => map[char]);
}

function formatBroadcastEmailHtml(subject, content, unsubscribeUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px; border-bottom: 3px solid #8b7355;">
              <h1 style="margin: 0; font-size: 24px; color: #2c2c2c; font-weight: 600;">${escapeHtml(subject)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <div style="color: #333; font-size: 16px; line-height: 1.6;">
                ${content}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 14px; color: #8b7355; font-weight: 600; text-align: center;">The Vintage Realtors</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #999; text-align: center;">
                Nairobi, Kenya | <a href="https://www.thevintagerealtors.com" style="color: #8b7355; text-decoration: none;">www.thevintagerealtors.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 40px; background-color: #f9f9f9;">
              <p style="margin: 0; font-size: 11px; color: #999; text-align: center;">
                You received this email because you subscribed to The Vintage Realtors newsletter.
                <br><a href="${unsubscribeUrl}" style="color: #8b7355; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const senderEmail = process.env.NEWSLETTER_SENDER_EMAIL || 'newsletters@thevintagerealtors.com';

    if (!supabaseUrl || !supabaseKey || !resendApiKey) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ error: 'Invalid JSON in request body' });
      return;
    }

    const { subject, html_content, text_content, recipients } = body;

    if (!subject || !html_content || !recipients || !Array.isArray(recipients)) {
      res.status(400).json({ error: 'Missing required fields: subject, html_content, recipients' });
      return;
    }

    const resend = new Resend(resendApiKey);
    const results = { sent: 0, failed: 0, errors: [] };

    for (const email of recipients) {
      const unsubscribeUrl = `https://www.thevintagerealtors.com/unsubscribe?email=${encodeURIComponent(email)}`;
      const finalHtml = formatBroadcastEmailHtml(subject, html_content, unsubscribeUrl);

      try {
        const emailResponse = await resend.emails.send({
          from: `The Vintage Realtors <${senderEmail}>`,
          to: [email],
          subject: subject,
          html: finalHtml,
          text: text_content || html_content.replace(/<[^>]*>/g, ''),
        });

        if (emailResponse.error) {
          results.failed++;
          results.errors.push({ email, error: emailResponse.error });
        } else {
          results.sent++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ email, error: err.message });
      }

      if (recipients.indexOf(email) % 10 === 0 && recipients.indexOf(email) > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({
      success: true,
      message: `Campaign sent to ${results.sent} recipients`,
      results,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'An unexpected error occurred', details: error.message });
  }
}
