import { Award, Bell, BookOpen, CalendarClock, CheckCircle2, Heart, MessageCircle, Radio, UserPlus, AtSign, type LucideIcon } from 'lucide-react';

import { cn } from '@kodinga-mono-repo/ui';
import type { AppNotification, NotificationType } from '@/utils/api/notification/notification.type';
import { ago } from '@/utils/Utils';

const icons: Record<NotificationType, LucideIcon> = {
  system: Bell,
  post_interaction: Heart,
  comment_reply: MessageCircle,
  accepted_answer: CheckCircle2,
  mention: AtSign,
  event_reminder: CalendarClock,
  event_live_started: Radio,
  course_new: BookOpen,
  badge_unlocked: Award,
  community_invite: UserPlus,
};

/** Icon, title, text and age of a notification; a dot while it is unread */
export function NotificationContent({ notification: n, compact = false }: { notification: AppNotification; compact?: boolean }) {
  const Icon = icons[n.notification_type] ?? Bell;
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-900')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', n.is_read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{n.title}</span>
        {n.body && <span className={cn('mt-0.5 block text-sm text-slate-500', compact && 'line-clamp-2')}>{n.body}</span>}
        <span className="mt-1 block text-xs text-slate-400">{ago(n.created_at)}</span>
      </span>
      {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-900" aria-label="Non lue" />}
    </span>
  );
}
