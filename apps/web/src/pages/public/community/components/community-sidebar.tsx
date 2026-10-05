import { Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, cn } from '@kodinga-mono-repo/ui';
import type { CommunityDetails } from '@/data/community.data';
import { useAppSelector } from '@/redux/hook';
import { formatCompact } from '@/utils/Utils';

export function JoinButton({ community, className }: { community: CommunityDetails; className?: string }) {
  const token = useAppSelector((s) => s.user.token);
  // No join endpoint yet: membership is only simulated client-side
  const [joined, setJoined] = useState(false);
  const label = community.access.kind === 'application' ? 'Postuler' : 'Rejoindre';
  const classes = cn('w-full bg-brand font-semibold text-white hover:bg-brand-hover', className);

  if (!token) {
    return (
      <Button asChild className={classes}>
        <Link to={`/login?next=${encodeURIComponent(`/communities/${community.id}`)}`}>{label}</Link>
      </Button>
    );
  }
  if (joined) {
    return (
      <Button variant="outline" disabled className={cn('w-full', className)}>
        <Check /> {community.access.kind === 'application' ? 'Candidature envoyée' : 'Membre'}
      </Button>
    );
  }
  return (
    <Button className={classes} onClick={() => setJoined(true)}>
      {label}
    </Button>
  );
}

export function CommunitySidebar({ community }: { community: CommunityDetails }) {
  const stats = [
    { label: 'Membres', value: formatCompact(community.members) },
    { label: 'En ligne', value: formatCompact(community.online) },
    { label: 'Admins', value: community.admins },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className={cn('relative h-28 bg-linear-to-r', community.coverClassName)}>
        <img
          src={community.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
      <div className="p-5">
        <h2 className="font-bold text-slate-900">{community.name}</h2>
        <p className="mt-0.5 font-mono text-xs text-slate-400">kodinga.africa/{community.id}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{community.description}</p>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-3 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <dd className="font-bold text-slate-900">{s.value}</dd>
              <dt className="text-[11px] text-slate-500">{s.label}</dt>
            </div>
          ))}
        </dl>

        <JoinButton community={community} className="mt-4" />
        <p className="mt-2 text-center font-mono text-[11px] text-slate-500">{community.access.label}</p>
      </div>
    </div>
  );
}
