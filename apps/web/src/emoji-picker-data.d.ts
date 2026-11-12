// Localized datasets of emoji-picker-react, a subpath export ("./data/emojis-*") that Vite resolves
// but TypeScript's node10 resolution of the monorepo does not read
declare module 'emoji-picker-react/data/emojis-fr' {
  import type { EmojiData } from 'emoji-picker-react/dist/types/exposedTypes';
  const data: EmojiData;
  export default data;
}
