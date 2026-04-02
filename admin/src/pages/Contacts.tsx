import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
  ArchiveBoxIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

export default function Contacts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('contact_submissions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { contacts: data as Contact[], total: count || 0 };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedContact(null);
      toast.success('Contact deleted');
    },
    onError: () => toast.error('Failed to delete contact'),
  });

  const totalPages = Math.ceil((data?.total || 0) / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'badge-new',
      read: 'badge-read',
      archived: 'badge-archived',
      replied: 'badge-active',
    };
    return styles[status] || 'badge-read';
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search contacts..."
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-ghost ${showFilters ? 'bg-gray-100' : ''}`}
            >
              <FunnelIcon className="h-5 w-5" />
              <span className="hidden sm:inline ml-2">Filters</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              {['all', 'new', 'read', 'archived'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-brand-purple text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contacts list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
          </div>
        ) : data?.contacts.length === 0 ? (
          <div className="empty-state">
            <EnvelopeIcon className="empty-state-icon" />
            <h3 className="empty-state-title">No contacts found</h3>
            <p className="empty-state-description">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Contact submissions will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-4 hover:bg-surface-tertiary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedContact(contact)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-brand-dark">{contact.name}</p>
                      <span className={getStatusBadge(contact.status)}>
                        {contact.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{contact.email}</p>
                    <p className="text-sm text-gray-400 truncate mt-1">
                      {contact.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">
                      {format(new Date(contact.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, data?.total || 0)} of {data?.total}
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

      {/* Contact detail modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedContact(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl lg:rounded-2xl shadow-xl animate-slide-up lg:animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-dark">Contact Details</h2>
              <button onClick={() => setSelectedContact(null)} className="btn-ghost p-2">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={getStatusBadge(selectedContact.status)}>
                  {selectedContact.status}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-brand-dark">{selectedContact.name}</p>
                </div>
                <div className="flex gap-4">
                  <a
                    href={`mailto:${selectedContact.email}`}
                    className="flex items-center gap-2 text-brand-purple hover:underline"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    {selectedContact.email}
                  </a>
                  {selectedContact.phone && (
                    <a
                      href={`tel:${selectedContact.phone}`}
                      className="flex items-center gap-2 text-brand-purple hover:underline"
                    >
                      <PhoneIcon className="h-4 w-4" />
                      {selectedContact.phone}
                    </a>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Message</p>
                  <div className="mt-1 p-3 bg-surface-secondary rounded-lg text-sm text-brand-dark whitespace-pre-wrap">
                    {selectedContact.message}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Submitted</p>
                  <p className="text-sm text-brand-dark">
                    {format(new Date(selectedContact.created_at), 'PPpp')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                {selectedContact.status !== 'read' && (
                  <button
                    onClick={() => {
                      updateStatusMutation.mutate({ id: selectedContact.id, status: 'read' });
                      setSelectedContact({ ...selectedContact, status: 'read' });
                    }}
                    className="btn-secondary flex-1"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Mark Read
                  </button>
                )}
                {selectedContact.status !== 'archived' && (
                  <button
                    onClick={() => {
                      updateStatusMutation.mutate({ id: selectedContact.id, status: 'archived' });
                      setSelectedContact({ ...selectedContact, status: 'archived' });
                    }}
                    className="btn-secondary flex-1"
                  >
                    <ArchiveBoxIcon className="h-4 w-4 mr-2" />
                    Archive
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Delete this contact?')) {
                      deleteMutation.mutate(selectedContact.id);
                    }
                  }}
                  className="btn-danger flex-1"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
