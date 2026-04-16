import { createClient } from 'contentful-management';

const spaceId = import.meta.env.VITE_CONTENTFUL_SPACE_ID || '';
const managementToken = import.meta.env.VITE_CONTENTFUL_MANAGEMENT_TOKEN || '';
const CONTENTFUL_API_BASE = 'https://api.contentful.com';
const CONTENTFUL_UPLOAD_BASE = 'https://upload.contentful.com';
const CONTENTFUL_MANAGEMENT_CONTENT_TYPE = 'application/vnd.contentful.management.v1+json';

export const DEFAULT_CONTENTFUL_ENVIRONMENT = 'master';
export const DEFAULT_CONTENTFUL_LOCALE = 'en-US';

export interface ContentfulAssetLink {
  sys: {
    type: 'Link';
    linkType: 'Asset';
    id: string;
  };
}

export interface UploadedContentfulAsset {
  assetId: string;
  contentType: string;
  link: ContentfulAssetLink;
  title: string;
  url: string;
}

export const contentfulClient = createClient({
  accessToken: managementToken,
});

const assertContentfulConfig = () => {
  if (!spaceId || !managementToken) {
    throw new Error('Contentful credentials are missing from the admin environment configuration.');
  }
};

const createAssetLink = (assetId: string): ContentfulAssetLink => ({
  sys: {
    type: 'Link',
    linkType: 'Asset',
    id: assetId,
  },
});

const normalizeAssetUrl = (url: string | undefined) => {
  if (!url) {
    return '';
  }

  return url.startsWith('http') ? url : `https:${url}`;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const payloadRecord = payload as {
    details?: { errors?: Array<{ details?: string; name?: string }> };
    message?: string;
  };

  const detailMessages = payloadRecord.details?.errors
    ?.map((error) => error.details || error.name)
    .filter((message): message is string => Boolean(message));

  if (detailMessages && detailMessages.length > 0) {
    return `${payloadRecord.message || fallback} ${detailMessages.join(', ')}`.trim();
  }

  return payloadRecord.message || fallback;
};

type ContentfulRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null;
  json?: unknown;
};

const contentfulRequest = async <T>(url: string, options: ContentfulRequestOptions = {}): Promise<T> => {
  assertContentfulConfig();

  const { body, headers, json, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : body,
    headers: {
      Authorization: `Bearer ${managementToken}`,
      ...(json !== undefined ? { 'Content-Type': CONTENTFUL_MANAGEMENT_CONTENT_TYPE } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let fallback = `Contentful request failed with status ${response.status}.`;
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      try {
        const text = await response.text();
        fallback = text || fallback;
      } catch {
        payload = null;
      }
    }

    throw new Error(extractErrorMessage(payload, fallback));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

type ContentfulAssetFile = {
  contentType?: string;
  fileName?: string;
  url?: string;
};

type ContentfulAssetResponse = {
  fields?: {
    file?: Record<string, ContentfulAssetFile | undefined>;
    title?: Record<string, string | undefined>;
  };
  sys: {
    id: string;
    version: number;
  };
};

const getAssetRequestUrl = (assetId: string, environmentId: string) => {
  return `${CONTENTFUL_API_BASE}/spaces/${spaceId}/environments/${environmentId}/assets/${assetId}`;
};

const waitForProcessedAsset = async (
  assetId: string,
  environmentId: string,
  locale: string,
  attempts: number = 80,
): Promise<ContentfulAssetResponse> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const asset = await contentfulRequest<ContentfulAssetResponse>(getAssetRequestUrl(assetId, environmentId), {
      method: 'GET',
    });

    const file = asset.fields?.file?.[locale];
    if (file?.url) {
      return asset;
    }

    await sleep(2000);
  }

  throw new Error('Media processing took too long in Contentful. Please try again in a moment.');
};

export const getSpace = async () => {
  assertContentfulConfig();
  return contentfulClient.getSpace(spaceId);
};

export const getEnvironment = async (environmentId: string = DEFAULT_CONTENTFUL_ENVIRONMENT) => {
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

export const buildAssetLink = (assetId: string) => createAssetLink(assetId);

export const uploadAsset = async (
  file: File,
  options: {
    environmentId?: string;
    locale?: string;
    title?: string;
  } = {},
): Promise<UploadedContentfulAsset> => {
  assertContentfulConfig();

  const environmentId = options.environmentId || DEFAULT_CONTENTFUL_ENVIRONMENT;
  const locale = options.locale || DEFAULT_CONTENTFUL_LOCALE;
  const title = options.title || file.name;
  const contentType = file.type || 'application/octet-stream';

  const upload = await contentfulRequest<{ sys: { id: string } }>(
    `${CONTENTFUL_UPLOAD_BASE}/spaces/${spaceId}/uploads`,
    {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    },
  );

  const asset = await contentfulRequest<ContentfulAssetResponse>(
    `${CONTENTFUL_API_BASE}/spaces/${spaceId}/environments/${environmentId}/assets`,
    {
      method: 'POST',
      json: {
        fields: {
          title: {
            [locale]: title,
          },
          file: {
            [locale]: {
              contentType,
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
      },
    },
  );

  await contentfulRequest<void>(
    `${getAssetRequestUrl(asset.sys.id, environmentId)}/files/${locale}/process`,
    {
      method: 'PUT',
      headers: {
        'X-Contentful-Version': String(asset.sys.version),
      },
    },
  );

  const processedAsset = await waitForProcessedAsset(asset.sys.id, environmentId, locale);
  const publishedAsset = await contentfulRequest<ContentfulAssetResponse>(
    `${getAssetRequestUrl(asset.sys.id, environmentId)}/published`,
    {
      method: 'PUT',
      headers: {
        'X-Contentful-Version': String(processedAsset.sys.version),
      },
    },
  );

  const publishedFile = publishedAsset.fields?.file?.[locale];
  const publishedTitle = publishedAsset.fields?.title?.[locale] || title;

  if (!publishedFile?.url) {
    throw new Error('Contentful finished uploading the media, but the asset URL was not returned.');
  }

  return {
    assetId: publishedAsset.sys.id,
    contentType: publishedFile.contentType || contentType,
    link: createAssetLink(publishedAsset.sys.id),
    title: publishedTitle,
    url: normalizeAssetUrl(publishedFile.url),
  };
};

export const deleteEntry = async (entryId: string) => {
  const entry = await getEntry(entryId);
  await entry.unpublish();
  return entry.delete();
};
