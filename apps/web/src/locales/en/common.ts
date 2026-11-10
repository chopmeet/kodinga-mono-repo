import type { Translations } from '../types';

export const common: Translations['common'] = {
  time: {
    now: 'Just now',
    minutesAgo: '{{count}} min ago',
    hoursAgo: '{{count}} h ago',
    today: 'present',
  },
  image: {
    badFormat: 'Format not accepted: {{formats}}.',
    tooHeavy: 'Image too large: {{max}} MB maximum.',
  },
  notFound: {
    title: 'Page not found',
    text: 'The page you are looking for does not exist or has been moved.',
    illustration: 'Illustration: page not found',
    back: 'Back',
    home: 'Back to home',
  },
  actions: {
    retry: 'Try again',
    cancel: 'Cancel',
    back: 'Back',
    close: 'Close',
    save: 'Save',
    seeMore: 'See more',
    showMore: 'Show more',
    loading: 'Loading…',
  },
};
