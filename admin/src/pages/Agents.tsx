import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { Agent } from '../types';
import toast from 'react-hot-toast';

export default function Agents() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agents').select('*').order('sort_order');
      if (error) throw error;
      return data as Agent[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('agents').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-brand-dark hidden sm:block">Manage Agents</h2>
        <button onClick={() => { setEditingAgent(null); setShowForm(true); }} className="btn-primary ml-auto">
          <PlusIcon className="h-5 w-5 mr-2" /> Add Agent
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" /></div>
      ) : agents?.length === 0 ? (
        <div className="card"><div className="empty-state"><UserIcon className="empty-state-icon" /><h3 className="empty-state-title">No agents yet</h3></div></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents?.map((agent) => (
            <div key={agent.id} className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                  {agent.photo_url ? <img src={agent.photo_url} alt={agent.name} className="w-full h-full object-cover" /> : <UserIcon className="h-8 w-8 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-brand-dark truncate">{agent.name}</h3>
                    <span className={agent.is_active ? 'badge-active' : 'badge-inactive'}>{agent.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {agent.email && <p className="text-sm text-gray-500 truncate">{agent.email}</p>}
                  {agent.phone && <p className="text-sm text-gray-500">{agent.phone}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setEditingAgent(agent); setShowForm(true); }} className="btn-secondary flex-1 justify-center"><PencilIcon className="h-4 w-4 mr-1" /> Edit</button>
                <button onClick={() => toggleMutation.mutate({ id: agent.id, is_active: !agent.is_active })} className="btn-ghost">{agent.is_active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(agent.id); }} className="btn-danger"><TrashIcon className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <AgentForm agent={editingAgent} onClose={() => { setShowForm(false); setEditingAgent(null); }} onSave={() => { queryClient.invalidateQueries({ queryKey: ['agents'] }); setShowForm(false); }} />}
    </div>
  );
}

function AgentForm({ agent, onClose, onSave }: { agent: Agent | null; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({ name: agent?.name || '', photo_url: agent?.photo_url || '', phone: agent?.phone || '', email: agent?.email || '', bio: agent?.bio || '', is_active: agent?.is_active ?? true });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (agent) {
        const { error } = await supabase.from('agents').update(formData).eq('id', agent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('agents').insert([formData]);
        if (error) throw error;
      }
      toast.success(agent ? 'Agent updated' : 'Agent created');
      onSave();
    } catch { toast.error('Failed to save agent'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl lg:rounded-2xl shadow-xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-dark">{agent ? 'Edit Agent' : 'Add Agent'}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div><label className="label">Name</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required /></div>
          <div><label className="label">Photo URL</label><input type="url" value={formData.photo_url} onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })} className="input" /></div>
          <div><label className="label">Phone</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" /></div>
          <div><label className="label">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" /></div>
          <div><label className="label">Bio</label><textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="input" rows={3} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4" /><label htmlFor="is_active" className="text-sm">Active</label></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  );
}
