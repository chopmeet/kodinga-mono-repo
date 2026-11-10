// Mock data for the block of the admin dashboard the api does not cover yet (everything else comes
// from the api: pages/admin/dashboard/form/UseAdminDashboard.ts).
// TODO(api): communities by pricing/privacy.

export type AccessShare = {
  id: 'free' | 'paid' | 'application';
  label: string;
  communities: number;
};

export const communitiesByAccess: AccessShare[] = [
  { id: 'free', label: 'Gratuites', communities: 942 },
  { id: 'paid', label: 'Payantes', communities: 223 },
  { id: 'application', label: 'Sur candidature', communities: 75 },
];
