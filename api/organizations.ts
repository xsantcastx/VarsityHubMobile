import { httpDelete, httpGet, httpPatch, httpPost } from './http';

export const Organization = {
  list: (q?: string, limit: number = 50) => {
    const params: string[] = [];
    if (q) params.push('q=' + encodeURIComponent(q));
    if (typeof limit === 'number') params.push('limit=' + encodeURIComponent(String(limit)));
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/organizations' + qs);
  },
  mine: () => httpGet('/organizations/mine'),
  get: (id: string) => httpGet('/organizations/' + encodeURIComponent(id)),
  update: (id: string, data: { name?: string; description?: string | null; logo_url?: string | null; profile_picture_url?: string | null; background_url?: string | null; sport?: string | null; org_type?: string | null; location?: string | null; zip_code?: string | null }) =>
    httpPatch('/organizations/' + encodeURIComponent(id), data),
  follow: (id: string) => httpPost(`/organizations/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/organizations/${encodeURIComponent(id)}/follow`),
  members: (id: string) => httpGet(`/organizations/${encodeURIComponent(id)}/members`),
  createOrganization: (data: {
    name: string;
    description?: string;
    sport?: string;
    season_start?: string;
    season_end?: string;
    org_type?: string;
    location?: string;
    formatted_address?: string;
    place_id?: string;
    zip_code?: string;
    latitude?: number;
    longitude?: number;
    supporting_document_url: string;
  }) => httpPost('/organizations', data),
  createWithTeams: (data: any) => httpPost('/organizations/create', data),
  invite: (organizationId: string, email: string, role?: string) => httpPost(`/organizations/${encodeURIComponent(organizationId)}/invite`, { email, role }),
  transferOwnership: (organizationId: string, newOwnerId: string) => httpPost(`/organizations/${encodeURIComponent(organizationId)}/transfer-ownership`, { new_owner_id: newOwnerId }),
  myInvites: () => httpGet('/organizations/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/decline`, {}),
  requestToJoin: (organizationId: string, message?: string, role?: string) =>
    httpPost(`/organizations/join-requests`, { organization_id: organizationId, message, role }),
  getJoinRequests: (organizationId: string, status?: 'pending' | 'approved' | 'rejected' | 'all') => {
    const params: string[] = [];
    if (status) params.push('status=' + encodeURIComponent(status));
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet(`/organizations/${encodeURIComponent(organizationId)}/join-requests` + qs);
  },
  approveJoinRequest: (requestId: string) => httpPost(`/organizations/join-requests/${encodeURIComponent(requestId)}/approve`, {}),
  rejectJoinRequest: (requestId: string, reason?: string) => httpPost(`/organizations/join-requests/${encodeURIComponent(requestId)}/deny`, { reason }),
  pendingCoaches: (organizationId: string) =>
    httpGet(`/organizations/${encodeURIComponent(organizationId)}/pending-coaches`),
  approveCoach: (organizationId: string, userId: string, note?: string) =>
    httpPost(`/organizations/${encodeURIComponent(organizationId)}/coaches/${encodeURIComponent(userId)}/approve`, { note }),
  rejectCoach: (organizationId: string, userId: string, reason?: string) =>
    httpPost(`/organizations/${encodeURIComponent(organizationId)}/coaches/${encodeURIComponent(userId)}/reject`, { reason }),
  approveLeague: (organizationId: string, note?: string) =>
    httpPost(`/organizations/${encodeURIComponent(organizationId)}/approve`, { note }),
  rejectLeague: (organizationId: string, reason?: string) =>
    httpPost(`/organizations/${encodeURIComponent(organizationId)}/reject`, { reason }),
};
