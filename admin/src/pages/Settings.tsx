import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface SiteSetting {
  key: string;
  value: Record<string, unknown>;
}

const SETTINGS_GROUPS = [
  {
    title: 'Contact Information',
    key: 'contact',
    fields: [
      { name: 'email', label: 'Email Address', type: 'email' },
      { name: 'phone', label: 'Phone Number', type: 'tel' },
      { name: 'whatsapp', label: 'WhatsApp Number', type: 'tel' },
      { name: 'address', label: 'Office Address', type: 'text' },
      { name: 'hours', label: 'Office Hours', type: 'text' },
    ],
  },
  {
    title: 'Social Media',
    key: 'social',
    fields: [
      { name: 'instagram', label: 'Instagram URL', type: 'url' },
      { name: 'facebook', label: 'Facebook URL', type: 'url' },
      { name: 'tiktok', label: 'TikTok URL', type: 'url' },
      { name: 'twitter', label: 'Twitter/X URL', type: 'url' },
      { name: 'linkedin', label: 'LinkedIn URL', type: 'url' },
    ],
  },
  {
    title: 'SEO Settings',
    key: 'seo',
    fields: [
      { name: 'siteTitle', label: 'Site Title', type: 'text' },
      { name: 'siteDescription', label: 'Site Description', type: 'textarea' },
      { name: 'keywords', label: 'Keywords (comma separated)', type: 'text' },
    ],
  },
  {
    title: 'Branding',
    key: 'branding',
    fields: [
      { name: 'companyName', label: 'Company Name', type: 'text' },
      { name: 'tagline', label: 'Tagline', type: 'text' },
      { name: 'footerText', label: 'Footer Text', type: 'text' },
    ],
  },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, Record<string, string>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (error) throw error;
      const settingsMap: Record<string, Record<string, string>> = {};
      (data as SiteSetting[]).forEach((item) => {
        settingsMap[item.key] = item.value as Record<string, string>;
      });
      setSettings(settingsMap);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      setHasChanges(false);
      toast.success('Settings saved successfully');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const updateSetting = (group: string, field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [field]: value },
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.key} className="card">
          <div className="card-header">
            <h3 className="font-semibold text-brand-dark">{group.title}</h3>
          </div>
          <div className="card-body space-y-4">
            {group.fields.map((field) => (
              <div key={field.name}>
                <label className="label">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={settings[group.key]?.[field.name] || ''}
                    onChange={(e) => updateSetting(group.key, field.name, e.target.value)}
                    className="input min-h-[80px]"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={settings[group.key]?.[field.name] || ''}
                    onChange={(e) => updateSetting(group.key, field.name, e.target.value)}
                    className="input"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasChanges && (
        <div className="fixed bottom-20 lg:bottom-8 left-0 right-0 lg:left-64 p-4 z-40">
          <div className="max-w-3xl mx-auto">
            <div className="card p-4 flex items-center justify-between bg-brand-purple text-white">
              <p className="text-sm">You have unsaved changes</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['site-settings'] });
                    setHasChanges(false);
                  }}
                  className="btn bg-white/20 text-white hover:bg-white/30"
                >
                  Discard
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="btn bg-white text-brand-purple hover:bg-gray-100"
                >
                  {saveMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
