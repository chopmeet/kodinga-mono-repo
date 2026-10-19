// Mirrors apps/events (models/event.py, serializers/event.py, serializers/attendee.py)

export type EventType = 'live_stream' | 'webinar' | 'workshop' | 'qna' | 'meetup';
export type EventFormat = 'livekit' | 'external' | 'in_person' | 'hybrid';
export type EventStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type RsvpStatus = 'attending' | 'maybe' | 'declined';

export type EventPerson = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string;
};

/** EventSerializer (list) — EventDetailSerializer adds location_url, live_room_name, metadata */
export type CommunityEvent = {
  id: string;
  community: { id: string; name: string; slug: string; avatar_url: string };
  host: EventPerson | null;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  event_type: EventType;
  format: EventFormat;
  status: EventStatus;
  start_time: string;
  end_time: string;
  timezone: string;
  venue_name: string;
  location_address: string;
  location_city: string;
  location_country: string;
  attendees_count: number;
  max_attendees: number | null;
  is_full: boolean;
  is_upcoming: boolean;
  is_in_progress: boolean;
  is_recorded: boolean;
  is_public: boolean;
  duration_minutes: number;
  user_rsvp_status: RsvpStatus | null;
  replay_video_asset: { id: string; playback_url?: string; status?: string } | null;
  location_url?: string;
  created_at: string;
};

/** EventCreateUpdateSerializer (POST, PATCH partial) */
export type EventWriteData = {
  title: string;
  description?: string;
  cover_image_url?: string;
  event_type: EventType;
  format: EventFormat;
  start_time: string;
  end_time: string;
  timezone: string;
  venue_name?: string;
  location_address?: string;
  location_city?: string;
  location_country?: string;
  location_url?: string;
  max_attendees?: number | null;
  is_recorded: boolean;
  is_public: boolean;
};

export type EventsQuery = {
  slug: string;
  status?: EventStatus;
  event_type?: EventType;
  upcoming?: boolean;
  page?: number;
  page_size?: number;
};

export type EventAttendee = {
  id: string;
  event_id: string;
  user: EventPerson;
  status: RsvpStatus;
  checked_in_at: string | null;
  created_at: string;
};

/** POST communities/<slug>/events/<id>/join-live/ (LiveKitTokenResponseSerializer) */
export type LiveJoin = { room_name: string; token: string; server_url: string; is_host: boolean };
