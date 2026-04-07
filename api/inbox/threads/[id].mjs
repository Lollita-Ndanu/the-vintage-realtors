import { buildThreadResponse, getSupabaseAdmin, requireAdminUser, setCors } from '../../_lib/inbox.mjs';

async function getThreadPayload(supabase, threadId) {
  const { data: thread, error: threadError } = await supabase
    .from('email_threads')
    .select('*, mailbox:email_mailboxes(*), contact:contact_submissions(id, name, email, phone, status)')
    .eq('id', threadId)
    .single();

  if (threadError) throw threadError;

  const { data: messages, error: messagesError } = await supabase
    .from('email_messages')
    .select('*, attachments:email_attachments(*)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (messagesError) throw messagesError;

  const { data: notes, error: notesError } = await supabase
    .from('email_thread_notes')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (notesError) throw notesError;

  return buildThreadResponse(thread, messages || [], notes || []);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await requireAdminUser(req);
    const supabase = getSupabaseAdmin();
    const threadId = req.query.id;

    if (req.method === 'GET') {
      const thread = await getThreadPayload(supabase, threadId);
      res.status(200).json({ thread });
      return;
    }

    if (req.method === 'PATCH') {
      const updates = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const allowed = {
        status: updates.status,
        assigned_to: updates.assigned_to || null,
        contact_id: updates.contact_id || null,
        unread_count: typeof updates.unread_count === 'number' ? updates.unread_count : undefined,
        updated_at: new Date().toISOString(),
      };

      const payload = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
      const { error } = await supabase.from('email_threads').update(payload).eq('id', threadId);
      if (error) throw error;

      const thread = await getThreadPayload(supabase, threadId);
      res.status(200).json({ thread });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load thread' });
  }
}
