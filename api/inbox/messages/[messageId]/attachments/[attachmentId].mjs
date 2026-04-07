import { getResendClient, getSupabaseAdmin, requireAdminUser, setCors } from '../../../../_lib/inbox.mjs';

async function resendRequest(pathname) {
  const response = await fetch(`https://api.resend.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to load attachment');
  }
  return payload;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await requireAdminUser(req);
    const supabase = getSupabaseAdmin();
    const { messageId, attachmentId } = req.query;

    const { data: message, error } = await supabase
      .from('email_messages')
      .select('direction, resend_email_id')
      .eq('id', messageId)
      .single();

    if (error) throw error;
    if (message.direction !== 'inbound' || !message.resend_email_id) {
      res.status(400).json({ error: 'Attachment retrieval is only supported for inbound messages' });
      return;
    }

    const attachment = await resendRequest(`/emails/receiving/${message.resend_email_id}/attachments/${attachmentId}`);
    res.status(200).json({ attachment });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load attachment' });
  }
}
