import {
  ensureMailbox,
  formatFromHeader,
  getMailboxDirectionAllowsSend,
  getResendClient,
  getSupabaseAdmin,
  htmlSnippet,
  mergeParticipants,
  normalizeSubject,
  parseAddressList,
  requireAdminUser,
  setCors,
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
    const user = await requireAdminUser(req);
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const supabase = getSupabaseAdmin();
    const resend = getResendClient();
    const mailbox = await ensureMailbox(supabase, body.mailboxAddress);

    if (!mailbox || !getMailboxDirectionAllowsSend(mailbox)) {
      res.status(400).json({ error: 'Selected mailbox cannot send email' });
      return;
    }

    const to = parseAddressList(body.to);
    const cc = parseAddressList(body.cc);
    const bcc = parseAddressList(body.bcc);

    if (!to.length || !body.subject) {
      res.status(400).json({ error: 'To and subject are required' });
      return;
    }

    const response = await resend.emails.send({
      from: formatFromHeader(mailbox),
      to,
      cc,
      bcc,
      subject: body.subject,
      html: body.html || `<p>${body.text || ''}</p>`,
      text: body.text || '',
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to send email');
    }

    const sentAt = new Date().toISOString();
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .insert([{
        mailbox_id: mailbox.id,
        subject: body.subject,
        normalized_subject: normalizeSubject(body.subject),
        status: 'open',
        last_message_at: sentAt,
        unread_count: 0,
        participants: mergeParticipants(to, cc, bcc, [mailbox.address]),
        metadata: {},
      }])
      .select('*')
      .single();
    if (threadError) throw threadError;

    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .insert([{
        thread_id: thread.id,
        mailbox_id: mailbox.id,
        direction: 'outbound',
        resend_email_id: response.data?.id || null,
        from_address: mailbox.address,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        reply_to_addresses: [],
        subject: body.subject,
        html_body: body.html || null,
        text_body: body.text || null,
        snippet: htmlSnippet(body.html || '', body.text || ''),
        sent_at: sentAt,
        delivery_status: 'sent',
        created_by: user.id,
        headers: {},
        metadata: {},
      }])
      .select('*')
      .single();
    if (messageError) throw messageError;

    res.status(200).json({ thread, message, resendId: response.data?.id || null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to send email' });
  }
}
