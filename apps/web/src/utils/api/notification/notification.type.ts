// Mirrors apps/notifications (models/notification.py, serializers/notification_serializer.py)

export type NotificationType =
  | 'system'
  | 'post_interaction'
  | 'comment_reply'
  | 'accepted_answer'
  | 'mention'
  | 'event_reminder'
  | 'event_live_started'
  | 'course_new'
  | 'hackathon_new'
  | 'project_new'
  | 'opportunity_new'
  | 'content_published'
  | 'join_request'
  | 'join_request_approved'
  | 'join_request_rejected'
  | 'badge_unlocked'
  | 'community_invite';

export type AppNotification = {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  /** Path in the web app chosen by the api (it may name pages the app does not have) */
  action_url: string;
  target_type: string;
  /** join_request: the id of the member who asked to join */
  target_id: string;
  is_read: boolean;
  read_at: string | null;
  actor: { id: string; username: string; name: string; avatar_url: string } | null;
  created_at: string;
};
