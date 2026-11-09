import 'i18next';

import type { fr } from '@/locales/fr';

// t('...') keys are checked against the French texts
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof fr };
  }
}
