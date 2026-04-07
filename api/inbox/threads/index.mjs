import { getResendClient, getSupabaseAdmin, mapInboxError, requireAdminUser, setCors, syncRecentReceivedEmails } from '../../_lib/inbox.mjs';

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
    const resend = getResendClient();
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const mailboxId = req.query.mailboxId || null;
    const status = req.query.status || 'all';
    const search = String(req.query.search || '').trim();
    const direction = req.query.direction || 'all';

    try {
      await syncRecentReceivedEmails({ supabase, resend, limit: 25 });
    } catch (syncError) {
      console.error('Inbox sync failed:', syncError);
    }

    let query = supabase
      .from('email_threads')
      .select(`
        *,
        mailbox:email_mailboxes(*),
        latest_message:email_messages(
          id,
          direction,
          from_address,
          subject,
          snippet,
          html_body,
          text_body,
          received_at,
          sent_at,
          delivery_status,
          created_at
        )
      `, { count: 'exact' })
      .order('last_message_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const threads = (data || []).map((thread) => ({
      ...thread,
      latest_message: Array.isArray(thread.latest_message) ? thread.latest_message[0] || null : thread.latest_message,
    })).filter((thread) => {
      const latest = thread.latest_message;
      const haystack = [
        thread.subject,
        latest?.snippet,
        latest?.from_address,
        ...(thread.participants || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesDirection = direction === 'all' || latest?.direction === direction;
      return matchesSearch && matchesDirection;
    });

    res.status(200).json({ threads, total: count || threads.length, page, limit });
  } catch (error) {
    const mappedError = mapInboxError(error, 'Failed to load threads');
    res.status(mappedError.statusCode || 500).json({ error: mappedError.message || 'Failed to load threads' });
  }
}
