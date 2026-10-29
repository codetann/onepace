/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_JELLYFIN_URL?: string;
  readonly VITE_JELLYFIN_API_KEY?: string;
  readonly VITE_JELLYFIN_USER_ID?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
