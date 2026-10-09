import { Button } from '@kodinga-mono-repo/ui';

/** Save / cancel bar shared by the settings forms: only active when something changed */
function FormActions({ isDirty, isSaving, onReset }: { isDirty: boolean; isSaving: boolean; onReset: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
      {isDirty && <span className="mr-auto text-sm text-amber-700">Modifications non enregistrées</span>}
      <Button type="button" variant="outline" onClick={onReset} disabled={!isDirty || isSaving}>
        Annuler
      </Button>
      <Button type="submit" disabled={!isDirty} isLoading={isSaving}>
        Enregistrer
      </Button>
    </div>
  );
}

export default FormActions;
