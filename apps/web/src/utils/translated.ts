import i18n from './i18n';

const tr = (key: string) => (i18n.t as (k: string) => string)(key);

/**
 * A label table read in the current language at each access: same shape as a plain
 * Record<id, string>, so `label[id]`, Object.entries() and spreads keep working.
 * `prefix` + id is the i18n key (e.g. 'labels.workplace.' + 'remote').
 */
export function translatedLabels<K extends string>(prefix: string, ids: readonly K[]): Record<K, string> {
  const table = {} as Record<K, string>;
  for (const id of ids) Object.defineProperty(table, id, { enumerable: true, get: () => tr(`${prefix}${id}`) });
  return table;
}

/** Same for the tables of { label, className } (status badges): the label follows the language */
export function translatedStyles<K extends string>(prefix: string, classes: Record<K, string>): Record<K, { label: string; className: string }> {
  const table = {} as Record<K, { label: string; className: string }>;
  for (const id of Object.keys(classes) as K[]) {
    const entry = { className: classes[id] } as { label: string; className: string };
    Object.defineProperty(entry, 'label', { enumerable: true, get: () => tr(`${prefix}${id}`) });
    table[id] = entry;
  }
  return table;
}
