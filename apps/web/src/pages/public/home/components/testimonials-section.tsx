import { ArrowRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@kodinga-mono-repo/ui';

import { testimonials } from '@/data/home.data';

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function TestimonialsSection() {
  return (
    <section className="border-t border-slate-200 bg-slate-50/70 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="font-mono text-xs font-semibold tracking-wider text-brand">
              [COMMUNITY STORIES]
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Ils animent les plus grandes communautés tech africaines
            </h2>
          </div>
          <a
            href="#stories"
            className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-brand"
          >
            Découvrir tous les retours d'expérience <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
            >
              <blockquote className="text-xs leading-relaxed text-slate-600 italic">
                « {t.quote} »
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <Avatar className="size-9 border border-slate-200">
                  <AvatarImage src={t.avatar} alt={t.name} className="object-cover" />
                  <AvatarFallback>{initials(t.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
