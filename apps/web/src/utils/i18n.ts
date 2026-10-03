import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from '@/locales/en';
import { fr } from '@/locales/fr';
import { AppStorage } from './storage';

export const languages = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

const STORAGE_KEY = 'lang';

const detectLanguage = (): LanguageCode => {
  const saved = AppStorage.getItem<LanguageCode>(STORAGE_KEY);
  if (saved && languages.some((l) => l.code === saved)) return saved;
  return navigator.language?.startsWith('en') ? 'en' : 'fr';
};

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React already escapes
});

const syncDocumentLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncDocumentLang(i18n.language);

i18n.on('languageChanged', (lng) => {
  AppStorage.setItem(STORAGE_KEY, lng);
  syncDocumentLang(lng);
});

export default i18n;
