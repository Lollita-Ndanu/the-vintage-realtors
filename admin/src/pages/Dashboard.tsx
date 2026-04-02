import { useQuery } from '@tanstack/react-query';
import {
  EnvelopeIcon,
  NewspaperIcon,
  BuildingOfficeIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { DashboardStats, Contact } from '../types';
import { formatDistanceToNow } from 'date-fns';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`stat-icon ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentContacts({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-brand-dark">Recent Contacts</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No recent contacts
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="p-4 hover:bg-surface-tertiary/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-brand-dark truncate">{contact.name}</p>
                    {contact.status === 'new' && (
                      <span className="badge-new">New</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                  <p className="text-sm text-gray-400 truncate-2 mt-1">{contact.message}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const [contactsResult, subscribersResult, propertiesResult, followUpsResult, recentContactsResult] = await Promise.all([
        supabase.from('contact_submissions').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('newsletter_subscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      return {
        totalContacts: contactsResult.count || 0,
        newContacts: propertiesResult.count || 0,
        totalSubscribers: subscribersResult.count || 0,
        activeSubscribers: subscribersResult.count || 0,
        totalProperties: 0,
        featuredProperties: 0,
        pendingFollowUps: followUpsResult.count || 0,
        recentContacts: recentContactsResult.data || [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="card p-6 bg-gradient-to-r from-brand-purple to-brand-purple-dark">
        <h2 className="text-xl font-bold text-white">Welcome back!</h2>
        <p className="text-white/80 mt-1">
          Here's what's happening with your real estate business today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts || 0}
          icon={EnvelopeIcon}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="New Inquiries"
          value={stats?.newContacts || 0}
          icon={ExclamationCircleIcon}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          title="Subscribers"
          value={stats?.activeSubscribers || 0}
          icon={NewspaperIcon}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          title="Properties"
          value={stats?.totalProperties || 0}
          icon={BuildingOfficeIcon}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/admin/contacts" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-ochre/10 flex items-center justify-center group-hover:bg-brand-ochre/20 transition-colors">
              <EnvelopeIcon className="h-5 w-5 text-brand-ochre" />
            </div>
            <div>
              <p className="font-medium text-brand-dark">View Contacts</p>
              <p className="text-xs text-gray-500">Manage inquiries</p>
            </div>
          </div>
        </a>
        <a href="/admin/newsletter" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <NewspaperIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-brand-dark">Send Newsletter</p>
              <p className="text-xs text-gray-500">Broadcast updates</p>
            </div>
          </div>
        </a>
        <a href="/admin/properties" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <BuildingOfficeIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-brand-dark">Add Property</p>
              <p className="text-xs text-gray-500">New listing</p>
            </div>
          </div>
        </a>
        <a href="/admin/content" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
              <ArrowTrendingUpIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-brand-dark">Edit Content</p>
              <p className="text-xs text-gray-500">Update pages</p>
            </div>
          </div>
        </a>
      </div>

      {/* Recent contacts */}
      <RecentContacts contacts={stats?.recentContacts || []} />
    </div>
  );
}
