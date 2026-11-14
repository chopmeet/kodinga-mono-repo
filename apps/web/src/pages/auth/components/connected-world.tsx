import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@kodinga/ui';
import type { AuthPanel } from '../auth-wrapper';
import { project, WORLD_DOTS, WORLD_HEIGHT, WORLD_WIDTH } from './world-dots';

const city = {
  dakar: project(-17.4, 14.7),
  abidjan: project(-4, 5.3),
  lagos: project(3.4, 6.5),
  cairo: project(31.2, 30),
  nairobi: project(36.8, -1.3),
  johannesburg: project(28, -26.2),
  paris: project(2.3, 48.9),
  montreal: project(-73.6, 45.5),
  saoPaulo: project(-46.6, -23.5),
  mumbai: project(72.8, 19),
};
type City = keyof typeof city;

// Shown by name (Le Caire is translated)
const labelled: { id: City; name?: string; dx: number; dy: number }[] = [
  { id: 'dakar', name: 'Dakar', dx: -6, dy: -5 },
  { id: 'lagos', name: 'Lagos', dx: 5, dy: 9 },
  { id: 'cairo', dx: 6, dy: 8 },
  { id: 'nairobi', name: 'Nairobi', dx: 6, dy: 3 },
];

const links: [City, City][] = [
  ['dakar', 'montreal'],
  ['dakar', 'paris'],
  ['dakar', 'lagos'],
  ['lagos', 'saoPaulo'],
  ['lagos', 'cairo'],
  ['abidjan', 'nairobi'],
  ['cairo', 'mumbai'],
  ['nairobi', 'mumbai'],
  ['nairobi', 'johannesburg'],
];

/** A curve from a to b, bowed towards the north */
function arc(a: City, b: City) {
  const p = city[a];
  const q = city[b];
  const bow = Math.hypot(q.x - p.x, q.y - p.y) * 0.28;
  return `M${p.x} ${p.y}Q${(p.x + q.x) / 2} ${(p.y + q.y) / 2 - bow} ${q.x} ${q.y}`;
}

// Members on the map: initials and their place (in map units)
const members = [
  { initials: 'AD', x: 128, y: 62 },
  { initials: 'FS', x: 222, y: 34 },
  { initials: 'OD', x: 148, y: 106 },
  { initials: 'NB', x: 292, y: 150 },
];

const cardPlaces = ['top-[-6%] right-[4%]', 'top-[46%] left-[2%]', 'bottom-[-8%] right-[22%]'];

const at = (x: number, y: number) => ({ left: `${(x / WORLD_WIDTH) * 100}%`, top: `${(y / WORLD_HEIGHT) * 100}%` });

export function ConnectedWorld({ panel }: { panel: AuthPanel }) {
  const { t } = useTranslation();
  const glow = useId();
  const cards = t(`auth.aside.${panel}.cards`, { returnObjects: true }) as { title: string; meta: string }[];

  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-3xl">
      <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" stopColor="white" stopOpacity="0.35" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={city.lagos.x + 20} cy={city.lagos.y} r="90" fill={`url(#${glow})`} />
        <path d={WORLD_DOTS} stroke="white" strokeOpacity="0.5" strokeWidth="1.9" strokeLinecap="round" />
        {links.map(([a, b]) => (
          <path key={a + b} d={arc(a, b)} fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="0.9" strokeDasharray="2.5 2.5" strokeLinecap="round" />
        ))}
        {(Object.keys(city) as City[]).map((id) => (
          <g key={id}>
            <circle cx={city[id].x} cy={city[id].y} r="4.2" fill="white" fillOpacity="0.25" />
            <circle cx={city[id].x} cy={city[id].y} r="2.2" fill="white" stroke="#2F5FC4" strokeWidth="0.9" />
          </g>
        ))}
        {labelled.map(({ id, name, dx, dy }) => (
          <text
            key={id}
            x={city[id].x + dx}
            y={city[id].y + dy}
            textAnchor={dx < 0 ? 'end' : 'start'}
            fill="white"
            fillOpacity="0.9"
            fontSize="7"
            fontWeight="500"
          >
            {name ?? t('auth.aside.cairo')}
          </text>
        ))}
      </svg>

      {members.map(({ initials, x, y }) => (
        <span
          key={initials}
          style={at(x, y)}
          className="absolute flex size-9 -translate-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-card text-[10px] font-bold text-brand-strong shadow-lg ring-4 ring-white/25"
          aria-hidden
        >
          {initials}
        </span>
      ))}

      <ul aria-label={t('auth.aside.activity')}>
        {cards.map((card, i) => (
          <li key={card.title} className={cn('absolute min-w-44 rounded-xl bg-card/95 px-4 py-3 shadow-xl shadow-blue-950/25 backdrop-blur-sm', cardPlaces[i])}>
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.meta}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
