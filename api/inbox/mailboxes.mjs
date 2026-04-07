import { getSupabaseAdmin, requireAdminUser, setCors } from '../_lib/inbox.mjs';

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
    const { data, error } = await supabase
      .from('email_mailboxes')
      .select('*')
      .order('is_default', { ascending: false })
      .order('address', { ascending: true });

    if (error) throw error;
    res.status(200).json({ mailboxes: data || [] });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to load mailboxes' });
  }
}
