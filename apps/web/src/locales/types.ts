import type { fr } from './fr';

/** Same keys as the French texts (the reference), any string as value */
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

export type Translations = DeepStrings<typeof fr>;
