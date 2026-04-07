import {
  buildThreadReferences,
  formatFromHeader,
  getMailboxDirectionAllowsSend,
  getResendClient,
  getSupabaseAdmin,
  requireAdminUser,
  setCors,
} from '../../../_lib/inbox.mjs';

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
    const threadId = req.query.id;

    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select('*, mailbox:email_mailboxes(*)')
      .eq('id', threadId)
      .single();
    if (threadError) throw threadError;

    const mailbox = thread.mailbox;
    if (!getMailboxDirectionAllowsSend(mailbox)) {
      res.status(400).json({ error: 'This mailbox is not enabled for outbound email' });
      return;
    }

    const { data: existingMessages, error: messagesError } = await supabase
      .from('email_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (messagesError) throw messagesError;

    const lastInbound = [...(existingMessages || [])].reverse().find((message) => message.direction === 'inbound') || null;
    const to = body.to?.length ? body.to : lastInbound ? [lastInbound.from_address] : [];

    if (!to.length) {
      res.status(400).json({ error: 'No recipient address available for reply' });
      return;
    }

    const headers = {};
    if (lastInbound?.message_id) {
      headers['In-Reply-To'] = lastInbound.message_id;
      const references = buildThreadReferences(existingMessages || []);
      headers.References = references ? `${references} ${lastInbound.message_id}`.trim() : lastInbound.message_id;
    }

    const subject = body.subject || (thread.subject?.toLowerCase().startsWith('re:') ? thread.subject : `Re: ${thread.subject}`);
    const response = await resend.emails.send({
      from: formatFromHeader(mailbox),
      to,
      cc: body.cc || [],
      bcc: body.bcc || [],
      subject,
      html: body.html || `<p>${body.text || ''}</p>`,
      text: body.text || '',
      headers,
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to send reply');
    }

    const sentAt = new Date().toISOString();
    const { data: message, error: insertError } = await supabase
      .from('email_messages')
      .insert([{
        thread_id: threadId,
        mailbox_id: mailbox.id,
        direction: 'outbound',
        resend_email_id: response.data?.id || null,
        message_id: null,
        in_reply_to: lastInbound?.message_id || null,
        references_header: headers.References || null,
        from_address: mailbox.address,
        to_addresses: to,
        cc_addresses: body.cc || [],
        bcc_addresses: body.bcc || [],
        reply_to_addresses: [],
        subject,
        html_body: body.html || null,
        text_body: body.text || null,
        snippet: (body.text || '').slice(0, 180),
        sent_at: sentAt,
        delivery_status: 'sent',
        headers,
        metadata: {},
        created_by: user.id,
      }])
      .select('*')
      .single();

    if (insertError) throw insertError;

    const { error: threadUpdateError } = await supabase
      .from('email_threads')
      .update({ last_message_at: sentAt, status: body.status || 'pending', updated_at: sentAt })
      .eq('id', threadId);
    if (threadUpdateError) throw threadUpdateError;

    res.status(200).json({ message, resendId: response.data?.id || null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to send reply' });
  }
}
