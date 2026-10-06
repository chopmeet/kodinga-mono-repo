// Same-origin by default: Vite proxies /api in dev, nginx in Docker/prod.
// Override with VITE_API_URL (e.g. https://api.example.com/api/v1/) if the api lives elsewhere.
export const ApiBaseUrl: string = import.meta.env.VITE_API_URL ?? '/api/v1/';

export const isDev = import.meta.env.DEV;
