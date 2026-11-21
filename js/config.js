/*
 * Deployment configuration.
 * apiBase: URL of the Cloudflare Worker API (see worker/ and docs/DEPLOYMENT.md).
 *   ''  → local-only mode: data stays in this browser's LocalStorage.
 */
window.FAM_CONFIG = {
  apiBase: 'https://factory-asset-map-api.dangthanhbinh53.workers.dev',
};
