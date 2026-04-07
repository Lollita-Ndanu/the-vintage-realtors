import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin() {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_KEY || requiredEnv('SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function getResendClient() {
  return new Resend(requiredEnv('RESEND_API_KEY'));
}

async function resendApiRequest(pathname) {
  const response = await fetch(`https://api.resend.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${requiredEnv('RESEND_API_KEY')}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Resend request failed for ${pathname}`);
  }

  return payload;
}

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-resend-signature, x-resend-timestamp',
    'Access-Control-Max-Age': '86400',
  };
}

export function setCors(res) {
  const headers = getCorsHeaders();
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function normalizeSubject(subject = '') {
  return subject.replace(/^(re|fw|fwd):\s*/i, '').trim().toLowerCase();
}

export function htmlSnippet(html = '', fallback = '') {
  const text = (fallback || html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text.slice(0, 180);
}

export function parseAddressList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

export function extractEmailAddress(input = '') {
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim().toLowerCase();
}

export function mergeParticipants(...groups) {
  const set = new Set();
  groups.flat().filter(Boolean).forEach((value) => set.add(extractEmailAddress(value)));
  return Array.from(set);
}

export function buildThreadReferences(messages = []) {
  return messages
    .map((message) => message.message_id)
    .filter(Boolean)
    .join(' ');
}

export async function getMailboxByAddress(supabase, address) {
  const normalizedAddress = extractEmailAddress(address);
  const { data, error } = await supabase
    .from('email_mailboxes')
    .select('*')
    .eq('address', normalizedAddress)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getDefaultMailbox(supabase) {
  const { data, error } = await supabase
    .from('email_mailboxes')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('address', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureMailbox(supabase, address) {
  if (!address) return null;

  const existing = await getMailboxByAddress(supabase, address);
  if (existing) return existing;

  const normalizedAddress = extractEmailAddress(address);
  const defaultMailbox = await getDefaultMailbox(supabase);
  const displayName = normalizedAddress.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const { data, error } = await supabase
    .from('email_mailboxes')
    .insert([{ address: normalizedAddress, display_name: displayName, direction_mode: 'send_receive', is_default: !defaultMailbox }])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function findMatchingContact(supabase, email) {
  const normalized = extractEmailAddress(email);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('contact_submissions')
    .select('id, name, email')
    .ilike('email', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findThreadForInbound(supabase, mailboxId, receivedEmail) {
  const references = [receivedEmail.in_reply_to, ...(receivedEmail.references ? receivedEmail.references.split(/\s+/) : [])].filter(Boolean);

  if (references.length > 0) {
    const { data, error } = await supabase
      .from('email_messages')
      .select('thread_id')
      .in('message_id', references)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.thread_id) return data.thread_id;
  }

  const normalizedSubject = normalizeSubject(receivedEmail.subject);
  const sender = extractEmailAddress(receivedEmail.from || '');

  const { data, error } = await supabase
    .from('email_threads')
    .select('id, participants, normalized_subject')
    .eq('mailbox_id', mailboxId)
    .eq('normalized_subject', normalizedSubject)
    .order('last_message_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data || []).find((thread) => Array.isArray(thread.participants) && thread.participants.includes(sender))?.id || null;
}

export async function upsertInboundThread({ supabase, mailbox, email }) {
  const matchedContact = await findMatchingContact(supabase, email.from);
  const threadId = await findThreadForInbound(supabase, mailbox.id, email);
  const participants = mergeParticipants([email.from], email.to, email.cc, email.reply_to);

  if (threadId) {
    const { data, error } = await supabase
      .from('email_threads')
      .update({
        subject: email.subject || '',
        normalized_subject: normalizeSubject(email.subject),
        last_message_at: email.created_at || new Date().toISOString(),
        unread_count: 1,
        participants,
        contact_id: matchedContact?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('email_threads')
    .insert([{
      mailbox_id: mailbox.id,
      subject: email.subject || '',
      normalized_subject: normalizeSubject(email.subject),
      status: 'open',
      last_message_at: email.created_at || new Date().toISOString(),
      unread_count: 1,
      participants,
      contact_id: matchedContact?.id || null,
      metadata: {},
    }])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function insertInboundMessage({ supabase, thread, mailbox, email }) {
  const { data, error } = await supabase
    .from('email_messages')
    .upsert([{
      thread_id: thread.id,
      mailbox_id: mailbox.id,
      direction: 'inbound',
      resend_email_id: email.id,
      message_id: email.message_id,
      in_reply_to: email.in_reply_to || null,
      references_header: email.references || null,
      from_address: extractEmailAddress(email.from || ''),
      to_addresses: parseAddressList(email.to),
      cc_addresses: parseAddressList(email.cc),
      bcc_addresses: parseAddressList(email.bcc),
      reply_to_addresses: parseAddressList(email.reply_to),
      subject: email.subject || '',
      html_body: email.html || null,
      text_body: email.text || null,
      snippet: htmlSnippet(email.html || '', email.text || ''),
      received_at: email.created_at || new Date().toISOString(),
      raw_download_url: email.raw?.download_url || null,
      headers: email.headers || {},
      metadata: {},
    }], { onConflict: 'resend_email_id,direction' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function replaceAttachments({ supabase, messageId, attachments }) {
  const { error: deleteError } = await supabase
    .from('email_attachments')
    .delete()
    .eq('message_id', messageId);

  if (deleteError) throw deleteError;

  if (!attachments?.length) return [];

  const { data, error } = await supabase
    .from('email_attachments')
    .insert(attachments.map((attachment) => ({
      message_id: messageId,
      resend_attachment_id: attachment.id || null,
      filename: attachment.filename || 'attachment',
      content_type: attachment.content_type || null,
      size: attachment.size || null,
      content_disposition: attachment.content_disposition || null,
      content_id: attachment.content_id || null,
    })))
    .select('*');

  if (error) throw error;
  return data;
}

export async function syncReceivedEmail({ supabase, resend, emailId }) {
  const receivedEmail = await resendApiRequest(`/emails/receiving/${emailId}`);
  const mailboxAddress = Array.isArray(receivedEmail.to) ? receivedEmail.to[0] : receivedEmail.to;
  const mailbox = await ensureMailbox(supabase, mailboxAddress);

  if (!mailbox || !getMailboxDirectionAllowsReceive(mailbox)) {
    return null;
  }

  const thread = await upsertInboundThread({ supabase, mailbox, email: receivedEmail });
  const message = await insertInboundMessage({ supabase, thread, mailbox, email: receivedEmail });
  await replaceAttachments({ supabase, messageId: message.id, attachments: receivedEmail.attachments || [] });
  return { thread, message };
}

export async function syncRecentReceivedEmails({ supabase, resend, limit = 25 }) {
  const response = await resendApiRequest(`/emails/receiving?limit=${limit}`);
  const emails = response.data || [];

  for (const email of emails) {
    await syncReceivedEmail({ supabase, resend, emailId: email.id });
  }
}

export async function logEmailEvent(supabase, eventType, externalId, payload, processedAt = null) {
  const { error } = await supabase.from('email_events').insert([{
    event_type: eventType,
    external_id: externalId,
    payload,
    processed_at: processedAt,
  }]);

  if (error) throw error;
}

export async function requireAdminUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.slice('Bearer '.length);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error('Unauthorized');
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}

export function buildThreadResponse(thread, messages = [], notes = []) {
  return {
    ...thread,
    messages: messages.map((message) => ({
      ...message,
      attachments: message.attachments || [],
    })),
    notes,
  };
}

export function verifyWebhookSignature(rawBody, signature, timestamp) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature || !timestamp) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function mapInboxError(error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  if (message.includes("Could not find the table 'public.email_")) {
    const setupError = new Error('Inbox setup incomplete: run the latest supabase-schema.sql migration to create the email tables.');
    setupError.statusCode = 503;
    return setupError;
  }
  return error;
}

export function formatFromHeader(mailbox, addressOverride) {
  const address = addressOverride || mailbox.address;
  const name = mailbox.display_name || address.split('@')[0];
  return `${name} <${address}>`;
}

export function getMailboxDirectionAllowsSend(mailbox) {
  return mailbox && (mailbox.direction_mode === 'send_only' || mailbox.direction_mode === 'send_receive');
}

export function getMailboxDirectionAllowsReceive(mailbox) {
  return mailbox && (mailbox.direction_mode === 'receive_only' || mailbox.direction_mode === 'send_receive');
}
