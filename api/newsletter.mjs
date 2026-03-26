import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
  
  if (data.name && typeof data.name === 'string') {
    const trimmedName = data.name.trim();
    if (trimmedName.length > 200) {
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
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: data.name ? data.name.trim().slice(0, 200) || 'Subscriber' : 'Subscriber',
      email: data.email ? data.email.trim().toLowerCase().slice(0, 320) : '',
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

function formatWelcomeEmailHtml(data) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Vintage Realtors</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #8b7355;">
              <h1 style="margin: 0; font-size: 28px; color: #2c2c2c; font-weight: 600;">Welcome to Vintage Realtors</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">Dear ${escapeHtml(data.name)},</p>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #333; line-height: 1.6;">Thank you for subscribing to our newsletter! We're thrilled to have you as part of the Vintage Realtors community.</p>
              
              <p style="margin: 0 0 30px; font-size: 16px; color: #333; line-height: 1.6;">As a subscriber, you'll be the first to know about:</p>
              
              <ul style="margin: 0 0 30px; padding-left: 20px; font-size: 16px; color: #333; line-height: 1.8;">
                <li>Exclusive property listings before they hit the market</li>
                <li>Market insights and real estate trends in Kenya</li>
                <li>Special offers and investment opportunities</li>
                <li>Tips for buyers, sellers, and investors</li>
              </ul>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="https://www.thevintagerealtors.com/properties" style="display: inline-block; padding: 14px 32px; background-color: #8b7355; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;">Explore Our Properties</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; font-size: 16px; color: #333; line-height: 1.6;">If you ever have questions about properties or the market, don't hesitate to reach out. We're here to help you find your perfect property.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; font-size: 16px; color: #333;">Warm regards,</p>
              <p style="margin: 0; font-size: 16px; color: #8b7355; font-weight: 600;">The Vintage Realtors Team</p>
              <p style="margin: 10px 0 0; font-size: 14px; color: #666;">
                <a href="https://www.thevintagerealtors.com" style="color: #8b7355; text-decoration: none;">www.thevintagerealtors.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9;">
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">You received this email because you subscribed to the Vintage Realtors newsletter.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatWelcomeEmailText(data) {
  return `Welcome to Vintage Realtors
===============================

Dear ${data.name},

Thank you for subscribing to our newsletter! We're thrilled to have you as part of the Vintage Realtors community.

As a subscriber, you'll be the first to know about:
- Exclusive property listings before they hit the market
- Market insights and real estate trends in Kenya
- Special offers and investment opportunities
- Tips for buyers, sellers, and investors

Explore our properties: https://www.thevintagerealtors.com/properties

If you ever have questions about properties or the market, don't hesitate to reach out. We're here to help you find your perfect property.

Warm regards,
The Vintage Realtors Team
www.thevintagerealtors.com

---
You received this email because you subscribed to the Vintage Realtors newsletter.`;
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
    const senderEmail = process.env.NEWSLETTER_SENDER_EMAIL || 'newsletters@thevintagerealtors.com';

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

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let dbResult = null;
    let dbError = null;
    let isExistingSubscriber = false;

    try {
      const { data: existing } = await supabase
        .from('newsletter_subscriptions')
        .select('id, is_active')
        .eq('email', sanitizedData.email)
        .single();

      if (existing) {
        isExistingSubscriber = true;
        if (existing.is_active) {
          res.status(200).json({
            success: true,
            message: 'You are already subscribed to our newsletter!',
            alreadySubscribed: true,
          });
          return;
        }
        
        const { data, error } = await supabase
          .from('newsletter_subscriptions')
          .update({
            is_active: true,
            name: sanitizedData.name,
            subscribed_at: new Date().toISOString(),
            unsubscribed_at: null,
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) {
          dbError = error;
        } else {
          dbResult = data;
        }
      } else {
        const { data, error } = await supabase
          .from('newsletter_subscriptions')
          .insert([{
            name: sanitizedData.name,
            email: sanitizedData.email,
            is_active: true,
            source: 'website',
          }])
          .select('id')
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          dbError = error;
        } else {
          dbResult = data;
        }
      }
    } catch (err) {
      console.error('Supabase error:', err);
      dbError = err;
    }

    if (dbError && !dbResult) {
      res.status(500).json({
        error: 'Failed to subscribe. Please try again.',
      });
      return;
    }

    let emailSent = false;
    let emailError = null;

    try {
      const resend = new Resend(resendApiKey);
      
      const emailResponse = await resend.emails.send({
        from: `Vintage Realtors <${senderEmail}>`,
        to: [sanitizedData.email],
        subject: 'Welcome to Vintage Realtors Newsletter',
        html: formatWelcomeEmailHtml(sanitizedData),
        text: formatWelcomeEmailText(sanitizedData),
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

    if (!emailSent) {
      console.warn('Welcome email failed, but subscription was saved to database');
    }

    res.status(200).json({
      success: true,
      message: 'Thank you for subscribing! Check your inbox for a welcome message.',
      id: dbResult?.id || null,
      emailSent,
    });
  } catch (unexpectedError) {
    console.error('Unexpected error in handler:', unexpectedError);
    res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: unexpectedError.message 
    });
  }
}
