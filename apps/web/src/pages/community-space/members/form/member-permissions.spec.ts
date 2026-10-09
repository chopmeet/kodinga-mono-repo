import type { AdminMember, MemberRole, MemberStatus } from '@/data/admin-community-details.data';
import { assignableRoles, canSanction } from './member-permissions';

const member = (role: MemberRole, status: MemberStatus = 'active'): AdminMember => ({
  id: `${role}-${status}`,
  name: 'Test',
  username: 'test',
  city: 'Dakar',
  role,
  status,
  joined_at: '2026-01-01T00:00:00Z',
  posts_count: 0,
});

describe('member permissions', () => {
  it('never lets anyone sanction or change the owner', () => {
    for (const actor of ['owner', 'admin', 'moderator'] as const) {
      expect(canSanction(actor, member('owner'))).toBe(false);
      expect(assignableRoles(actor, member('owner'))).toEqual([]);
    }
  });

  it('keeps admins out of reach of other admins and moderators (owner only)', () => {
    expect(canSanction('owner', member('admin'))).toBe(true);
    expect(canSanction('admin', member('admin'))).toBe(false);
    expect(canSanction('moderator', member('admin'))).toBe(false);
    expect(canSanction('moderator', member('moderator'))).toBe(true);
  });

  it('lets the owner name admins, an admin name moderators, a moderator nobody', () => {
    expect(assignableRoles('owner', member('member'))).toEqual(['admin', 'moderator']);
    expect(assignableRoles('admin', member('member'))).toEqual(['moderator']);
    expect(assignableRoles('admin', member('moderator'))).toEqual(['member']);
    expect(assignableRoles('admin', member('admin'))).toEqual([]);
    expect(assignableRoles('moderator', member('member'))).toEqual([]);
  });

  it('does not change the role of a pending or banned member', () => {
    expect(assignableRoles('owner', member('member', 'pending'))).toEqual([]);
    expect(assignableRoles('owner', member('member', 'banned'))).toEqual([]);
    expect(canSanction('owner', member('member', 'pending'))).toBe(false);
  });
});
