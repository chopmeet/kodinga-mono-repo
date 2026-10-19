type ENV = 'dev' | 'prod' | 'demo';

export const currentEnv: ENV = 'dev';

const env: ENV = currentEnv;

export const Env = env;

const API_DEV_URL = 'http://127.0.0.1:8000/api/v1/';
const API_DEMO_URL = 'https://api.kodinga.fassane.dev/api/v1/';
const API_PROD_URL = 'https://api.kodinga.com/api/v1/';

export const APP_URL_DEV = 'http://localhost:4200/';
export const APP_URL_DEMO = 'https://kodinga.fassane.dev/';
export const APP_URL_PROD = 'https://kodinga.com/';

function processApiUrl() {
  if (env === 'prod') return API_PROD_URL;
  if (env === 'demo') return API_DEMO_URL;
  return API_DEV_URL;
}

function processAppUrl() {
  if (env === 'prod') return APP_URL_PROD;
  if (env === 'demo') return APP_URL_DEMO;
  return APP_URL_DEV;
}

export const ApiBaseUrl = processApiUrl();
export const AppBaseUrl = processAppUrl();

export const isDev: boolean = currentEnv === 'dev'