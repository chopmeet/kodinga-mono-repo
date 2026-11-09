import type { Translations } from '../types';

export const search: Translations['search'] = {
  title: 'Search Kodinga',
  placeholder: 'A community, a course, a developer…',
  filtersLabel: 'Filter results',
  filters: {
    all: 'All',
    communities: 'Communities',
    courses: 'Courses',
    events: 'Events',
    developers: 'Developers',
    discussions: 'Discussions',
  },
  trending: {
    communities: 'Popular communities',
    courses: 'Most followed courses',
    events: 'Upcoming events',
  },
  noResult: 'No results for “{{q}}”.',
  unavailable: 'Search is temporarily unavailable.',
  searching: 'Searching…',
  oneMoreLetter: 'One more letter…',
  members_one: '{{formatted}} member',
  members_other: '{{formatted}} members',
  lessons_one: '{{formatted}} lesson',
  lessons_other: '{{formatted}} lessons',
  replies_one: '{{formatted}} reply',
  replies_other: '{{formatted}} replies',
  paid: 'Paid',
  free: 'Free',
  live: 'Live',
  discussionBy: 'Discussion by @{{username}}',
};
