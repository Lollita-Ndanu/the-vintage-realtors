import {
  getResendClient,
  getSupabaseAdmin,
  logEmailEvent,
  readRawBody,
  setCors,
  syncReceivedEmail,
  verifyWebhookSignature,
} from '../_lib/inbox.mjs';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-resend-signature'];
    const timestamp = req.headers['x-resend-timestamp'];

    if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = rawBody ? JSON.parse(rawBody) : {};
    const supabase = getSupabaseAdmin();
    const resend = getResendClient();

    await logEmailEvent(supabase, event.type || 'unknown', event.data?.email_id || event.data?.id || null, event, new Date().toISOString());

    if (event.type === 'email.received' && event.data?.email_id) {
      await syncReceivedEmail({ supabase, resend, emailId: event.data.email_id });
    }

    if (event.type?.startsWith('email.') && event.data?.email_id && event.type !== 'email.received') {
      const deliveryStatus = event.type.replace('email.', '');
      const { error } = await supabase
        .from('email_messages')
        .update({ delivery_status: deliveryStatus })
        .eq('resend_email_id', event.data.email_id)
        .eq('direction', 'outbound');

      if (error) throw error;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to process webhook' });
  }
}
