import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpTrayIcon,
  BuildingOfficeIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DEFAULT_CONTENTFUL_ENVIRONMENT,
  DEFAULT_CONTENTFUL_LOCALE,
  getSpace,
  uploadAsset,
  type ContentfulAssetLink,
} from '../lib/contentful';
import type { Property } from '../types';
import toast from 'react-hot-toast';

const PROPERTY_CATEGORIES = ['Houses', 'Apartments', 'Land', 'Airbnb', 'Offplan', 'Warehouses'];
const PROPERTY_STATUS = ['For sale', 'To Let', 'Sold'];

type MediaType = 'image' | 'video';

type ExistingMediaItem = {
  kind: 'existing';
  assetId: string;
  contentType: string;
  hydrated: boolean;
  previewUrl: string;
  title: string;
  type: MediaType;
};

type PendingMediaItem = {
  kind: 'pending';
  contentType: string;
  file: File;
  previewUrl: string;
  title: string;
  type: MediaType;
};

type MediaItem = ExistingMediaItem | PendingMediaItem;

type ContentfulLinkReference = {
  sys?: {
    id?: string;
  };
};

type ContentfulAssetRecord = {
  sys?: {
    id?: string;
  };
  fields?: {
    title?: Record<string, string | undefined>;
    file?: Record<string, { contentType?: string; url?: string } | undefined>;
  };
};

const slugify = (value: string) => {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const formatPrice = (price: number) => {
  return 'KES ' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getLocalizedValue = <T,>(field: unknown, locale: string = DEFAULT_CONTENTFUL_LOCALE): T | undefined => {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return undefined;
  }

  return (field as Record<string, T | undefined>)[locale];
};

const getAssetIdFromReference = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ContentfulLinkReference;
  return candidate.sys?.id || null;
};

const getMediaTypeFromContentType = (contentType: string): MediaType => {
  return contentType.startsWith('video/') ? 'video' : 'image';
};

const normalizeAssetUrl = (url: string | undefined) => {
  if (!url) {
    return '';
  }

  return url.startsWith('http') ? url : `https:${url}`;
};

const buildAssetLink = (assetId: string): ContentfulAssetLink => ({
  sys: {
    type: 'Link',
    linkType: 'Asset',
    id: assetId,
  },
});

const fileToMediaItem = (file: File): PendingMediaItem | null => {
  const contentType = file.type || 'application/octet-stream';

  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return null;
  }

  return {
    kind: 'pending',
    contentType,
    file,
    previewUrl: URL.createObjectURL(file),
    title: file.name,
    type: getMediaTypeFromContentType(contentType),
  };
};

const assetRecordToMediaItem = (asset: ContentfulAssetRecord): ExistingMediaItem | null => {
  const assetId = asset.sys?.id;
  const file = asset.fields?.file?.[DEFAULT_CONTENTFUL_LOCALE];
  const title = asset.fields?.title?.[DEFAULT_CONTENTFUL_LOCALE] || 'Media asset';

  if (!assetId || !file?.url) {
    return null;
  }

  const contentType = file.contentType || 'image/jpeg';

  return {
    kind: 'existing',
    assetId,
    contentType,
    hydrated: true,
    previewUrl: normalizeAssetUrl(file.url),
    title,
    type: getMediaTypeFromContentType(contentType),
  };
};

const createUnhydratedMediaItem = (assetId: string, hint: MediaType = 'image'): ExistingMediaItem => ({
  kind: 'existing',
  assetId,
  contentType: hint === 'video' ? 'video/*' : 'image/*',
  hydrated: false,
  previewUrl: '',
  title: 'Existing media',
  type: hint,
});

const getMediaLabel = (item: MediaItem) => {
  return item.type === 'video' ? 'Video' : 'Image';
};

const getPreviewableMedia = (item: MediaItem | null) => {
  if (!item) {
    return null;
  }

  if (item.kind === 'existing' && !item.hydrated) {
    return null;
  }

  return item;
};

const canPreviewMedia = (item: MediaItem) => {
  return item.kind === 'pending' || item.hydrated;
};

const getMainImageFallback = (mainImage: MediaItem | null, gallery: MediaItem[]) => {
  if (mainImage?.type === 'image') {
    return mainImage;
  }

  return gallery.find((item) => item.type === 'image') || null;
};

async function loadPropertyMedia(propertyId: string) {
  const space = await getSpace();
  const environment = await space.getEnvironment(DEFAULT_CONTENTFUL_ENVIRONMENT);
  const entry = await environment.getEntry(propertyId);

  const mainImageReference = getLocalizedValue<ContentfulLinkReference>(entry.fields.mainImage);
  const galleryReferences = getLocalizedValue<ContentfulLinkReference[]>(entry.fields.gallery) || [];

  const assetIds = Array.from(new Set([
    getAssetIdFromReference(mainImageReference),
    ...galleryReferences.map((reference) => getAssetIdFromReference(reference)),
  ].filter((assetId): assetId is string => Boolean(assetId))));

  const assets = await Promise.all(
    assetIds.map(async (assetId) => {
      try {
        const asset = await environment.getAsset(assetId);
        return [assetId, assetRecordToMediaItem(asset as ContentfulAssetRecord)] as const;
      } catch {
        return [assetId, createUnhydratedMediaItem(assetId)] as const;
      }
    }),
  );

  const assetMap = new Map<string, ExistingMediaItem>();
  assets.forEach(([assetId, item]) => {
    if (item) {
      assetMap.set(assetId, item);
    }
  });

  const mainImageId = getAssetIdFromReference(mainImageReference);
  const mainImage = mainImageId
    ? assetMap.get(mainImageId) || createUnhydratedMediaItem(mainImageId)
    : null;
  const gallery = galleryReferences
    .map((reference) => {
      const assetId = getAssetIdFromReference(reference);
      return assetId ? assetMap.get(assetId) || createUnhydratedMediaItem(assetId) : null;
    })
    .filter((item): item is ExistingMediaItem => Boolean(item));

  return { mainImage, gallery };
}

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
      const environment = await space.getEnvironment(DEFAULT_CONTENTFUL_ENVIRONMENT);
      const entries = await environment.getEntries({
        content_type: 'property',
        order: '-sys.createdAt',
        limit: 100,
      });

      return entries.items.map((item) => ({
        id: item.sys.id,
        title: getLocalizedValue<string>(item.fields.title) || '',
        description: getLocalizedValue<string>(item.fields.description) || '',
        price: getLocalizedValue<number>(item.fields.price) || 0,
        location: getLocalizedValue<string>(item.fields.location) || '',
        category: getLocalizedValue<string[]>(item.fields.category) || [],
        status: getLocalizedValue<string>(item.fields.status) || '',
        bedrooms: getLocalizedValue<number>(item.fields.bedrooms) || 0,
        bathrooms: getLocalizedValue<number>(item.fields.bathrooms) || 0,
        area: getLocalizedValue<number | null>(item.fields.area) ?? null,
        slug: getLocalizedValue<string>(item.fields.slug) || '',
        mainImage: (() => {
          const asset = getLocalizedValue<ContentfulAssetRecord>(item.fields.mainImage);
          const file = asset?.fields?.file?.[DEFAULT_CONTENTFUL_LOCALE];
          const title = asset?.fields?.title?.[DEFAULT_CONTENTFUL_LOCALE] || 'Property cover';

          if (!asset?.sys?.id || !file?.url) {
            return null;
          }

          return {
            id: asset.sys.id,
            url: normalizeAssetUrl(file.url),
            title,
            type: getMediaTypeFromContentType(file.contentType || 'image/jpeg'),
          };
        })(),
        createdAt: item.sys.createdAt,
        updatedAt: item.sys.updatedAt,
      })) as Property[];
    },
  });

  const filteredProperties = properties?.filter((property) => {
    const matchesSearch = search
      ? property.title.toLowerCase().includes(search.toLowerCase()) || property.location.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesCategory = categoryFilter === 'all' || property.category.includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const space = await getSpace();
      const environment = await space.getEnvironment(DEFAULT_CONTENTFUL_ENVIRONMENT);
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

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search properties..."
              className="input pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
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
            <PlusIcon className="mr-2 h-5 w-5" />
            Add Property
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-purple" />
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
              <div className="relative aspect-video bg-gray-100">
                {property.mainImage?.url ? (
                  <img src={property.mainImage.url} alt={property.mainImage.title || property.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <PhotoIcon className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                <span className={`absolute right-2 top-2 badge ${
                  property.status === 'For sale'
                    ? 'bg-green-100 text-green-800'
                    : property.status === 'To Let'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                }`}>
                  {property.status}
                </span>
              </div>
              <div className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  {property.category?.[0] && (
                    <span className="rounded bg-brand-purple/10 px-2 py-0.5 text-xs text-brand-purple">
                      {property.category[0]}
                    </span>
                  )}
                </div>
                <h3 className="truncate font-semibold text-brand-dark">{property.title}</h3>
                <p className="truncate text-sm text-gray-500">{property.location}</p>
                <p className="mt-2 text-lg font-bold text-brand-purple">{formatPrice(property.price)}</p>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                  {property.bedrooms > 0 && <span>{property.bedrooms} Beds</span>}
                  {property.bathrooms > 0 && <span>{property.bathrooms} Baths</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <a href={`/property?id=${property.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 justify-center">
                    <EyeIcon className="mr-1 h-4 w-4" /> View
                  </a>
                  <button onClick={() => { setEditingProperty(property); setShowForm(true); }} className="btn-secondary flex-1 justify-center">
                    <PencilIcon className="mr-1 h-4 w-4" /> Edit
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
        <PropertyForm
          property={editingProperty}
          onClose={() => {
            setShowForm(false);
            setEditingProperty(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['properties'] });
          }}
        />
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
    area: property?.area || 0,
    slug: property?.slug || '',
  });
  const [loading, setLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(Boolean(property));
  const [mainImage, setMainImage] = useState<MediaItem | null>(null);
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const mediaRef = useRef<{ mainImage: MediaItem | null; gallery: MediaItem[] }>({ mainImage: null, gallery: [] });

  useEffect(() => {
    mediaRef.current = { mainImage, gallery };
  }, [gallery, mainImage]);

  useEffect(() => {
    return () => {
      const { mainImage: currentMainImage, gallery: currentGallery } = mediaRef.current;
      const pendingItems = new Set<PendingMediaItem>();

      if (currentMainImage?.kind === 'pending') {
        pendingItems.add(currentMainImage);
      }

      currentGallery.forEach((item) => {
        if (item.kind === 'pending') {
          pendingItems.add(item);
        }
      });

      pendingItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    setFormData({
      title: property?.title || '',
      description: property?.description || '',
      price: property?.price || 0,
      location: property?.location || '',
      category: property?.category?.[0] || 'Houses',
      status: property?.status || 'For sale',
      bedrooms: property?.bedrooms || 0,
      bathrooms: property?.bathrooms || 0,
      area: property?.area || 0,
      slug: property?.slug || '',
    });
  }, [property]);

  useEffect(() => {
    let isActive = true;

    const hydrateMedia = async () => {
      if (!property) {
        setMainImage(null);
        setGallery([]);
        setMediaLoading(false);
        return;
      }

      setMediaLoading(true);

      try {
        const media = await loadPropertyMedia(property.id);

        if (!isActive) {
          return;
        }

        setMainImage(media.mainImage);
        setGallery(media.gallery);
      } catch (error) {
        if (isActive) {
          const message = error instanceof Error ? error.message : 'Failed to load property media';
          toast.error(message);
        }
      } finally {
        if (isActive) {
          setMediaLoading(false);
        }
      }
    };

    void hydrateMedia();

    return () => {
      isActive = false;
    };
  }, [property]);

  useEffect(() => {
    if (property?.mainImage?.id) {
      setMainImage({
        kind: 'existing',
        assetId: property.mainImage.id,
        contentType: property.mainImage.type === 'video' ? 'video/*' : 'image/*',
        hydrated: true,
        previewUrl: property.mainImage.url,
        title: property.mainImage.title,
        type: property.mainImage.type,
      });
    }
  }, [property?.mainImage]);

  const coverPreview = useMemo(() => getPreviewableMedia(getMainImageFallback(mainImage, gallery)), [gallery, mainImage]);
  const hasUnhydratedMedia = useMemo(() => {
    return [mainImage, ...gallery].some((item) => item?.kind === 'existing' && !item.hydrated);
  }, [gallery, mainImage]);

  const handleMainImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const mediaItem = fileToMediaItem(file);
    if (!mediaItem || mediaItem.type !== 'image') {
      toast.error('Main image must be an image file.');
      return;
    }

    if (mainImage?.kind === 'pending' && !gallery.includes(mainImage)) {
      URL.revokeObjectURL(mainImage.previewUrl);
    }

    setMainImage(mediaItem);
  };

  const handleGalleryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const nextItems = files
      .map((file) => fileToMediaItem(file))
      .filter((item): item is PendingMediaItem => Boolean(item));

    if (nextItems.length !== files.length) {
      toast.error('Only image and video files can be added to the gallery.');
    }

    if (nextItems.length > 0) {
      setGallery((currentGallery) => [...currentGallery, ...nextItems]);
    }
  };

  const removeGalleryItem = (index: number) => {
    setGallery((currentGallery) => {
      const target = currentGallery[index];
      if (target?.kind === 'pending' && target !== mainImage) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return currentGallery.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const moveGalleryItem = (index: number, direction: -1 | 1) => {
    setGallery((currentGallery) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentGallery.length) {
        return currentGallery;
      }

      const nextGallery = [...currentGallery];
      const [item] = nextGallery.splice(index, 1);
      nextGallery.splice(nextIndex, 0, item);
      return nextGallery;
    });
  };

  const setGalleryItemAsCover = (index: number) => {
    const candidate = gallery[index];
    if (!candidate || candidate.type !== 'image') {
      toast.error('Only an image can be used as the cover photo.');
      return;
    }

    setMainImage(candidate);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (mediaLoading) {
      toast.error('Please wait for the current property media to finish loading.');
      return;
    }

    if (hasUnhydratedMedia) {
      toast.error('Some existing media could not be loaded. Refresh the property and try again so nothing is lost.');
      return;
    }

    const fallbackMainImage = getMainImageFallback(mainImage, gallery);

    setLoading(true);

    try {
      const space = await getSpace();
      const environment = await space.getEnvironment(DEFAULT_CONTENTFUL_ENVIRONMENT);
      const slug = formData.slug || slugify(formData.title);
      const uploadCache = new WeakMap<PendingMediaItem, Promise<ContentfulAssetLink>>();

      const resolveAssetLink = async (item: MediaItem): Promise<ContentfulAssetLink> => {
        if (item.kind === 'existing') {
          return buildAssetLink(item.assetId);
        }

        let uploadPromise = uploadCache.get(item);
        if (!uploadPromise) {
          uploadPromise = uploadAsset(item.file, { title: item.title }).then((uploaded) => uploaded.link);
          uploadCache.set(item, uploadPromise);
        }

        return uploadPromise;
      };

      const mainImageLink = fallbackMainImage ? await resolveAssetLink(fallbackMainImage) : null;
      const galleryLinks = gallery.length > 0 ? await Promise.all(gallery.map((item) => resolveAssetLink(item))) : [];

      const fields = {
        title: { [DEFAULT_CONTENTFUL_LOCALE]: formData.title },
        description: { [DEFAULT_CONTENTFUL_LOCALE]: formData.description },
        price: { [DEFAULT_CONTENTFUL_LOCALE]: Number(formData.price) },
        location: { [DEFAULT_CONTENTFUL_LOCALE]: formData.location },
        category: { [DEFAULT_CONTENTFUL_LOCALE]: [formData.category] },
        status: { [DEFAULT_CONTENTFUL_LOCALE]: formData.status },
        bedrooms: { [DEFAULT_CONTENTFUL_LOCALE]: Number(formData.bedrooms) },
        bathrooms: { [DEFAULT_CONTENTFUL_LOCALE]: Number(formData.bathrooms) },
        area: { [DEFAULT_CONTENTFUL_LOCALE]: Number(formData.area) },
        slug: { [DEFAULT_CONTENTFUL_LOCALE]: slug },
        ...(mainImageLink ? { mainImage: { [DEFAULT_CONTENTFUL_LOCALE]: mainImageLink } } : {}),
        ...(galleryLinks.length > 0 ? { gallery: { [DEFAULT_CONTENTFUL_LOCALE]: galleryLinks } } : {}),
      };

      if (property) {
        const entry = await environment.getEntry(property.id);
        const nextFields: Record<string, unknown> = {
          ...entry.fields,
          ...fields,
        };

        if (!mainImageLink) {
          delete nextFields.mainImage;
        }

        if (galleryLinks.length === 0) {
          delete nextFields.gallery;
        }

        entry.fields = nextFields;
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
      const message = error instanceof Error ? error.message : 'Failed to save property';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 lg:items-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white shadow-xl lg:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-4">
          <h2 className="text-lg font-bold text-brand-dark">{property ? 'Edit Property' : 'Add Property'}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input type="text" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} className="input min-h-[100px]" />
            </div>
            <div>
              <label className="label">Price (KES)</label>
              <input type="number" value={formData.price} onChange={(event) => setFormData({ ...formData, price: Number(event.target.value) })} className="input" required />
            </div>
            <div>
              <label className="label">Location</label>
              <input type="text" value={formData.location} onChange={(event) => setFormData({ ...formData, location: event.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })} className="input">
                {PROPERTY_CATEGORIES.map((category) => (<option key={category} value={category}>{category}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value })} className="input">
                {PROPERTY_STATUS.map((status) => (<option key={status} value={status}>{status}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Bedrooms</label>
              <input type="number" value={formData.bedrooms} onChange={(event) => setFormData({ ...formData, bedrooms: Number(event.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Bathrooms</label>
              <input type="number" value={formData.bathrooms} onChange={(event) => setFormData({ ...formData, bathrooms: Number(event.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Area</label>
              <input type="number" value={formData.area} onChange={(event) => setFormData({ ...formData, area: Number(event.target.value) })} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Slug</label>
              <input type="text" value={formData.slug} onChange={(event) => setFormData({ ...formData, slug: slugify(event.target.value) })} className="input" placeholder="auto-generated-from-title" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface-secondary/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-brand-dark">Cover Image</h3>
                  <p className="text-sm text-gray-500">Used in the hero area and property cards. If left empty, the first gallery image becomes the cover automatically.</p>
                </div>
                <label className="btn-secondary cursor-pointer">
                  <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                  Upload Cover
                  <input type="file" accept="image/*" onChange={handleMainImageChange} className="hidden" />
                </label>
              </div>

              {mediaLoading ? (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
                  Loading existing media...
                </div>
              ) : coverPreview ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="relative aspect-video bg-gray-100">
                    {canPreviewMedia(coverPreview) ? (
                      <img src={coverPreview.previewUrl} alt={coverPreview.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-center text-sm text-gray-500">
                        Existing cover image could not be previewed right now.
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                      {mainImage ? 'Selected cover' : 'Auto cover from gallery'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-dark">{coverPreview.title}</p>
                      <p className="text-xs text-gray-500">Image</p>
                    </div>
                    {mainImage && (
                      <button
                        type="button"
                        onClick={() => {
                          if (mainImage.kind === 'pending' && !gallery.includes(mainImage)) {
                            URL.revokeObjectURL(mainImage.previewUrl);
                          }

                          setMainImage(null);
                        }}
                        className="btn-ghost px-3 py-2 text-sm"
                      >
                        Remove Cover
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-4 text-center text-sm text-gray-500">
                  <PhotoIcon className="mb-3 h-10 w-10 text-gray-300" />
                  Upload a main image or add gallery photos and the first image will be reused as the cover.
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface-secondary/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-brand-dark">Gallery Media</h3>
                  <p className="text-sm text-gray-500">Add photos and videos for the property detail page. Videos are allowed here and will open in the lightbox.</p>
                </div>
                <label className="btn-primary cursor-pointer">
                  <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
                  Add Images or Videos
                  <input type="file" accept="image/*,video/*" multiple onChange={handleGalleryChange} className="hidden" />
                </label>
              </div>

              {mediaLoading ? (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
                  Loading gallery media...
                </div>
              ) : gallery.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {gallery.map((item, index) => (
                    <div key={`${item.previewUrl}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <div className="relative aspect-video bg-gray-100">
                        {item.type === 'video' ? (
                          canPreviewMedia(item) ? (
                            <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 px-4 text-center text-sm text-gray-500">
                              Existing video could not be previewed right now.
                            </div>
                          )
                        ) : (
                          canPreviewMedia(item) ? (
                            <img src={item.previewUrl} alt={item.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 px-4 text-center text-sm text-gray-500">
                              Existing image could not be previewed right now.
                            </div>
                          )
                        )}
                        <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                          {item.type === 'video' ? <VideoCameraIcon className="mr-1 h-3.5 w-3.5" /> : <PhotoIcon className="mr-1 h-3.5 w-3.5" />}
                          {getMediaLabel(item)}
                        </span>
                      </div>
                      <div className="space-y-3 p-3">
                        <div>
                          <p className="truncate text-sm font-semibold text-brand-dark">{item.title}</p>
                          <p className="text-xs text-gray-500">
                            {item.kind === 'existing'
                              ? canPreviewMedia(item)
                                ? 'Already in Contentful'
                                : 'Existing item kept without preview'
                              : 'Ready to upload'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => moveGalleryItem(index, -1)} className="btn-ghost px-3 py-2 text-xs" disabled={index === 0}>
                            Move Up
                          </button>
                          <button type="button" onClick={() => moveGalleryItem(index, 1)} className="btn-ghost px-3 py-2 text-xs" disabled={index === gallery.length - 1}>
                            Move Down
                          </button>
                          {item.type === 'image' && (
                            <button type="button" onClick={() => setGalleryItemAsCover(index)} className="btn-secondary px-3 py-2 text-xs">
                              Use as Cover
                            </button>
                          )}
                          <button type="button" onClick={() => removeGalleryItem(index)} className="btn-danger px-3 py-2 text-xs">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-4 text-center text-sm text-gray-500">
                  <VideoCameraIcon className="mb-3 h-10 w-10 text-gray-300" />
                  No gallery media yet. Upload images, videos, or both.
                </div>
              )}
            </section>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || mediaLoading} className="btn-primary flex-1">
              {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : 'Save Property'}
            </button>
          </div>
          {hasUnhydratedMedia && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Some existing media could not be previewed from Contentful. Saving is blocked until those assets load again so existing files are not removed accidentally.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
