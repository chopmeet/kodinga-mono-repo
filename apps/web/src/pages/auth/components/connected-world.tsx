import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@kodinga/ui';
import type { AuthPanel } from '../auth-wrapper';
import { AFRICA_PATH, project, WORLD_DOTS, WORLD_HEIGHT, WORLD_WIDTH } from './world-dots';

const city = {
  dakar: project(-17.4, 14.7),
  abidjan: project(-4, 5.3),
  lagos: project(3.4, 6.5),
  cairo: project(31.2, 30),
  nairobi: project(36.8, -1.3),
  johannesburg: project(28, -26.2),
  kigali: project(30.1, -1.9),
  casablanca: project(-7.6, 33.6),
  paris: project(2.3, 48.9),
  montreal: project(-73.6, 45.5),
  saoPaulo: project(-46.6, -23.5),
  mumbai: project(72.8, 19),
};
type City = keyof typeof city;

const africanHubs: City[] = ['dakar', 'abidjan', 'lagos', 'nairobi', 'cairo', 'johannesburg', 'kigali', 'casablanca'];

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
  ['casablanca', 'paris'],
  ['casablanca', 'dakar'],
  ['lagos', 'saoPaulo'],
  ['lagos', 'abidjan'],
  ['lagos', 'cairo'],
  ['abidjan', 'nairobi'],
  ['kigali', 'nairobi'],
  ['kigali', 'johannesburg'],
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
const cardAnimations = ['animate-float-slow', 'animate-float-reverse', 'animate-float-gentle'];
const memberAnimations = ['animate-float-slow', 'animate-float-reverse', 'animate-float-gentle', 'animate-float-sway'];

const at = (x: number, y: number) => ({ left: `${(x / WORLD_WIDTH) * 100}%`, top: `${(y / WORLD_HEIGHT) * 100}%` });

export function ConnectedWorld({ panel }: { panel: AuthPanel }) {
  const { t } = useTranslation();
  const glowId = useId();
  const africaFillId = useId();
  const africaStrokeId = useId();
  const beamGlowId = useId();
  const cards = t(`auth.aside.${panel}.cards`, { returnObjects: true }) as { title: string; meta: string }[];

  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-3xl">
      <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={africaStrokeId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id={africaFillId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={beamGlowId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Ambient radiant aura centered over Africa */}
        <circle cx={235} cy={145} r="105" fill={`url(#${glowId})`} />

        {/* World dots representing world continents */}
        <path d={WORLD_DOTS} stroke="white" strokeOpacity="0.45" strokeWidth="1.9" strokeLinecap="round" />

        {/* Africa Continent Vector Contour & Glowing Ambient Line */}
        <path
          d={AFRICA_PATH}
          fill={`url(#${africaFillId})`}
          stroke={`url(#${africaStrokeId})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-africa-glow"
        />

        {/* Static connection base lines */}
        {links.map(([a, b]) => (
          <path
            key={`base-${a}-${b}`}
            d={arc(a, b)}
            fill="none"
            stroke="white"
            strokeOpacity="0.32"
            strokeWidth="0.9"
            strokeDasharray="2.5 2.5"
            strokeLinecap="round"
          />
        ))}

        {/* Animated glowing light beams flowing along connection arcs */}
        {links.map(([a, b]) => (
          <path
            key={`beam-${a}-${b}`}
            d={arc(a, b)}
            fill="none"
            stroke={`url(#${beamGlowId})`}
            strokeWidth="1.4"
            strokeDasharray="5 15"
            strokeLinecap="round"
            className="animate-beam-flow"
          />
        ))}

        {/* City and Tech Hub Nodes */}
        {(Object.keys(city) as City[]).map((id) => {
          const isAfrican = africanHubs.includes(id);
          const c = city[id];
          return (
            <g key={id}>
              {isAfrican && (
                <>
                  <circle cx={c.x} cy={c.y} r="8" className="animate-ping" fill="#38bdf8" fillOpacity="0.4" />
                  <circle cx={c.x} cy={c.y} r="4.8" fill="white" fillOpacity="0.25" />
                </>
              )}
              <circle cx={c.x} cy={c.y} r={isAfrican ? '4.8' : '4.2'} fill="white" fillOpacity="0.25" />
              <circle
                cx={c.x}
                cy={c.y}
                r={isAfrican ? '2.5' : '2.2'}
                fill={isAfrican ? '#38bdf8' : 'white'}
                stroke={isAfrican ? 'white' : '#2F5FC4'}
                strokeWidth={isAfrican ? '1.1' : '0.9'}
              />
            </g>
          );
        })}

        {labelled.map(({ id, name, dx, dy }) => (
          <text
            key={id}
            x={city[id].x + dx}
            y={city[id].y + dy}
            textAnchor={dx < 0 ? 'end' : 'start'}
            fill="white"
            fillOpacity="0.95"
            fontSize="7"
            fontWeight="600"
          >
            {name ?? t('auth.aside.cairo')}
          </text>
        ))}
      </svg>

      {/* Floating Member Avatars with live beacon */}
      {members.map(({ initials, x, y }, idx) => (
        <span
          key={initials}
          style={at(x, y)}
          className={cn(
            'absolute flex size-9 -translate-1/2 items-center justify-center rounded-full border-2 border-white/95 bg-card text-[10px] font-bold text-brand-strong shadow-xl ring-4 ring-white/20 transition-transform hover:scale-110',
            memberAnimations[idx % memberAnimations.length]
          )}
          aria-hidden
        >
          {initials}
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
        </span>
      ))}

      {/* Floating Tech Ecosystem Badges */}
      <div className="pointer-events-none select-none">
        <span
          style={at(130, 150)}
          className="absolute -translate-1/2 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md shadow-lg animate-float-slow"
          aria-hidden
        >
          <span className="size-1.5 rounded-full bg-cyan-300" />
          React & TypeScript
        </span>
        <span
          style={at(338, 110)}
          className="absolute -translate-1/2 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md shadow-lg animate-float-reverse"
          aria-hidden
        >
          <span className="size-1.5 rounded-full bg-amber-300" />
          Python & Django
        </span>
        <span
          style={at(230, 42)}
          className="absolute -translate-1/2 hidden md:inline-flex items-center gap-1.5 rounded-full border border-sky-300/40 bg-sky-500/25 px-3.5 py-1 text-[11px] font-bold text-sky-100 backdrop-blur-md shadow-xl shadow-sky-950/20 animate-float-sway"
          aria-hidden
        >
          <span role="img" aria-label="Afrique">🌍</span>
          Tech Africa Hub
        </span>
      </div>

      {/* Floating Live Activity Cards with Smooth Motion */}
      <ul aria-label={t('auth.aside.activity')}>
        {cards.map((card, i) => (
          <li
            key={card.title}
            className={cn(
              'absolute min-w-44 rounded-2xl bg-card/95 px-4 py-3 shadow-xl shadow-blue-950/25 backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-105',
              cardPlaces[i],
              cardAnimations[i % cardAnimations.length]
            )}
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse" aria-hidden />
              <p className="text-sm font-semibold text-foreground">{card.title}</p>
            </div>
            <p className="mt-1 pl-4 text-xs text-muted-foreground">{card.meta}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
