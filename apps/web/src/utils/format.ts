import i18n from './i18n';

/** Intl locale of the current language (en-GB: day before month, like in French) */
export const locale = () => (i18n.resolvedLanguage === 'en' ? 'en-GB' : 'fr-FR');

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>(kind: string, options: object, make: (l: string) => T): T {
  const key = `${kind}|${locale()}|${JSON.stringify(options)}`;
  let format = cache.get(key) as T | undefined;
  if (!format) {
    format = make(locale());
    cache.set(key, format);
  }
  return format;
}

/** Date format of the current language; same options as Intl.DateTimeFormat */
export const dateFormat = (options: Intl.DateTimeFormatOptions) => cached('date', options, (l) => new Intl.DateTimeFormat(l, options));

/** Number format of the current language; same options as Intl.NumberFormat */
export const numberFormat = (options: Intl.NumberFormatOptions = {}) => cached('number', options, (l) => new Intl.NumberFormat(l, options));

export const relativeFormat = (options: Intl.RelativeTimeFormatOptions = {}) =>
  cached('relative', options, (l) => new Intl.RelativeTimeFormat(l, options));

/** 15000 → "15 000" (fr) / "15,000" (en) */
export const formatNumber = (value: number) => numberFormat().format(value);
