import { BarChart3, Code2, FolderGit2, HelpCircle, Megaphone, MessagesSquare, Plus, Smile, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
  TextareaInput,
} from '@kodinga/ui';
import { insertAtCursor, postTypeLabel } from '@/utils/Utils';
import { EmojiPickerButton } from '@/pages/shared/emoji-picker-button';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { PostType } from '@/utils/api/community/community.type';
import { PostAttachmentsField } from '../components/post-attachments-field';
import UseDuplicateCheck from '../form/UseDuplicateCheck';
import UsePostForm, { MAX_POLL_OPTIONS } from '../form/UsePostForm';
import type { SpacePost } from '../form/UseSpacePosts';
import { CODE_LANGUAGE_OPTIONS, CodeBlock } from '@/pages/shared/code-block';

const TYPES: { value: PostType; icon: ReactNode; hint: string }[] = [
  { value: 'announcement', icon: <Megaphone />, hint: 'Information officielle de l’équipe' },
  { value: 'discussion', icon: <MessagesSquare />, hint: 'Lancer un échange' },
  { value: 'question', icon: <HelpCircle />, hint: 'Demander de l’aide' },
  { value: 'project_showcase', icon: <FolderGit2 />, hint: 'Présenter un projet' },
  { value: 'poll', icon: <BarChart3 />, hint: 'Faire voter les membres' },
];


const DURATIONS = [
  { value: '1', label: '1 jour' },
  { value: '3', label: '3 jours' },
  { value: '7', label: '7 jours' },
  { value: '14', label: '14 jours' },
  { value: '30', label: '30 jours' },
];

type Props = {
  slug: string;
  open: boolean;
  /** null to create */
  post: SpacePost | null;
  onClose: () => void;
  defaultType?: PostType;
};

function PostFormModal({ slug, open, post, onClose, defaultType }: Props) {
  const { form, options, attachments, type, withCode, titleOptional, onSubmit } = UsePostForm({ slug, post, open, onDone: onClose, defaultType });
  // Closed without publishing: the files uploaded for it are deleted
  const close = () => {
    attachments.discard();
    onClose();
  };
  const codePreview = form.watch('code_snippet');
  const codeLanguagePreview = form.watch('code_language');
  // A new question: the ones already asked, close to it
  const duplicates = UseDuplicateCheck({ slug, enabled: !post && type === 'question', title: form.watch('title') ?? '', content: form.watch('content') ?? '' });
  const {
    register,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = form;
  // The api cannot turn a post into a poll (or change a poll) after creation
  const types = post ? TYPES.filter((t) => t.value !== 'poll' || post.post_type === 'poll') : TYPES;
  const typeLocked = post?.post_type === 'poll';

  // An emoji at the caret of the content (its field registered with react-hook-form)
  const insertEmoji = (emoji: string) => {
    const el = document.getElementById('post-content') as HTMLTextAreaElement | null;
    const next = insertAtCursor(el, form.getValues('content') ?? '', emoji);
    setValue('content', next.value, { shouldDirty: true, shouldValidate: !!errors.content });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && close()}>
      <DialogContent position="top" className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? 'Modifier la publication' : 'Nouvelle publication'}</DialogTitle>
          <DialogDescription>Elle apparaît dans le fil de la communauté.</DialogDescription>
        </DialogHeader>

        <form id="post-form" onSubmit={onSubmit} noValidate>
          <div role="radiogroup" aria-label="Type de publication" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {types.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={type === t.value}
                disabled={typeLocked && type !== t.value}
                title={t.hint}
                onClick={() => setValue('post_type', t.value, { shouldValidate: false })}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors [&_svg]:size-5',
                  type === t.value ? 'border-blue-900 bg-brand-subtle text-brand-strong' : 'border-border text-soft hover:border-border-strong',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                {t.icon}
                {postTypeLabel[t.value]}
              </button>
            ))}
          </div>

          <Input
            id="post-title"
            label={type === 'poll' ? 'Question du sondage' : titleOptional ? 'Titre (facultatif)' : 'Titre'}
            required={!titleOptional}
            error={errors.title?.message}
            {...register('title')}
          />
          <TextareaInput
            id="post-content"
            label={type === 'poll' ? 'Contexte' : 'Contenu'}
            required
            rows={6}
            fieldHelp="Markdown accepté : **gras**, listes, liens…"
            error={errors.content?.message}
            {...register('content')}
          />

          {duplicates.length > 0 && (
            <section aria-labelledby="post-duplicates-title" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p id="post-duplicates-title" className="text-sm font-semibold text-amber-900">
                Des questions proches existent déjà
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80">La réponse s’y trouve peut-être. Vous pouvez publier quand même.</p>
              <ul className="mt-2 flex flex-col gap-1.5" aria-label="Questions proches">
                {duplicates.map((d) => (
                  <li key={d.id} className="text-sm">
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-brand-strong hover:underline">
                      {d.title || 'Question sans titre'}
                    </a>
                    {d.is_solved && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Résolue</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {type === 'poll' && !post && (
            <fieldset className="mb-4 rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">Options du sondage</legend>
              <ol className="space-y-2">
                {options.fields.map((field, i) => (
                  <li key={field.id} className="flex items-start gap-2">
                    <Input
                      id={`poll-option-${i}`}
                      label={`Option ${i + 1}`}
                      customClassContainer="mb-0! flex-1"
                      error={errors.poll_options?.[i]?.value?.message}
                      {...register(`poll_options.${i}.value`)}
                    />
                    {options.fields.length > 2 && (
                      <Button type="button" variant="ghost" size="icon-sm" className="mt-8" aria-label={`Retirer l'option ${i + 1}`} onClick={() => options.remove(i)}>
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
              {/* List-level error: on .root for a field array, on the field itself for a server error */}
              {(errors.poll_options?.root?.message ?? errors.poll_options?.message) && (
                <p className="mt-2 text-sm text-red-600">{errors.poll_options?.root?.message ?? errors.poll_options?.message}</p>
              )}
              {options.fields.length < MAX_POLL_OPTIONS && (
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => options.append({ value: '' })}>
                  <Plus />
                  Ajouter une option
                </Button>
              )}
              <div className="mt-4 grid gap-x-4 sm:grid-cols-2">
                <SelectInput label="Durée du vote" options={DURATIONS} {...register('poll_days')} />
                <Controller
                  control={control}
                  name="poll_multiple"
                  render={({ field }) => (
                    <SettingSwitch label="Choix multiple" description="Plusieurs réponses possibles." checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            </fieldset>
          )}

          {withCode ? (
            <fieldset className="mb-4 rounded-xl border border-border p-4" aria-labelledby="post-code-title">
              <div className="flex items-center justify-between">
                <p id="post-code-title" className="text-sm font-semibold text-foreground">Extrait de code</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue('with_code', false)}>
                  <Trash2 />
                  Retirer
                </Button>
              </div>
              <SelectInput label="Langage" options={CODE_LANGUAGE_OPTIONS} customClassContainer="sm:w-56" {...register('code_language')} />
              <TextareaInput
                id="post-code"
                label="Code"
                rows={6}
                className="font-mono text-sm"
                error={errors.code_snippet?.message}
                {...register('code_snippet')}
              />
              {/* What the members will read: colored, numbered */}
              {codePreview.trim() && (
                <div aria-label="Aperçu du code" role="group">
                  <p className="text-xs font-medium text-muted-foreground">Aperçu</p>
                  <CodeBlock code={codePreview} language={codeLanguagePreview} className="mt-1" />
                </div>
              )}
            </fieldset>
          ) : null}

          <PostAttachmentsField attachments={attachments}>
            <EmojiPickerButton
              onSelect={insertEmoji}
              label="Insérer un emoji dans le contenu"
              align="start"
              className="h-8 gap-1.5 border border-border bg-card px-3 text-sm font-medium text-body"
            >
              <Smile className="size-4" />
              Emoji
            </EmojiPickerButton>
            {!withCode && (
              <Button type="button" variant="outline" size="sm" onClick={() => setValue('with_code', true)}>
                <Code2 />
                Ajouter du code
              </Button>
            )}
          </PostAttachmentsField>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="post-form"
            isLoading={isSubmitting}
            disabled={attachments.isUploading || attachments.hasErrors}
            title={attachments.isUploading ? `Envoi des fichiers en cours (${attachments.overallProgress}%)…` : attachments.hasErrors ? 'Retirez les fichiers en échec' : undefined}
          >
            {post ? 'Enregistrer' : attachments.isUploading ? `Publier (${attachments.overallProgress}%)` : 'Publier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PostFormModal;
