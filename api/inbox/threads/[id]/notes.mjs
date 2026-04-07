import { getSupabaseAdmin, requireAdminUser, setCors } from '../../../_lib/inbox.mjs';

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
    const threadId = req.query.id;

    if (!body.body?.trim()) {
      res.status(400).json({ error: 'Note body is required' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('email_thread_notes')
      .insert([{ thread_id: threadId, body: body.body.trim(), created_by: user.id }])
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json({ note: data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to save note' });
  }
}
