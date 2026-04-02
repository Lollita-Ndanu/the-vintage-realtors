import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PageSection {
  id: string;
  page: string;
  section: string;
  content: Record<string, unknown>;
  updated_at: string;
}

const EDITABLE_SECTIONS = [
  { page: 'home', section: 'hero', label: 'Hero Section', fields: ['title', 'subtitle', 'tagline'] },
  { page: 'home', section: 'about', label: 'Who We Are', fields: ['title', 'description', 'mission'] },
  { page: 'home', section: 'services', label: 'Services Section', fields: ['title', 'subtitle'] },
  { page: 'about', section: 'hero', label: 'About Hero', fields: ['title', 'description'] },
  { page: 'about', section: 'values', label: 'Core Values', fields: ['values'] },
  { page: 'contact', section: 'info', label: 'Contact Info', fields: ['email', 'phone', 'address', 'hours'] },
];

export default function PageContent() {
  const queryClient = useQueryClient();
  const [selectedPage, setSelectedPage] = useState('home');
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);

  const { data: sections, isLoading } = useQuery({
    queryKey: ['page-content'],
    queryFn: async () => {
      const { data, error } = await supabase.from('page_content').select('*');
      if (error) throw error;
      return data as PageSection[];
    },
  });

  const getSectionContent = (page: string, section: string) => {
    return sections?.find((s) => s.page === page && s.section === section);
  };

  const pages = [...new Set(EDITABLE_SECTIONS.map((s) => s.page))];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {pages.map((page) => (
          <button key={page} onClick={() => setSelectedPage(page)} className={`btn whitespace-nowrap ${selectedPage === page ? 'btn-primary' : 'btn-secondary'}`}>
            {page.charAt(0).toUpperCase() + page.slice(1)} Page
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {EDITABLE_SECTIONS.filter((s) => s.page === selectedPage).map((sectionConfig) => {
            const sectionData = getSectionContent(sectionConfig.page, sectionConfig.section);
            return (
              <div key={`${sectionConfig.page}-${sectionConfig.section}`} className="card">
                <div className="card-header flex items-center justify-between">
                  <h3 className="font-semibold text-brand-dark">{sectionConfig.label}</h3>
                  <button onClick={() => setEditingSection(sectionData || { id: '', page: sectionConfig.page, section: sectionConfig.section, content: {}, updated_at: '' })} className="btn-ghost text-sm">
                    <PencilIcon className="h-4 w-4 mr-1" /> Edit
                  </button>
                </div>
                <div className="card-body">
                  {sectionData ? (
                    <div className="space-y-2">
                      {sectionConfig.fields.map((field) => (
                        <div key={field}>
                          <p className="text-xs text-gray-500 uppercase">{field}</p>
                          <p className="text-brand-dark">
                            {typeof sectionData.content[field] === 'string'
                              ? (sectionData.content[field] as string).slice(0, 100) + ((sectionData.content[field] as string).length > 100 ? '...' : '')
                              : JSON.stringify(sectionData.content[field]).slice(0, 100)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No content set. Click edit to add.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingSection && (
        <SectionEditor section={editingSection} onClose={() => setEditingSection(null)} onSave={() => { queryClient.invalidateQueries({ queryKey: ['page-content'] }); setEditingSection(null); }} />
      )}
    </div>
  );
}

function SectionEditor({ section, onClose, onSave }: { section: PageSection; onClose: () => void; onSave: () => void }) {
  const [content, setContent] = useState<Record<string, string>>(section.content as Record<string, string> || {});
  const [loading, setLoading] = useState(false);

  const sectionConfig = EDITABLE_SECTIONS.find((s) => s.page === section.page && s.section === section.section);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (section.id) {
        const { error } = await supabase.from('page_content').update({ content }).eq('id', section.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('page_content').insert([{ page: section.page, section: section.section, content }]);
        if (error) throw error;
      }
      toast.success('Content saved');
      onSave();
    } catch { toast.error('Failed to save content'); }
    setLoading(false);
  };

  const getFieldLabel = (field: string) => {
    return field.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl lg:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-brand-dark">Edit {sectionConfig?.label}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {sectionConfig?.fields.map((field) => (
            <div key={field}>
              <label className="label">{getFieldLabel(field)}</label>
              {field === 'description' || field === 'mission' || field.startsWith('description') ? (
                <textarea value={content[field] || ''} onChange={(e) => setContent({ ...content, [field]: e.target.value })} className="input min-h-[120px]" />
              ) : field === 'values' ? (
                <textarea value={content[field] || ''} onChange={(e) => setContent({ ...content, [field]: e.target.value })} className="input min-h-[80px]" placeholder="Enter values separated by commas" />
              ) : (
                <input type="text" value={content[field] || ''} onChange={(e) => setContent({ ...content, [field]: e.target.value })} className="input" />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="btn-primary flex-1">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckIcon className="h-4 w-4 mr-2" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
