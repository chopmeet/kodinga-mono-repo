/** Only same-app paths: "?next=https://evil.com" or "//evil.com" must not redirect away */
export const safeNext = (next: string | null | undefined) => (next?.startsWith('/') && !next.startsWith('//') ? next : '/');
