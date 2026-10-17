// Projects (apps/projects): showcase of the members' projects, optionally tied to a community.
// These views answer the serializer data as is (no { success, data } envelope).

export type ProjectStatus = 'draft' | 'published' | 'archived';
export type ProjectOrder = 'upvotes' | 'recent' | 'views';

export type ProjectPerson = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  headline: string;
};

export type ProjectTechnology = { id: string; name: string; slug: string; icon_url: string };

/** ProjectSerializer (lists) */
export type ProjectListItem = {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  cover_image_url: string;
  demo_url: string;
  repository_url: string;
  status: ProjectStatus;
  upvotes_count: number;
  views_count: number;
  is_featured: boolean;
  is_upvoted: boolean;
  owner: ProjectPerson;
  technologies: ProjectTechnology[];
  created_at: string;
};

/** ProjectDetailSerializer */
export type Project = ProjectListItem & {
  description: string;
  community_id: string | null;
  updated_at: string;
};

/** CreateProjectSerializer (PATCH takes any subset) */
export type ProjectWriteData = {
  title: string;
  tagline: string;
  description: string;
  cover_image_url: string;
  demo_url: string;
  repository_url: string;
  community_id: string | null;
  status: ProjectStatus;
  technology_ids: string[];
};

export type ProjectsQuery = { community: string; order_by?: ProjectOrder; search?: string };

/** ProjectCommentSerializer: top-level comments, with one level of replies */
export type ProjectComment = {
  id: string;
  author: ProjectPerson;
  content: string;
  parent_id: string | null;
  replies: { id: string; author: ProjectPerson; content: string; created_at: string }[];
  created_at: string;
};
