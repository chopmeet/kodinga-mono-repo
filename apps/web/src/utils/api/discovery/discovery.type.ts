// Global search and trends of the platform (apps/discovery)

export type DiscoveryType = 'community' | 'course' | 'event' | 'developer' | 'post';

export type DiscoveryCommunity = { id: string; name: string; slug: string; description: string; avatar_url: string; banner_url: string; members_count: number; pricing_type: 'free' | 'paid' };
export type DiscoveryCourse = {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  level: string;
  lessons_count: number;
  duration_seconds: number;
  students_count: number;
  community_slug: string;
  community_name: string;
};
export type DiscoveryEvent = {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  event_type: string;
  format: string;
  status: string;
  start_time: string;
  end_time: string;
  timezone: string;
  attendees_count: number;
  community_slug: string;
  community_name: string;
};
export type DiscoveryDeveloper = { id: string; username: string; full_name: string; avatar_url: string; headline: string; bio: string };
export type DiscoveryPost = {
  id: string;
  title: string;
  content: string;
  post_type: string;
  author_username: string;
  community_slug: string;
  reactions_count: number;
  comments_count: number;
  created_at: string;
};

/** GET discovery/search/?q=&type=&limit= (public communities, published courses, public events…) */
export type DiscoverySearch = {
  communities: DiscoveryCommunity[];
  courses: DiscoveryCourse[];
  events: DiscoveryEvent[];
  developers: DiscoveryDeveloper[];
  posts: DiscoveryPost[];
};

/** GET discovery/trending/: the biggest communities, the most followed courses, the next events */
export type DiscoveryTrending = Pick<DiscoverySearch, 'communities' | 'courses' | 'events'>;
