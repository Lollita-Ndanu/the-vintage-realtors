import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map();

function getClientIP(headers) {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }
  const realIP = headers['x-real-ip'];
  if (realIP) return realIP;
  return 'unknown';
}

function checkRateLimit(clientIP) {
  const now = Date.now();
  const entry = rateLimitStore.get(clientIP);
  
  if (!entry) {
    rateLimitStore.set(clientIP, { count: 1, firstRequest: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientIP, { count: 1, firstRequest: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.firstRequest)) / 1000);
    return { allowed: false, remaining: 0, resetAfter: resetTime };
  }
  
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

function validateInput(data) {
  const errors = [];
  
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Name is required');
  } else {
    const trimmedName = data.name.trim();
    if (trimmedName.length < 2) {
      errors.push('Name must be at least 2 characters');
    } else if (trimmedName.length > 200) {
      errors.push('Name must be less than 200 characters');
    } else if (/[<>'"\\]/.test(trimmedName)) {
      errors.push('Name contains invalid characters');
    }
  }
  
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else {
    const trimmedEmail = data.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Please provide a valid email address');
    } else if (trimmedEmail.length > 320) {
      errors.push('Email address is too long');
    }
  }
  
  if (data.phone && typeof data.phone === 'string') {
    const trimmedPhone = data.phone.trim();
    if (trimmedPhone.length > 30) {
      errors.push('Phone number is too long');
    }
    if (trimmedPhone && !/^[\d\s\+\-\(\)\.]+$/.test(trimmedPhone)) {
      errors.push('Phone number contains invalid characters');
    }
  }
  
  if (!data.message || typeof data.message !== 'string') {
    errors.push('Message is required');
  } else {
    const trimmedMessage = data.message.trim();
    if (trimmedMessage.length < 10) {
      errors.push('Message must be at least 10 characters');
    } else if (trimmedMessage.length > 5000) {
      errors.push('Message must be less than 5000 characters');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: data.name ? data.name.trim().slice(0, 200) : '',
      email: data.email ? data.email.trim().toLowerCase().slice(0, 320) : '',
      phone: data.phone ? data.phone.trim().slice(0, 30) || null : null,
      message: data.message ? data.message.trim().slice(0, 5000) : '',
    },
  };
}

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

function formatEmailHtml(data, timestamp) {
  const phoneSection = data.phone ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Phone</span>
                    <p style="margin: 4px 0 0; font-size: 16px; color: #333;"><a href="tel:${escapeHtml(data.phone.replace(/\s/g, ''))}" style="color: #8b7355; text-decoration: none;">${escapeHtml(data.phone)}</a></p>
                  </td>
                </tr>` : '';
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Inquiry</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px; border-bottom: 3px solid #8b7355;">
              <h1 style="margin: 0; font-size: 24px; color: #2c2c2c; font-weight: 600;">New Contact Inquiry</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px; color: #666; font-size: 14px;">A new contact inquiry has been submitted through the Vintage Realtors website.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Name</span>
                    <p style="margin: 4px 0 0; font-size: 16px; color: #333;">${escapeHtml(data.name)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email</span>
                    <p style="margin: 4px 0 0; font-size: 16px; color: #333;"><a href="mailto:${escapeHtml(data.email)}" style="color: #8b7355; text-decoration: none;">${escapeHtml(data.email)}</a></p>
                  </td>
                </tr>
                ${phoneSection}
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <span style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</span>
                    <p style="margin: 4px 0 0; font-size: 16px; color: #333; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(data.message)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Submitted</span>
                    <p style="margin: 4px 0 0; font-size: 16px; color: #333;">${timestamp}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">This email was automatically sent from the Vintage Realtors website contact form.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatEmailText(data, timestamp) {
  const phoneLine = data.phone ? `Phone: ${data.phone}\n` : '';
  return `NEW CONTACT INQUIRY
==================

A new contact inquiry has been submitted through the Vintage Realtors website.

Name: ${data.name}
Email: ${data.email}
${phoneLine}Message:
${data.message}

Submitted: ${timestamp}

---
This email was automatically sent from the Vintage Realtors website contact form.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const clientIP = getClientIP(req.headers);
    const rateLimitResult = checkRateLimit(clientIP);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.resetAfter,
      });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const senderEmail = process.env.SENDER_EMAIL || 'contacts@vintagerealtors.com';
    const recipientEmail = process.env.CONTACT_EMAIL || 'contacts@vintagerealtors.com';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      res.status(500).json({ error: 'Server configuration error (SUPABASE)' });
      return;
    }

    if (!resendApiKey) {
      console.error('Missing Resend API key');
      res.status(500).json({ error: 'Server configuration error (RESEND)' });
      return;
    }

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      res.status(400).json({ error: 'Invalid JSON in request body' });
      return;
    }

    const validation = validateInput(body);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
      });
      return;
    }

    const sanitizedData = validation.sanitized;
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Africa/Nairobi',
      dateStyle: 'full',
      timeStyle: 'long',
    });

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let dbResult = null;
    let dbError = null;

    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .insert([{
          name: sanitizedData.name,
          email: sanitizedData.email,
          phone: sanitizedData.phone,
          message: sanitizedData.message,
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        dbError = error;
      } else {
        dbResult = data;
      }
    } catch (err) {
      console.error('Supabase connection error:', err);
      dbError = err;
    }

    let emailSent = false;
    let emailError = null;

    try {
      const resend = new Resend(resendApiKey);
      
      const emailResponse = await resend.emails.send({
        from: `Vintage Realtors <${senderEmail}>`,
        to: [recipientEmail],
        subject: `New Contact Inquiry from ${sanitizedData.name}`,
        html: formatEmailHtml(sanitizedData, timestamp),
        text: formatEmailText(sanitizedData, timestamp),
        reply_to: sanitizedData.email,
      });

      if (emailResponse.error) {
        console.error('Resend API error:', emailResponse.error);
        emailError = emailResponse.error;
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.error('Resend error:', err);
      emailError = err;
    }

    if (dbError && !dbResult) {
      res.status(500).json({
        error: 'Failed to save your message. Please try again.',
        reference: timestamp,
      });
      return;
    }

    if (!emailSent) {
      console.warn('Email notification failed, but submission was saved to database');
    }

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      id: dbResult?.id || null,
    });
  } catch (unexpectedError) {
    console.error('Unexpected error in handler:', unexpectedError);
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: unexpectedError.message 
    });
  }
}
