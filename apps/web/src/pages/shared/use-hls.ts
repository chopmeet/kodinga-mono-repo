import { type RefObject, useEffect } from 'react';

/**
 * Plays an HLS stream (.m3u8, Mux) in a <video>: Safari natively, the other browsers through
 * hls.js, loaded only then. `enabled` false: nothing is loaded yet (e.g. before the first play).
 */
export function useHls(ref: RefObject<HTMLVideoElement | null>, url: string | null | undefined, enabled = true) {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !url || !element) return;
    if (!url.includes('.m3u8') || element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = url;
      return;
    }
    let destroy: (() => void) | undefined;
    let cancelled = false;
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        element.src = url;
        return;
      }
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(element);
      destroy = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [ref, url, enabled]);
}
