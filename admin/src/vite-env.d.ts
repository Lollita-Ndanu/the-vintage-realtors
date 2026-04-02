/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CONTENTFUL_SPACE_ID: string;
  readonly VITE_CONTENTFUL_DELIVERY_TOKEN: string;
  readonly VITE_CONTENTFUL_MANAGEMENT_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
