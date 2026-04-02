import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, ChatBubbleLeftRightIcon, StarIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import type { Testimonial } from '../types';
import toast from 'react-hot-toast';

export default function Testimonials() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('testimonials').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Testimonial[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('testimonials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast.success('Testimonial deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from('testimonials').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-brand-dark hidden sm:block">Manage Testimonials</h2>
        <button onClick={() => { setEditingTestimonial(null); setShowForm(true); }} className="btn-primary ml-auto">
          <PlusIcon className="h-5 w-5 mr-2" /> Add Testimonial
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" /></div>
      ) : testimonials?.length === 0 ? (
        <div className="card"><div className="empty-state"><ChatBubbleLeftRightIcon className="empty-state-icon" /><h3 className="empty-state-title">No testimonials yet</h3></div></div>
      ) : (
        <div className="space-y-4">
          {testimonials?.map((testimonial) => (
            <div key={testimonial.id} className="card p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-brand-purple">{testimonial.client_name.charAt(0)}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-brand-dark">{testimonial.client_name}</h3>
                    <div className="flex">{[...Array(5)].map((_, i) => <StarIcon key={i} className={`h-4 w-4 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}</div>
                    <span className={testimonial.is_approved ? 'badge-active' : 'badge-inactive'}>{testimonial.is_approved ? 'Approved' : 'Pending'}</span>
                    {testimonial.is_featured && <span className="badge bg-brand-purple/10 text-brand-purple">Featured</span>}
                  </div>
                  <p className="text-gray-600 mt-2">{testimonial.content}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => { setEditingTestimonial(testimonial); setShowForm(true); }} className="btn-secondary flex-1 justify-center"><PencilIcon className="h-4 w-4 mr-1" /> Edit</button>
                <button onClick={() => toggleMutation.mutate({ id: testimonial.id, field: 'is_approved', value: !testimonial.is_approved })} className="btn-ghost">{testimonial.is_approved ? 'Unapprove' : 'Approve'}</button>
                <button onClick={() => toggleMutation.mutate({ id: testimonial.id, field: 'is_featured', value: !testimonial.is_featured })} className="btn-ghost">{testimonial.is_featured ? 'Unfeature' : 'Feature'}</button>
                <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(testimonial.id); }} className="btn-danger"><TrashIcon className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <TestimonialForm testimonial={editingTestimonial} onClose={() => { setShowForm(false); setEditingTestimonial(null); }} onSave={() => { queryClient.invalidateQueries({ queryKey: ['testimonials'] }); setShowForm(false); }} />}
    </div>
  );
}

function TestimonialForm({ testimonial, onClose, onSave }: { testimonial: Testimonial | null; onClose: () => void; onSave: () => void }) {
  const [formData, setFormData] = useState({ client_name: testimonial?.client_name || '', rating: testimonial?.rating || 5, content: testimonial?.content || '', is_approved: testimonial?.is_approved ?? true, is_featured: testimonial?.is_featured ?? false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (testimonial) {
        const { error } = await supabase.from('testimonials').update(formData).eq('id', testimonial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('testimonials').insert([formData]);
        if (error) throw error;
      }
      toast.success(testimonial ? 'Testimonial updated' : 'Testimonial created');
      onSave();
    } catch { toast.error('Failed to save testimonial'); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl lg:rounded-2xl shadow-xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-dark">{testimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div><label className="label">Client Name</label><input type="text" value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} className="input" required /></div>
          <div><label className="label">Rating</label><select value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })} className="input">{[5, 4, 3, 2, 1].map((r) => (<option key={r} value={r}>{r} Stars</option>))}</select></div>
          <div><label className="label">Content</label><textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="input" rows={4} required /></div>
          <div className="flex items-center gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_approved} onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })} className="w-4 h-4" /><span className="text-sm">Approved</span></label><label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="w-4 h-4" /><span className="text-sm">Featured</span></label></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div>
    </div>
  );
}
