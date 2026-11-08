import { Check, CloudUpload, Download, Film, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, customToast } from '@kodinga-mono-repo/ui';
import { useAttachEventReplayMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { formatRecordingTime } from '../form/useLiveRecording';

type LiveRecordingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  durationSeconds: number;
  slug: string;
  eventId: string;
  eventTitle: string;
};

export function LiveRecordingModal({
  isOpen,
  onClose,
  recordedBlob,
  recordedUrl,
  durationSeconds,
  slug,
  eventId,
  eventTitle: _eventTitle,
}: LiveRecordingModalProps) {
  const [attachReplay] = useAttachEventReplayMutation();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Close on Escape key press (unless uploading)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading, onClose]);

  if (!isOpen || !recordedBlob || !recordedUrl) return null;

  const sizeMb = (recordedBlob.size / (1024 * 1024)).toFixed(1);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `replay-${slug}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    customToast.success({ message: 'Téléchargement de la vidéo démarré.' });
  };

  const handleUploadToUploadThing = async () => {
    setIsUploading(true);
    try {
      const fileName = `replay-${slug}-${Date.now()}.webm`;
      const videoFile = new File([recordedBlob], fileName, { type: recordedBlob.type || 'video/webm' });

      await attachReplay({
        slug,
        eventId,
        file: videoFile,
      }).unwrap();

      setUploadSuccess(true);
      customToast.success({
        message: 'Replay enregistré et publié pour la communauté !',
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errorMsg = parseApiError(err).message;
      customToast.error({ message: `Le replay n’a pas pu être enregistré : ${errorMsg}` });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Close when clicking backdrop outside the modal container
        if (e.target === e.currentTarget && !isUploading) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-recording-modal-title"
      >
        {/* Header - Fixed & Always Visible */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl bg-red-600/20 text-red-500 ring-1 ring-red-500/30 shrink-0">
              <Film className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <h2 id="live-recording-modal-title" className="text-sm sm:text-base font-semibold text-white truncate">
                Enregistrement du Live terminé
              </h2>
              <p className="text-xs text-slate-400">
                Durée : {formatRecordingTime(durationSeconds)} • Poids : {sizeMb} Mo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0 ml-2"
            title="Fermer"
            aria-label="Fermer la fenêtre d'enregistrement"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Video Preview & Info - Scrollable if screen height is constrained */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto min-h-0 flex-1 overscroll-contain">
          {/* Responsive Video: dynamically constrained in height so buttons remain reachable without scrolling */}
          <div className="relative w-full max-h-[36vh] sm:max-h-[42vh] aspect-video mx-auto overflow-hidden rounded-xl border border-white/10 bg-black shadow-inner flex items-center justify-center">
            <video
              src={recordedUrl}
              controls
              className="max-h-full max-w-full object-contain"
              preload="metadata"
            >
              <track kind="captions" />
            </video>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 sm:p-3.5 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-red-400">Publier en replay</p>
            <p className="text-slate-400 leading-relaxed">
              Envoyez cette vidéo sur Kodinga : elle sera disponible en replay pour les membres de la communauté.
            </p>
          </div>
        </div>

        {/* Footer actions - Fixed & Always Visible */}
        <div className="flex shrink-0 flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 border-t border-white/10 bg-slate-950/85 px-4 py-3 sm:px-6 sm:py-3.5 z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isUploading}
            className="w-full sm:w-auto border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <Download className="size-4" /> Télécharger une copie (.webm)
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              Ignorer
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleUploadToUploadThing}
              disabled={isUploading || uploadSuccess}
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-semibold text-white shadow-lg shadow-red-600/25"
            >
              {isUploading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Téléversement sur UploadThing...
                </>
              ) : uploadSuccess ? (
                <>
                  <Check className="size-4 text-emerald-400" />
                  Replay publié !
                </>
              ) : (
                <>
                  <CloudUpload className="size-4" />
                  Sauvegarder sur UploadThing
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
