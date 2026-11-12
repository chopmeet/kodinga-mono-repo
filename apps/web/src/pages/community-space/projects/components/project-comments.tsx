import { CornerDownRight, Send } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage, Button, ColgateWrapper, customToast, EmptyAlert, TextareaInput } from '@kodinga/ui';
import { useAddProjectCommentMutation, useGetProjectCommentsQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectPerson } from '@/utils/api/project/project.type';
import { getName, nameInitials } from '@/utils/Utils';
import { formatDateTime } from '@/utils/format';

function Author({ person, at }: { person: ProjectPerson; at: string }) {
  const name = getName(person);
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
        <AvatarFallback>{nameInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(at)}</p>
      </div>
    </div>
  );
}

/** Text area + send button; `parentId` answers a comment */
function CommentForm({ projectSlug, parentId, label, onSent }: { projectSlug: string; parentId?: string; label: string; onSent?: () => void }) {
  const [content, setContent] = useState('');
  const [addComment, { isLoading }] = useAddProjectCommentMutation();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    try {
      await addComment({ projectSlug, content: text, ...(parentId ? { parent_id: parentId } : {}) }).unwrap();
      setContent('');
      onSent?.();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <TextareaInput id={`comment-${parentId ?? 'new'}`} label={label} rows={2} value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={isLoading} disabled={!content.trim()}>
          <Send />
          Publier
        </Button>
      </div>
    </form>
  );
}

/** Comments of a project, one level of replies (GET / POST projects/<slug>/comments/) */
export function ProjectComments({ projectSlug }: { projectSlug: string }) {
  const { data = [], isLoading, error } = useGetProjectCommentsQuery(projectSlug);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const count = data.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <ColgateWrapper className="border border-border p-5">
      <h2 className="font-semibold text-foreground">
        Commentaires <span className="text-faint tabular-nums">{count}</span>
      </h2>
      <div className="mt-3">
        <CommentForm projectSlug={projectSlug} label="Ajouter un commentaire" />
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chargement des commentaires…</p>
      ) : error ? (
        <EmptyAlert text={parseApiError(error).message} />
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Pas encore de commentaire.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border-soft" aria-label="Commentaires">
          {data.map((c) => (
            <li key={c.id} className="py-4">
              <Author person={c.author} at={c.created_at} />
              <p className="mt-2 whitespace-pre-line text-sm text-body">{c.content}</p>
              <button
                type="button"
                className="mt-1 text-sm font-semibold text-brand hover:underline"
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                aria-expanded={replyTo === c.id}
              >
                Répondre
              </button>
              {(c.replies.length > 0 || replyTo === c.id) && (
                <ul className="mt-3 space-y-3 border-l-2 border-border-soft pl-4" aria-label={`Réponses à ${getName(c.author)}`}>
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <Author person={r.author} at={r.created_at} />
                      <p className="mt-1 whitespace-pre-line text-sm text-body">{r.content}</p>
                    </li>
                  ))}
                  {replyTo === c.id && (
                    <li className="flex gap-2">
                      <CornerDownRight className="mt-2 size-4 shrink-0 text-faint" aria-hidden />
                      <div className="flex-1">
                        <CommentForm projectSlug={projectSlug} parentId={c.id} label={`Répondre à ${getName(c.author)}`} onSent={() => setReplyTo(null)} />
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </ColgateWrapper>
  );
}
