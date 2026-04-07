import { createClient } from 'contentful-management';

const spaceId = import.meta.env.VITE_CONTENTFUL_SPACE_ID || '';
const managementToken = import.meta.env.VITE_CONTENTFUL_MANAGEMENT_TOKEN || '';
const deliveryToken = import.meta.env.VITE_CONTENTFUL_DELIVERY_TOKEN || '';

export const contentfulClient = createClient({
  accessToken: managementToken,
});

export const getSpace = async () => {
  return contentfulClient.getSpace(spaceId);
};

export const getDeliveryEntries = async (query: Record<string, unknown>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });

  const response = await fetch(
    `https://cdn.contentful.com/spaces/${spaceId}/environments/master/entries?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${deliveryToken}`,
      },
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Failed to load Contentful delivery entries');
  }

  return response.json();
};

export const getEnvironment = async (environmentId: string = 'master') => {
  const space = await getSpace();
  return space.getEnvironment(environmentId);
};

export const getEntry = async (entryId: string) => {
  const environment = await getEnvironment();
  return environment.getEntry(entryId);
};

export const createEntry = async (contentType: string, fields: Record<string, unknown>) => {
  const environment = await getEnvironment();
  return environment.createEntry(contentType, { fields });
};

export const deleteEntry = async (entryId: string) => {
  const entry = await getEntry(entryId);
  await entry.unpublish();
  return entry.delete();
};

export const uploadAsset = async ({
  file,
  title,
  environmentId = 'master',
}: {
  file: File;
  title: string;
  environmentId?: string;
}) => {
  const space = await getSpace();
  const environment = await space.getEnvironment(environmentId);
  const arrayBuffer = await file.arrayBuffer();
  const upload = await (space as unknown as { createUpload: (payload: { file: ArrayBuffer }) => Promise<{ sys: { id: string } }> }).createUpload({ file: arrayBuffer });

  const asset = await environment.createAsset({
    fields: {
      title: {
        'en-US': title,
      },
      file: {
        'en-US': {
          contentType: file.type || 'application/octet-stream',
          fileName: file.name,
          uploadFrom: {
            sys: {
              type: 'Link',
              linkType: 'Upload',
              id: upload.sys.id,
            },
          },
        },
      },
    },
  });

  const processedAsset = await asset.processForAllLocales();
  const publishedAsset = await processedAsset.publish();

  return publishedAsset;
};
