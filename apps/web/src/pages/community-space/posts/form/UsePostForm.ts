import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useCreatePostMutation, useDeletePostMediaMutation, useUpdatePostMutation } from '@/utils/api/community/community.api';
import type { PostWriteData } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import UsePostAttachments from './UsePostAttachments';
import type { SpacePost } from './UseSpacePosts';

/** A discussion may go without a title (the feed shows its first words); the other types need one */
const TITLE_OPTIONAL = 'discussion';

const schema = z
  .object({
    post_type: z.enum(['announcement', 'discussion', 'question', 'project_showcase', 'poll']),
    title: z.string().trim().max(255, '255 caractères maximum'),
    content: z.string().trim().min(1, 'Écrivez le contenu de la publication'),
    with_code: z.boolean(),
    code_snippet: z.string(),
    code_language: z.string(),
    poll_options: z.array(z.object({ value: z.string().trim().max(255, '255 caractères maximum') })),
    poll_multiple: z.boolean(),
    poll_days: z.enum(['1', '3', '7', '14', '30']),
  })
  .refine((v) => v.post_type === TITLE_OPTIONAL || v.title.length >= 3, { path: ['title'], message: 'Au moins 3 caractères' })
  .refine((v) => !v.with_code || v.code_snippet.trim().length > 0, { path: ['code_snippet'], message: 'Collez le code ou retirez l’extrait' })
  // Same rule as the api: at least 2 options
  .refine((v) => v.post_type !== 'poll' || v.poll_options.filter((o) => o.value).length >= 2, {
    path: ['poll_options'],
    message: 'Au moins 2 options',
  });

export type PostFormValues = z.infer<typeof schema>;

export const MAX_POLL_OPTIONS = 10;

const DEFAULTS: PostFormValues = {
  post_type: 'announcement',
  title: '',
  content: '',
  with_code: false,
  code_snippet: '',
  code_language: 'typescript',
  poll_options: [{ value: '' }, { value: '' }],
  poll_multiple: false,
  poll_days: '7',
};

const fromPost = (p: SpacePost): PostFormValues => ({
  ...DEFAULTS,
  post_type: p.post_type,
  title: p.title,
  content: p.content,
  with_code: !!p.code_snippet,
  code_snippet: p.code_snippet ?? '',
  code_language: p.code_language || DEFAULTS.code_language,
});

/**
 * Publish in the community feed (POST communities/<slug>/feed/) or edit one's own post
 * (PATCH posts/<id>/, author only). The poll is only sent on creation: the api cannot change it.
 */
function UsePostForm({
  slug,
  post,
  open,
  onDone,
  defaultType = DEFAULTS.post_type,
}: {
  slug: string;
  post: SpacePost | null;
  open: boolean;
  onDone: () => void;
  /** Type selected when creating (the team announces, the members discuss) */
  defaultType?: PostFormValues['post_type'];
}) {
  const [createPost] = useCreatePostMutation();
  const [updatePost] = useUpdatePostMutation();
  const [deletePostMedia] = useDeletePostMediaMutation();
  const attachments = UsePostAttachments({ open, media: post?.media });
  const form = useForm<PostFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { control, reset, setError, watch, handleSubmit } = form;
  const options = useFieldArray({ control, name: 'poll_options' });

  useEffect(() => {
    if (open) reset(post ? fromPost(post) : { ...DEFAULTS, post_type: defaultType });
  }, [open, post, reset, defaultType]);

  const onSubmit = async (v: PostFormValues) => {
    const body: PostWriteData = {
      post_type: v.post_type,
      title: v.title,
      content: v.content,
      code_snippet: v.with_code ? v.code_snippet : '',
      code_language: v.with_code ? v.code_language : '',
    };
    // Images and documents: their ids in display order (on edit, only when they changed: the list replaces the previous one)
    if (!post && attachments.mediaIds.length) body.media_ids = attachments.mediaIds;
    if (!post && attachments.videoIds.length) body.video_ids = attachments.videoIds;
    try {
      if (post) {
        if (attachments.changed) {
          // Removed attachments are deleted from the storage, then the list of the post is replaced
          for (const mediaId of attachments.removedExisting) await deletePostMedia({ postId: post.id, mediaId }).unwrap();
          body.media_ids = attachments.mediaIds;
          body.video_ids = attachments.videoIds;
        }
        await updatePost({ postId: post.id, ...body }).unwrap();
        attachments.markPublished();
        customToast.success({ message: 'Publication mise à jour.' });
        onDone();
      } else {
        // Optimistic instant feedback (Facebook/LinkedIn-style: 0ms close & DOM insertion)
        attachments.markPublished();
        onDone();
        customToast.success({ message: 'Publication partagée avec la communauté.' });
        createPost({
          slug,
          ...body,
          ...(v.post_type === 'poll'
            ? {
                poll: {
                  question: v.title,
                  options: v.poll_options.map((o) => o.value).filter(Boolean),
                  is_multiple_choice: v.poll_multiple,
                  duration_days: Number(v.poll_days),
                },
              }
            : {}),
        })
          .unwrap()
          .catch((error) => {
            const { message } = parseApiError(error);
            customToast.error({ message });
          });
      }
    } catch (error) {
      const { message, fields } = parseApiError(error);
      if (fields.title) setError('title', { message: fields.title });
      else if (fields.content) setError('content', { message: fields.content });
      else if (fields.poll) setError('poll_options', { message: fields.poll });
      else customToast.error({ message });
    }
  };

  return {
    form,
    options,
    attachments,
    type: watch('post_type'),
    withCode: watch('with_code'),
    titleOptional: watch('post_type') === TITLE_OPTIONAL,
    onSubmit: handleSubmit(onSubmit),
  };
}

export default UsePostForm;
