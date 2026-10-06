// Same-origin by default: Vite proxies /api in dev, the web container's nginx otherwise.
// Deployed builds set VITE_API_URL to the api subdomain (e.g. https://api.recette.kodinga.com/api/v1/).
// `||` (not `??`): the Docker build passes an empty string when no api URL is configured.
export const ApiBaseUrl: string = import.meta.env.VITE_API_URL || '/api/v1/';

export const isDev = import.meta.env.DEV;
