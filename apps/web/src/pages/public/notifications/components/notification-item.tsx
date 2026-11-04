import { Award, Bell, BookOpen, Briefcase, CalendarClock, CheckCircle2, CircleX, Heart, MessageCircle, Radio, Rocket, Trophy, UserCheck, UserPlus, AtSign, type LucideIcon } from 'lucide-react';

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
  hackathon_new: Trophy,
  project_new: Rocket,
  opportunity_new: Briefcase,
  content_published: Bell,
  join_request: UserPlus,
  join_request_approved: UserCheck,
  join_request_rejected: CircleX,
  badge_unlocked: Award,
  community_invite: UserPlus,
};

type ContentKind = 'hackathon' | 'course' | 'project' | 'opportunity' | 'event';

const kinds: Record<ContentKind, { label: string; icon: LucideIcon; className: string }> = {
  hackathon: { label: 'Hackathon', icon: Trophy, className: 'bg-amber-50 text-amber-800' },
  course: { label: 'Formation', icon: BookOpen, className: 'bg-emerald-50 text-emerald-800' },
  project: { label: 'Projet', icon: Rocket, className: 'bg-violet-50 text-violet-800' },
  opportunity: { label: 'Opportunité', icon: Briefcase, className: 'bg-sky-50 text-sky-800' },
  event: { label: 'Événement', icon: CalendarClock, className: 'bg-rose-50 text-rose-800' },
};

/**
 * The content a notification is about: its target_type when the api gives one ("hackathon",
 * "hackathon_team"…), else the page it leads to. null for the others (messages, members…).
 */
export function contentKind(n: Pick<AppNotification, 'target_type' | 'action_url'>): ContentKind | null {
  const target = n.target_type.split('_')[0];
  if (target in kinds) return target as ContentKind;
  const url = n.action_url;
  if (/\/hackathons\//.test(url)) return 'hackathon';
  if (/\/courses\//.test(url)) return 'course';
  if (/^\/projects\//.test(url)) return 'project';
  if (/^\/opportunities\//.test(url)) return 'opportunity';
  if (/\/events\//.test(url)) return 'event';
  return null;
}

/** Icon, kind of content, title, text and age of a notification; a dot while it is unread */
export function NotificationContent({ notification: n, compact = false }: { notification: AppNotification; compact?: boolean }) {
  const kind = contentKind(n);
  // The content decides the icon (a new hackathon is sent as an "invitation")
  const Icon = kind ? kinds[kind].icon : (icons[n.notification_type] ?? Bell);
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-900')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {kind && <span className={cn('mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase', kinds[kind].className)}>{kinds[kind].label}</span>}
        <span className={cn('block text-sm', n.is_read ? 'text-slate-700' : 'font-semibold text-slate-900')}>{n.title}</span>
        {n.body && <span className={cn('mt-0.5 block text-sm text-slate-500', compact && 'line-clamp-2')}>{n.body}</span>}
        <span className="mt-1 block text-xs text-slate-400">{ago(n.created_at)}</span>
      </span>
      {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-900" aria-label="Non lue" />}
    </span>
  );
}
