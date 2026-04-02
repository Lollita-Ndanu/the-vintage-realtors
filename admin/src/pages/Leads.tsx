import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TagIcon, PlusIcon, XMarkIcon, ChatBubbleLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { Contact, LeadTag, ContactNote, FollowUp } from '../types';
import { format, isToday, isPast } from 'date-fns';
import toast from 'react-hot-toast';

export default function Leads() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);

  const { data: contacts } = useQuery({
    queryKey: ['leads-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_submissions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const { data: tags } = useQuery({
    queryKey: ['lead-tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_tags').select('*').order('name');
      if (error) throw error;
      return data as LeadTag[];
    },
  });

  const { data: followUps } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('follow_ups').select('*, contact:contact_submissions(name, email)').eq('completed_at', null).order('scheduled_for');
      if (error) throw error;
      return data as (FollowUp & { contact: { name: string; email: string } })[];
    },
  });

  const upcomingFollowUps = followUps?.filter((f) => !isPast(new Date(f.scheduled_for)) || isToday(new Date(f.scheduled_for))) || [];
  const overdueFollowUps = followUps?.filter((f) => isPast(new Date(f.scheduled_for)) && !isToday(new Date(f.scheduled_for))) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-brand-dark hidden sm:block">Lead Management</h2>
        <button onClick={() => setShowTagManager(true)} className="btn-secondary ml-auto"><TagIcon className="h-5 w-5 mr-2" /> Manage Tags</button>
      </div>

      {overdueFollowUps.length > 0 && (
        <div className="card p-4 border-l-4 border-status-error bg-red-50">
          <h3 className="font-semibold text-status-error flex items-center gap-2"><ClockIcon className="h-5 w-5" /> Overdue Follow-ups ({overdueFollowUps.length})</h3>
          <div className="mt-2 space-y-2">
            {overdueFollowUps.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-white p-2 rounded-lg">
                <div><p className="font-medium text-brand-dark">{f.contact.name}</p><p className="text-xs text-gray-500">{f.notes || 'No notes'}</p></div>
                <p className="text-xs text-status-error">Due: {format(new Date(f.scheduled_for), 'MMM d')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingFollowUps.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-brand-dark flex items-center gap-2"><ClockIcon className="h-5 w-5" /> Upcoming Follow-ups</h3>
          <div className="mt-2 space-y-2">
            {upcomingFollowUps.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-surface-secondary p-2 rounded-lg">
                <div><p className="font-medium text-brand-dark">{f.contact.name}</p><p className="text-xs text-gray-500">{f.notes || 'No notes'}</p></div>
                <p className="text-xs text-gray-500">{format(new Date(f.scheduled_for), 'MMM d, h:mm a')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header"><h3 className="font-semibold">All Leads</h3></div>
        {contacts?.length === 0 ? (
          <div className="empty-state"><TagIcon className="empty-state-icon" /><h3 className="empty-state-title">No leads yet</h3></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contacts?.map((contact) => (
              <div key={contact.id} className="p-4 hover:bg-surface-tertiary/50 cursor-pointer" onClick={() => setSelectedContact(contact)}>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-brand-dark">{contact.name}</p><p className="text-sm text-gray-500">{contact.email}</p></div>
                  <span className={contact.status === 'new' ? 'badge-new' : 'badge-read'}>{contact.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedContact && <LeadDetail contact={selectedContact} onClose={() => setSelectedContact(null)} />}
      {showTagManager && <TagManager tags={tags || []} onClose={() => setShowTagManager(false)} />}
    </div>
  );
}

function LeadDetail({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['contact-notes', contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_notes').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data as ContactNote[];
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from('contact_notes').insert([{ contact_id: contact.id, note }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contact-notes', contact.id] }); setShowNoteForm(false); toast.success('Note added'); },
  });

  const addFollowUpMutation = useMutation({
    mutationFn: async ({ scheduled_for, notes }: { scheduled_for: string; notes: string }) => {
      const { error } = await supabase.from('follow_ups').insert([{ contact_id: contact.id, scheduled_for, notes }]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['follow-ups'] }); setShowFollowUpForm(false); toast.success('Follow-up scheduled'); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl lg:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-brand-dark">{contact.name}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{contact.email}</p></div>
          {contact.phone && <div><p className="text-sm text-gray-500">Phone</p><p className="font-medium">{contact.phone}</p></div>}
          <div><p className="text-sm text-gray-500">Message</p><div className="p-3 bg-surface-secondary rounded-lg text-sm">{contact.message}</div></div>
          
          <div className="flex gap-2">
            <button onClick={() => setShowNoteForm(true)} className="btn-secondary flex-1"><ChatBubbleLeftIcon className="h-4 w-4 mr-2" /> Add Note</button>
            <button onClick={() => setShowFollowUpForm(true)} className="btn-primary flex-1"><ClockIcon className="h-4 w-4 mr-2" /> Schedule Follow-up</button>
          </div>

          {notes && notes.length > 0 && (
            <div>
              <h3 className="font-semibold text-brand-dark mb-2">Notes</h3>
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="p-3 bg-surface-secondary rounded-lg">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(note.created_at), 'PPpp')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showNoteForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowNoteForm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-4">
            <h3 className="font-bold mb-4">Add Note</h3>
            <textarea id="noteText" className="input min-h-[100px] mb-4" placeholder="Enter your note..." />
            <div className="flex gap-2">
              <button onClick={() => setShowNoteForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => { const el = document.getElementById('noteText') as HTMLTextAreaElement; if (el?.value) addNoteMutation.mutate(el.value); }} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowFollowUpForm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-4">
            <h3 className="font-bold mb-4">Schedule Follow-up</h3>
            <input type="datetime-local" id="followUpDate" className="input mb-4" />
            <textarea id="followUpNotes" className="input min-h-[80px] mb-4" placeholder="Notes (optional)" />
            <div className="flex gap-2">
              <button onClick={() => setShowFollowUpForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => { const dateEl = document.getElementById('followUpDate') as HTMLInputElement; const notesEl = document.getElementById('followUpNotes') as HTMLTextAreaElement; if (dateEl?.value) addFollowUpMutation.mutate({ scheduled_for: dateEl.value, notes: notesEl?.value || '' }); }} className="btn-primary flex-1">Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagManager({ tags, onClose }: { tags: LeadTag[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState({ name: '', color: '#8b7355' });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lead_tags').insert([newTag]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead-tags'] }); setNewTag({ name: '', color: '#8b7355' }); toast.success('Tag created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead-tags'] }); toast.success('Tag deleted'); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-dark">Manage Tags</h3>
          <button onClick={onClose} className="btn-ghost p-1"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2 mb-4">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between p-2 bg-surface-secondary rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: tag.color }} />
                <span className="text-sm font-medium">{tag.name}</span>
              </div>
              <button onClick={() => deleteMutation.mutate(tag.id)} className="text-gray-400 hover:text-status-error"><XMarkIcon className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })} placeholder="Tag name" className="input flex-1" />
          <input type="color" value={newTag.color} onChange={(e) => setNewTag({ ...newTag, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
          <button onClick={() => createMutation.mutate()} disabled={!newTag.name} className="btn-primary"><PlusIcon className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
