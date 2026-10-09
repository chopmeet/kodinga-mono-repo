import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button, customToast, InputQuill } from '@kodinga-mono-repo/ui';
import type { LegalPageId } from '@/data/admin-settings.data';
import { useSettings } from '../admin-settings';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Rich text of a legal page: read mode, then "Modifier" opens the editor (same pattern as moovi) */
function LegalPageTab({ pageId }: { pageId: LegalPageId }) {
  const { legal, saveLegal } = useSettings();
  const page = legal[pageId];
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quill leaves "<p><br></p>" when everything is erased
  const isEmpty = (html: string) => html.replace(/<[^>]*>/g, '').trim().length === 0;

  const save = async () => {
    if (draft === null || isEmpty(draft)) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveLegal(pageId, draft);
    setSaving(false);
    setDraft(null);
    customToast.success({ message: `« ${page.title} » mise à jour.` });
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{page.title}</h2>
          <p className="text-sm text-slate-500">Dernière mise à jour le {dateFormat.format(new Date(page.updated_at))}</p>
        </div>
        {draft === null && (
          <Button variant="outline" onClick={() => setDraft(page.content)}>
            <Pencil />
            Modifier
          </Button>
        )}
      </div>

      {draft === null ? (
        // Admin-authored HTML from the editor, rendered as-is (sanitize server-side when the api stores it)
        <article
          className="max-w-3xl text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      ) : (
        <div>
          <InputQuill id={`legal-${pageId}`} value={draft} onChange={setDraft} label="Contenu" />
          {isEmpty(draft) && <p role="alert" className="text-sm text-red-600">Le contenu ne peut pas être vide.</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={save} isLoading={saving} disabled={isEmpty(draft) || draft === page.content}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LegalPageTab;
