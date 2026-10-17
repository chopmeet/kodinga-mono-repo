type Named = { first_name: string; last_name: string; username: string };

/** "Awa Ndiaye", or the username when the name is empty */
export const personName = (p: Named) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username;
