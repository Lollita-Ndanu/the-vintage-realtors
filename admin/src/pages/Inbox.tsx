import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  InboxIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  CheckCircleIcon,
  ClockIcon,
  ArchiveBoxIcon,
  XMarkIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { Contact, EmailMailbox, EmailThread, EmailThreadNote } from '../types';

type InboxResponse = {
  threads: EmailThread[];
  total: number;
  page: number;
  limit: number;
};

const THREAD_STATUS = ['all', 'open', 'pending', 'closed', 'archived'] as const;

async function authedFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('Missing auth session');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload as T;
}

function statusBadge(status: EmailThread['status']) {
  switch (status) {
    case 'open':
      return 'badge-new';
    case 'pending':
      return 'badge-read';
    case 'closed':
      return 'badge-active';
    case 'archived':
      return 'badge-archived';
    default:
      return 'badge-read';
  }
}

function mailboxLabel(mailbox?: EmailMailbox | null) {
  if (!mailbox) return 'Unknown mailbox';
  return mailbox.display_name ? `${mailbox.display_name} (${mailbox.address})` : mailbox.address;
}

function messageTimestamp(thread: EmailThread) {
  const value = thread.last_message_at || thread.updated_at;
  if (!value) return '';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export default function Inbox() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [mailboxId, setMailboxId] = useState('all');
  const [status, setStatus] = useState<typeof THREAD_STATUS[number]>('all');
  const [page] = useState(1);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [composeData, setComposeData] = useState({
    mailboxAddress: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    html: '',
    text: '',
  });

  const { data: mailboxesData } = useQuery({
    queryKey: ['email-mailboxes'],
    queryFn: () => authedFetch<{ mailboxes: EmailMailbox[] }>('/api/inbox/mailboxes'),
  });

  const mailboxes = mailboxesData?.mailboxes || [];
  const defaultMailbox = useMemo(() => mailboxes.find((mailbox) => mailbox.is_default) || mailboxes[0], [mailboxes]);

  useEffect(() => {
    if (!composeData.mailboxAddress && defaultMailbox?.address) {
      setComposeData((current) => ({ ...current, mailboxAddress: defaultMailbox.address }));
    }
  }, [composeData.mailboxAddress, defaultMailbox]);

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['email-threads', mailboxId, status, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        status,
        mailboxId,
      });
      return authedFetch<InboxResponse>(`/api/inbox/threads?${params.toString()}`);
    },
  });

  const threads = threadsData?.threads || [];

  useEffect(() => {
    if (!selectedThreadId && threads[0]?.id) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  const { data: selectedThreadData, isFetching: threadLoading } = useQuery({
    queryKey: ['email-thread', selectedThreadId],
    queryFn: () => authedFetch<{ thread: EmailThread }>(`/api/inbox/threads/${selectedThreadId}`),
    enabled: Boolean(selectedThreadId),
  });

  const selectedThread = selectedThreadData?.thread || null;

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-link-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('id, name, email, phone, status')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Contact[];
    },
  });

  const updateThreadMutation = useMutation({
    mutationFn: async (payload: Partial<EmailThread>) => {
      if (!selectedThreadId) throw new Error('No thread selected');
      return authedFetch<{ thread: EmailThread }>(`/api/inbox/threads/${selectedThreadId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-thread', selectedThreadId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThreadId || !replyText.trim()) {
        throw new Error('Reply text is required');
      }
      return authedFetch(`/api/inbox/threads/${selectedThreadId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          text: replyText.trim(),
          html: `<p>${replyText.trim().replace(/\n/g, '<br />')}</p>`,
          status: 'pending',
        }),
      });
    },
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      queryClient.invalidateQueries({ queryKey: ['email-thread', selectedThreadId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThreadId || !noteBody.trim()) {
        throw new Error('Note is required');
      }
      return authedFetch<{ note: EmailThreadNote }>(`/api/inbox/threads/${selectedThreadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: noteBody.trim() }),
      });
    },
    onSuccess: () => {
      toast.success('Note added');
      setNoteBody('');
      queryClient.invalidateQueries({ queryKey: ['email-thread', selectedThreadId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const composeMutation = useMutation({
    mutationFn: async () => authedFetch('/api/inbox/compose', {
      method: 'POST',
      body: JSON.stringify({
        ...composeData,
        to: composeData.to.split(',').map((value) => value.trim()).filter(Boolean),
        cc: composeData.cc.split(',').map((value) => value.trim()).filter(Boolean),
        bcc: composeData.bcc.split(',').map((value) => value.trim()).filter(Boolean),
      }),
    }),
    onSuccess: () => {
      toast.success('Email sent');
      setComposeOpen(false);
      setComposeData({ mailboxAddress: defaultMailbox?.address || '', to: '', cc: '', bcc: '', subject: '', html: '', text: '' });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const downloadAttachment = async (messageId: string, attachmentId: string) => {
    try {
      const payload = await authedFetch<{ attachment: { filename?: string; content?: string; content_type?: string } }>(
        `/api/inbox/messages/${messageId}/attachments/${attachmentId}`,
      );
      if (payload.attachment?.content) {
        const link = document.createElement('a');
        link.href = payload.attachment.content;
        link.download = payload.attachment.filename || 'attachment';
        link.click();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download attachment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center flex-1">
          <div className="relative flex-1 max-w-xl">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inbox by sender, subject, or snippet"
              className="input pl-10"
            />
          </div>
          <select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} className="input lg:w-72">
            <option value="all">All mailboxes</option>
            {mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>{mailboxLabel(mailbox)}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input lg:w-44">
            {THREAD_STATUS.map((value) => (
              <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setComposeOpen(true)} className="btn-primary whitespace-nowrap">
          <PencilSquareIcon className="h-4 w-4 mr-2" />
          Compose Email
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <div className="card overflow-hidden min-h-[640px]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-brand-dark">Inbox</h2>
              <p className="text-sm text-gray-500">{threadsData?.total || 0} conversations</p>
            </div>
            <InboxIcon className="h-5 w-5 text-brand-purple" />
          </div>
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
            </div>
          ) : threads.length === 0 ? (
            <div className="empty-state">
              <InboxIcon className="empty-state-icon" />
              <h3 className="empty-state-title">No conversations yet</h3>
              <p className="empty-state-description">Inbound emails and sent threads will appear here once Resend receiving is configured.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[720px] overflow-y-auto">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left px-4 py-4 transition-colors ${selectedThreadId === thread.id ? 'bg-brand-purple/5' : 'hover:bg-surface-tertiary/50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-brand-dark truncate">{thread.latest_message?.from_address || thread.subject || 'Conversation'}</p>
                        <span className={statusBadge(thread.status)}>{thread.status}</span>
                        {thread.unread_count > 0 && <span className="badge-new">{thread.unread_count} new</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-700 truncate">{thread.subject || '(No subject)'}</p>
                      <p className="text-sm text-gray-500 truncate mt-1">{thread.latest_message?.snippet || 'No preview available'}</p>
                      <p className="text-xs text-gray-400 mt-2 truncate">{mailboxLabel(thread.mailbox)}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p>{messageTimestamp(thread)}</p>
                      {thread.latest_message?.attachments?.length ? (
                        <div className="inline-flex items-center gap-1 mt-2 text-gray-500">
                          <PaperClipIcon className="h-4 w-4" />
                          {thread.latest_message.attachments.length}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card min-h-[640px] flex flex-col overflow-hidden">
          {!selectedThread ? (
            <div className="empty-state flex-1">
              <ChatBubbleLeftRightIcon className="empty-state-icon" />
              <h3 className="empty-state-title">Select a conversation</h3>
              <p className="empty-state-description">Read messages, reply in-thread, change status, and add internal notes here.</p>
            </div>
          ) : threadLoading ? (
            <div className="p-8 text-center flex-1">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-5 py-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-brand-dark">{selectedThread.subject || '(No subject)'}</h2>
                    <span className={statusBadge(selectedThread.status)}>{selectedThread.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Mailbox: {mailboxLabel(selectedThread.mailbox)}</p>
                  <p className="text-sm text-gray-500">Participants: {(selectedThread.participants || []).join(', ') || 'No participants'}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => updateThreadMutation.mutate({ status: 'open', unread_count: 0 })} className="btn-secondary text-sm">
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Mark Open
                  </button>
                  <button onClick={() => updateThreadMutation.mutate({ status: 'pending' })} className="btn-secondary text-sm">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Pending
                  </button>
                  <button onClick={() => updateThreadMutation.mutate({ status: 'archived' })} className="btn-secondary text-sm">
                    <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                    Archive
                  </button>
                </div>
              </div>

              <div className="grid xl:grid-cols-[1fr,320px] flex-1 min-h-0">
                <div className="min-h-0 flex flex-col border-b xl:border-b-0 xl:border-r border-gray-100">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-tertiary/40">
                    {(selectedThread.messages || []).map((message) => (
                      <div key={message.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`badge ${message.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-brand-purple/10 text-brand-purple'}`}>
                                {message.direction}
                              </span>
                              <p className="font-medium text-brand-dark">{message.from_address}</p>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">To: {(message.to_addresses || []).join(', ') || 'N/A'}</p>
                            {message.cc_addresses?.length ? <p className="text-sm text-gray-500">Cc: {message.cc_addresses.join(', ')}</p> : null}
                          </div>
                          <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(message.sent_at || message.received_at || message.created_at), { addSuffix: true })}</p>
                        </div>

                        <div className="mt-4 space-y-3">
                          {message.html_body ? (
                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: message.html_body }} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-gray-700">{message.text_body || 'No message content'}</p>
                          )}

                          {message.attachments?.length ? (
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-wide text-gray-400">Attachments</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {message.attachments.map((attachment) => (
                                  <button
                                    key={attachment.id}
                                    type="button"
                                    onClick={() => downloadAttachment(message.id, attachment.resend_attachment_id || attachment.id)}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-brand-dark truncate">{attachment.filename}</p>
                                      <p className="text-xs text-gray-500">{attachment.content_type || 'Attachment'}</p>
                                    </div>
                                    <PaperClipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-brand-dark">Reply in thread</h3>
                      <p className="text-xs text-gray-500">Replies send from {selectedThread.mailbox?.address || 'the selected mailbox'}</p>
                    </div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={5}
                      className="input min-h-[140px]"
                      placeholder="Write your reply..."
                    />
                    <div className="flex justify-end">
                      <button onClick={() => replyMutation.mutate()} disabled={!replyText.trim() || replyMutation.isPending} className="btn-primary">
                        <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                        {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5 bg-white overflow-y-auto">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-brand-dark">Thread Details</h3>
                    <div className="rounded-2xl border border-gray-200 p-4 space-y-2 text-sm text-gray-600">
                      <div className="flex items-start gap-2">
                        <LinkIcon className="h-4 w-4 mt-0.5 text-gray-400" />
                        <div>
                          <p className="font-medium text-brand-dark">Linked Contact</p>
                          <p>{selectedThread.contact ? `${selectedThread.contact.name} (${selectedThread.contact.email})` : 'Not linked'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="label">Link to contact</label>
                        <select
                          value={selectedThread.contact_id || ''}
                          onChange={(e) => updateThreadMutation.mutate({ contact_id: e.target.value || null })}
                          className="input"
                        >
                          <option value="">No linked contact</option>
                          {(contactsData || []).map((contact) => (
                            <option key={contact.id} value={contact.id}>{contact.name} ({contact.email})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-brand-dark">Internal Notes</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(selectedThread.notes || []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                          No notes yet.
                        </div>
                      ) : (
                        selectedThread.notes?.map((note) => (
                          <div key={note.id} className="rounded-2xl border border-gray-200 p-3 text-sm text-gray-700">
                            <p className="whitespace-pre-wrap">{note.body}</p>
                            <p className="text-xs text-gray-400 mt-2">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <textarea
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      rows={4}
                      className="input"
                      placeholder="Add an internal note for your team..."
                    />
                    <button onClick={() => noteMutation.mutate()} disabled={!noteBody.trim() || noteMutation.isPending} className="btn-secondary w-full">
                      {noteMutation.isPending ? 'Saving...' : 'Add Note'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setComposeOpen(false)} />
          <div className="relative w-full max-w-3xl bg-white rounded-t-2xl lg:rounded-2xl shadow-xl animate-slide-up lg:animate-scale-in max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-dark">Compose Email</h2>
              <button onClick={() => setComposeOpen(false)} className="btn-ghost p-2">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">From Mailbox</label>
                  <select
                    value={composeData.mailboxAddress}
                    onChange={(e) => setComposeData((current) => ({ ...current, mailboxAddress: e.target.value }))}
                    className="input"
                  >
                    {mailboxes.filter((mailbox) => mailbox.direction_mode !== 'receive_only').map((mailbox) => (
                      <option key={mailbox.id} value={mailbox.address}>{mailboxLabel(mailbox)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">To</label>
                  <input value={composeData.to} onChange={(e) => setComposeData((current) => ({ ...current, to: e.target.value }))} className="input" placeholder="client@example.com, another@example.com" />
                </div>
                <div>
                  <label className="label">Cc</label>
                  <input value={composeData.cc} onChange={(e) => setComposeData((current) => ({ ...current, cc: e.target.value }))} className="input" placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Bcc</label>
                  <input value={composeData.bcc} onChange={(e) => setComposeData((current) => ({ ...current, bcc: e.target.value }))} className="input" placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="label">Subject</label>
                <input value={composeData.subject} onChange={(e) => setComposeData((current) => ({ ...current, subject: e.target.value }))} className="input" placeholder="Email subject" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Plain Text</label>
                  <textarea
                    value={composeData.text}
                    onChange={(e) => setComposeData((current) => ({ ...current, text: e.target.value }))}
                    rows={10}
                    className="input min-h-[220px]"
                    placeholder="Write the plain text version of your email"
                  />
                </div>
                <div>
                  <label className="label">HTML</label>
                  <textarea
                    value={composeData.html}
                    onChange={(e) => setComposeData((current) => ({ ...current, html: e.target.value }))}
                    rows={10}
                    className="input min-h-[220px] font-mono text-sm"
                    placeholder="<p>Write the HTML version of your email</p>"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setComposeOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={() => composeMutation.mutate()} disabled={!composeData.mailboxAddress || !composeData.to || !composeData.subject || composeMutation.isPending} className="btn-primary">
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  {composeMutation.isPending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
