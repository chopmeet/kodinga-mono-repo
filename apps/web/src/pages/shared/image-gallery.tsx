import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@kodinga-mono-repo/ui';

type Props = {
  images: string[];
  /** Names the images: "Capture 2 de Tontine Plus" */
  title: string;
  className?: string;
};

/**
 * Thumbnails of images (demo screenshots of a project) and a viewer: previous / next with the
 * buttons or the arrow keys, Escape to close
 */
export function ImageGallery({ images, title, className }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const count = images.length;
  const go = (offset: number) => setOpen((i) => (i === null ? i : (i + offset + count) % count));

  return (
    <>
      <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)} aria-label={`Captures de ${title}`}>
        {images.map((url, i) => (
          <li key={`${url}-${i}`}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Agrandir la capture ${i + 1} sur ${count}`}
              className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-900/40 focus-visible:outline-none"
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover transition duration-200 group-hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent
          className="max-w-5xl border-0 bg-slate-950 p-3 text-white sm:max-w-5xl"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          <DialogTitle className="sr-only">
            Capture {(open ?? 0) + 1} de {title}
          </DialogTitle>
          <DialogDescription className="sr-only">Flèches gauche et droite pour passer d’une capture à l’autre.</DialogDescription>
          {open !== null && (
            <div className="relative flex items-center justify-center">
              <img src={images[open]} alt={`Capture ${open + 1} de ${title}`} className="max-h-[80vh] w-auto rounded-lg object-contain" />
              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Capture précédente"
                    className="absolute left-2 flex size-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="Capture suivante"
                    className="absolute right-2 flex size-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  <span className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold" aria-live="polite">
                    {open + 1} / {count}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
