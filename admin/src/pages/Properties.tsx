import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BuildingOfficeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { getSpace } from '../lib/contentful';
import type { Property } from '../types';
import toast from 'react-hot-toast';

const PROPERTY_CATEGORIES = ['Houses', 'Apartments', 'Land', 'Airbnb', 'Offplan Investments', 'Offices', 'Warehouses', 'Commercials'];
const PROPERTY_STATUS = ['For sale', 'For rent', 'Sold', 'Rented'];

export default function Properties() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const space = await getSpace();
      const environment = await space.getEnvironment('master');
      const entries = await environment.getEntries({
        content_type: 'property',
        order: '-sys.createdAt',
        limit: 100,
      });

      return entries.items.map((item) => ({
        id: item.sys.id,
        title: (item.fields.title as Record<string, string>)?.['en-US'] || '',
        description: (item.fields.description as Record<string, string>)?.['en-US'] || '',
        price: (item.fields.price as Record<string, number>)?.['en-US'] || 0,
        location: (item.fields.location as Record<string, string>)?.['en-US'] || '',
        category: (item.fields.category as Record<string, string[]>)?.['en-US'] || [],
        status: (item.fields.status as Record<string, string>)?.['en-US'] || '',
        bedrooms: (item.fields.bedrooms as Record<string, number>)?.['en-US'] || 0,
        bathrooms: (item.fields.bathrooms as Record<string, number>)?.['en-US'] || 0,
        area: (item.fields.area as Record<string, number>)?.['en-US'] || null,
        slug: (item.fields.slug as Record<string, string>)?.['en-US'] || '',
        createdAt: item.sys.createdAt,
        updatedAt: item.sys.updatedAt,
      })) as Property[];
    },
  });

  const filteredProperties = properties?.filter((p) => {
    const matchesSearch = search
      ? p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.location.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesCategory = categoryFilter === 'all' || p.category.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const space = await getSpace();
      const environment = await space.getEnvironment('master');
      const entry = await environment.getEntry(id);
      await entry.unpublish();
      await entry.delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property deleted');
    },
    onError: () => toast.error('Failed to delete property'),
  });

  const formatPrice = (price: number) => {
    return 'KES ' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search properties..."
              className="input pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="all">All Categories</option>
            {PROPERTY_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditingProperty(null);
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Property
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple mx-auto" />
        </div>
      ) : filteredProperties?.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BuildingOfficeIcon className="empty-state-icon" />
            <h3 className="empty-state-title">No properties found</h3>
            <p className="empty-state-description">Add your first property listing</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties?.map((property) => (
            <div key={property.id} className="card overflow-hidden">
              <div className="aspect-video bg-gray-100 relative">
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className="h-12 w-12 text-gray-300" />
                </div>
                <span className={`absolute top-2 right-2 badge ${
                  property.status === 'For sale' ? 'bg-green-100 text-green-800' :
                  property.status === 'For rent' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {property.status}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {property.category?.[0] && (
                    <span className="text-xs bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded">
                      {property.category[0]}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-brand-dark truncate">{property.title}</h3>
                <p className="text-sm text-gray-500 truncate">{property.location}</p>
                <p className="text-lg font-bold text-brand-purple mt-2">{formatPrice(property.price)}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  {property.bedrooms > 0 && <span>{property.bedrooms} Beds</span>}
                  {property.bathrooms > 0 && <span>{property.bathrooms} Baths</span>}
                </div>
                <div className="flex gap-2 mt-4">
                  <a href={`/property?id=${property.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 justify-center">
                    <EyeIcon className="h-4 w-4 mr-1" /> View
                  </a>
                  <button onClick={() => { setEditingProperty(property); setShowForm(true); }} className="btn-secondary flex-1 justify-center">
                    <PencilIcon className="h-4 w-4 mr-1" /> Edit
                  </button>
                  <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(property.id); }} className="btn-danger">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PropertyForm property={editingProperty} onClose={() => { setShowForm(false); setEditingProperty(null); }} onSave={() => { queryClient.invalidateQueries({ queryKey: ['properties'] }); }} />
      )}
    </div>
  );
}

function PropertyForm({ property, onClose, onSave }: { property: Property | null; onClose: () => void; onSave: () => void; }) {
  const [formData, setFormData] = useState({
    title: property?.title || '',
    description: property?.description || '',
    price: property?.price || 0,
    location: property?.location || '',
    category: property?.category?.[0] || 'Houses',
    status: property?.status || 'For sale',
    bedrooms: property?.bedrooms || 0,
    bathrooms: property?.bathrooms || 0,
    slug: property?.slug || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const space = await getSpace();
      const environment = await space.getEnvironment('master');
      const slug = formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const fields = {
        title: { 'en-US': formData.title },
        description: { 'en-US': formData.description },
        price: { 'en-US': Number(formData.price) },
        location: { 'en-US': formData.location },
        category: { 'en-US': [formData.category] },
        status: { 'en-US': formData.status },
        bedrooms: { 'en-US': Number(formData.bedrooms) },
        bathrooms: { 'en-US': Number(formData.bathrooms) },
        slug: { 'en-US': slug },
      };
      if (property) {
        const entry = await environment.getEntry(property.id);
        entry.fields = fields;
        await entry.update();
        await entry.publish();
      } else {
        const entry = await environment.createEntry('property', { fields });
        await entry.publish();
      }
      toast.success(property ? 'Property updated' : 'Property created');
      onSave();
      onClose();
    } catch (error) {
      toast.error('Failed to save property');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-t-2xl lg:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-brand-dark">{property ? 'Edit Property' : 'Add Property'}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input min-h-[100px]" />
            </div>
            <div>
              <label className="label">Price (KES)</label>
              <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="input" required />
            </div>
            <div>
              <label className="label">Location</label>
              <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                {PROPERTY_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input">
                {PROPERTY_STATUS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Bedrooms</label>
              <input type="number" value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Bathrooms</label>
              <input type="number" value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: Number(e.target.value) })} className="input" />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
