import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from './http';

export const Team = {
  list: (q?: string, mine?: boolean, options?: { directory?: boolean; limit?: number }) => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (mine) params.push('mine=1');
    if (options?.directory) params.push('directory=1');
    if (typeof options?.limit === 'number') params.push(`limit=${String(options.limit)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/teams' + qs);
  },
  managed: (q?: string) => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/teams/managed' + qs);
  },
  get: (id: string) => httpGet('/teams/' + encodeURIComponent(id)),
  follow: (id: string) => httpPost(`/teams/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/teams/${encodeURIComponent(id)}/follow`),
  members: (id: string) => httpGet(`/teams/${encodeURIComponent(id)}/members`),
  allMembers: (q?: string) => httpGet('/teams/members/all' + (q ? `?q=${encodeURIComponent(q)}` : '')),
  create: (data: {
    name: string;
    description?: string;
    sport?: string;
    season?: string;
    season_start?: string;
    season_end?: string;
    organization_id?: string;
    organization_name?: string;
    logo_url?: string | null;
    authorized_users?: Array<{ email?: string; user_id?: string; role?: string; assign_team?: string }>;
    onboarding?: boolean;
  }) => {
    const payload: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'logo_url') {
        if (typeof value === 'string' && value.length > 0) {
          payload.logo_url = value;
        }
        return;
      }
      payload[key] = value;
    });
    return httpPost('/teams/create', payload);
  },
  update: (id: string, data: {
    name?: string;
    description?: string;
    sport?: string;
    season?: string;
    organization_id?: string | null;
    logo_url?: string | null;
  }) => {
    const payload: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'logo_url' && value === null) {
        payload[key] = '';
      } else {
        payload[key] = value;
      }
    });
    return httpPut('/teams/' + encodeURIComponent(id), payload);
  },
  invite: (teamId: string, email: string, role?: string) => httpPost(`/teams/${encodeURIComponent(teamId)}/invite`, { email, role }),
  myInvites: () => httpGet('/teams/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/decline`, {}),
  transferOwnership: (teamId: string, newOwnerId: string) => httpPost(`/teams/${encodeURIComponent(teamId)}/transfer-ownership`, { new_owner_id: newOwnerId }),
  updateMember: (
    membershipId: string,
    data: { role?: string; custom_position?: string | null }
  ) => httpPatch(`/team-memberships/${encodeURIComponent(membershipId)}`, data),
  removeMember: (membershipId: string, reason?: string) =>
    httpDelete(`/team-memberships/${encodeURIComponent(membershipId)}`, reason ? { reason } : undefined),
  delete: (id: string) => httpDelete('/teams/' + encodeURIComponent(id)),
  limits: () => httpGet('/teams/limits'),
};

export const TeamMemberships = {
  create: (data: { team_id: string; user_id: string; role?: string }) => httpPost('/team-memberships', data),
  update: (membershipId: string, data: { role?: string; custom_position?: string }) => httpPatch(`/team-memberships/${encodeURIComponent(membershipId)}`, data),
  delete: (membershipId: string) => httpDelete(`/team-memberships/${encodeURIComponent(membershipId)}`),
};

export const TeamInvites = {
  create: (data: { team_id: string; email: string; role?: string }) => httpPost('/team-invites', data),
};
