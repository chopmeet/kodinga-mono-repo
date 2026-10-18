const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
const fullDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Il y a 2 h", "Hier", then the date */
export function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day').replace(/^./, (c) => c.toUpperCase());
  return fullDate.format(new Date(iso));
}

/** Plain text of a Markdown post or comment */
export const plain = (content: string) => content.replace(/[#*_`>[\]]/g, '').replace(/[ \t]+/g, ' ').trim();

/** /communities/<slug>/posts/<id> */
export const postHref = (slug: string, postId: string) => `/communities/${slug}/posts/${postId}`;
