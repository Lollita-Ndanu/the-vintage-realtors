import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  NewspaperIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { NewsletterSubscriber, NewsletterCampaign } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 15;

export default function Newsletter() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'subscribers' | 'campaigns' | 'compose'>('subscribers');
  const [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]);

  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');

  const { data: subscribersData, isLoading: subscribersLoading } = useQuery({
    queryKey: ['subscribers', page, search],
    queryFn: async () => {
      let query = supabase
        .from('newsletter_subscriptions')
        .select('*', { count: 'exact' })
        .order('subscribed_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { subscribers: data as NewsletterSubscriber[], total: count || 0 };
    },
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsletter_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NewsletterCampaign[];
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      const recipients = selectedSubscribers.length > 0
        ? selectedSubscribers
        : (subscribersData?.subscribers.filter(s => s.is_active).map(s => s.email) || []);

      if (recipients.length === 0) {
        throw new Error('No recipients selected');
      }

      const response = await fetch('/api/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          html_content: emailContent,
          text_content: emailContent.replace(/<[^>]*>/g, ''),
          recipients,
        }),
      });

      if (!response.ok) throw new Error('Failed to send campaign');

      await supabase.from('newsletter_campaigns').insert([{
        subject: emailSubject,
        html_content: emailContent,
        text_content: emailContent.replace(/<[^>]*>/g, ''),
        recipient_count: recipients.length,
        sent_at: new Date().toISOString(),
      }]);

      return recipients.length;
    },
    onSuccess: (count) => {
      toast.success(`Campaign sent to ${count} subscribers`);
      setEmailSubject('');
      setEmailContent('');
      setSelectedSubscribers([]);
      setTab('subscribers');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleSubscriberMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('newsletter_subscriptions')
        .update({ is_active, unsubscribed_at: is_active ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      toast.success('Subscriber updated');
    },
  });

  const totalPages = Math.ceil((subscribersData?.total || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'subscribers', label: 'Subscribers', icon: UserGroupIcon },
          { id: 'campaigns', label: 'Campaigns', icon: NewspaperIcon },
          { id: 'compose', label: 'Compose', icon: PaperAirplaneIcon },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`btn flex items-center gap-2 whitespace-nowrap ${
              tab === t.id ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Subscribers Tab */}
      {tab === 'subscribers' && (
        <>
          <div className="card p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search subscribers..."
                  className="input pl-10"
                />
              </div>
              <button
                onClick={() => {
                  setSelectedSubscribers([]);
                  setTab('compose');
                }}
                className="btn-primary"
              >
                <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                New Campaign
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            {subscribersLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
              </div>
            ) : subscribersData?.subscribers.length === 0 ? (
              <div className="empty-state">
                <UserGroupIcon className="empty-state-icon" />
                <h3 className="empty-state-title">No subscribers</h3>
                <p className="empty-state-description">
                  Newsletter subscribers will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {subscribersData?.subscribers.map((sub) => (
                  <div key={sub.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedSubscribers.includes(sub.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubscribers([...selectedSubscribers, sub.id]);
                          } else {
                            setSelectedSubscribers(selectedSubscribers.filter(id => id !== sub.id));
                          }
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-brand-dark truncate">{sub.name}</p>
                        <p className="text-sm text-gray-500 truncate">{sub.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={sub.is_active ? 'badge-active' : 'badge-inactive'}>
                        {sub.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => toggleSubscriberMutation.mutate({
                          id: sub.id,
                          is_active: !sub.is_active,
                        })}
                        className="btn-ghost text-xs"
                      >
                        {sub.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, subscribersData?.total || 0)} of {subscribersData?.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost p-2"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-ghost p-2"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Campaigns Tab */}
      {tab === 'campaigns' && (
        <div className="card overflow-hidden">
          {campaignsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
            </div>
          ) : campaigns?.length === 0 ? (
            <div className="empty-state">
              <NewspaperIcon className="empty-state-icon" />
              <h3 className="empty-state-title">No campaigns yet</h3>
              <p className="empty-state-description">
                Create your first newsletter campaign
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {campaigns?.map((campaign) => (
                <div key={campaign.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-dark">{campaign.subject}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Sent to {campaign.recipient_count} subscribers
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0">
                      {campaign.sent_at ? format(new Date(campaign.sent_at), 'MMM d, yyyy') : 'Draft'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Tab */}
      {tab === 'compose' && (
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Newsletter subject..."
              className="input"
            />
          </div>

          <div>
            <label className="label">Content (HTML)</label>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              placeholder="<p>Your newsletter content...</p>"
              className="input min-h-[200px]"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
            <p className="text-sm text-gray-600">
              {selectedSubscribers.length > 0
                ? `Sending to ${selectedSubscribers.length} selected subscribers`
                : `Sending to all active subscribers (${subscribersData?.subscribers.filter(s => s.is_active).length || 0})`
              }
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => sendCampaignMutation.mutate()}
              disabled={!emailSubject || !emailContent || sendCampaignMutation.isPending}
              className="btn-primary flex-1"
            >
              {sendCampaignMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  Send Campaign
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
