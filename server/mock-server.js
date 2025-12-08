import cors from 'cors';
import express from 'express';

// ⚠️  Development/Testing Only
// This file uses hardcoded credentials and permissive auth mocks.
// It should NEVER be used in production environments.
if (process.env.NODE_ENV === 'production') {
  throw new Error('mock-server.js is for development testing only and must not run in production');
}

const app = express();
// Disable X-Powered-By header to prevent information disclosure
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Simple in-memory token -> user map for dev
const TOKENS = new Map();

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Mock API running' });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  // Very permissive dev mock: accept any credentials
  const token = 'dev-token-' + Math.random().toString(36).slice(2, 10);
  const user = {
    id: 'dev-user-1',
    email,
    display_name: (email && email.split('@')[0]) || 'Dev',
    avatar_url: null,
  };
  TOKENS.set(token, user);
  return res.json({ access_token: token, user });
});

// Social login mocks
app.post('/auth/google', (req, res) => {
  const { id_token } = req.body || {};
  if (!id_token) return res.status(400).json({ error: 'Missing id_token' });
  const token = 'dev-google-' + Math.random().toString(36).slice(2, 10);
  const user = {
    id: 'dev-google-user',
    email: 'googleuser@example.com',
    display_name: 'Google User',
    avatar_url: null,
  };
  TOKENS.set(token, user);
  return res.json({ access_token: token, user, provider: 'google' });
});

app.post('/auth/apple', (req, res) => {
  const { identity_token, authorization_code, user: userHint } = req.body || {};
  const provided = identity_token || authorization_code || (userHint ? `sim-${userHint}` : null);
  if (!provided) return res.status(400).json({ error: 'Missing token' });
  const token = 'dev-apple-' + Math.random().toString(36).slice(2, 10);
  const user = {
    id: 'dev-apple-user',
    email: 'appleuser@example.com',
    display_name: 'Apple User',
    avatar_url: null,
  };
  TOKENS.set(token, user);
  return res.json({ access_token: token, user, provider: 'apple' });
});

// Sample games for feed
const SAMPLE_GAMES = [
  {
    id: 'game-1',
    title: 'Springfield High vs Shelbyville High',
    date: new Date(Date.now() + 86400000).toISOString(),
    location: '123 Stadium Ave, Springfield, IL 62701',
    latitude: 39.7817,
    longitude: -89.6501,
    cover_image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    banner_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    event_id: 'event-1',
  },
  {
    id: 'game-2',
    title: 'Lincoln Prep vs Jefferson Academy',
    date: new Date(Date.now() + 172800000).toISOString(),
    location: '456 Arena Rd, Springfield, IL 62702',
    latitude: 39.8017,
    longitude: -89.6401,
    cover_image_url: 'https://images.unsplash.com/photo-1577223625816-7546f32181e2?w=800',
    banner_url: 'https://images.unsplash.com/photo-1577223625816-7546f32181e2?w=800',
    event_id: null,
  },
  {
    id: 'game-3',
    title: 'Chelsea Warriors vs Manhattan Knights',
    date: new Date(Date.now() + 259200000).toISOString(),
    location: 'Chelsea Piers, New York, NY',
    latitude: 40.7489,
    longitude: -74.0028,
    cover_image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    banner_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    event_id: null,
  },
];

app.get('/games', (req, res) => {
  // Support simple query params like limit or sort
  const { limit } = req.query;
  let items = SAMPLE_GAMES.slice();
  if (limit) items = items.slice(0, Math.max(0, Number(limit)));
  // Return as plain array (the client accepts array or { items })
  return res.json(items);
});

app.get('/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.*)$/i);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  const user = TOKENS.get(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  return res.json(user);
});

// ---- Mock user generated content (UGC) for Profile ----
const SAMPLE_USER_POSTS = [
  {
    id: 'post-1',
    media_url: 'https://images.unsplash.com/photo-1521417531039-94f38f74b5c5?w=800',
    media_type: 'image',
    caption: 'Big win tonight! #GoTeam',
    upvotes_count: 23,
    comments_count: 5,
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    author: { id: 'dev-user-1', display_name: 'Dev User', avatar_url: null },
  },
  {
    id: 'post-2',
    media_url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800',
    media_type: 'image',
    caption: 'Pre-game hype in the locker room',
    upvotes_count: 12,
    comments_count: 2,
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    author: { id: 'dev-user-1', display_name: 'Dev User', avatar_url: null },
  },
  {
    id: 'post-3',
    media_url: '',
    media_type: 'image',
    caption: 'Text-only update: Practice moved to 6pm.',
    upvotes_count: 4,
    comments_count: 1,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    author: { id: 'dev-user-1', display_name: 'Dev User', avatar_url: null },
  },
];

// GET /users/:id/posts - returns a simple paged shape
app.get('/users/:id/posts', (req, res) => {
  const { id } = req.params;
  const { limit = 9, cursor, sort } = req.query;
  // For mock: ignore cursor/sort and slice by limit
  const all = SAMPLE_USER_POSTS.map((p, idx) => ({ ...p, id: `${p.id}-${id}-${idx}` }));
  const n = Math.max(1, Number(limit));
  const items = all.slice(0, n);
  const counts = {
    posts: all.length,
    likes: 42,
    comments: 17,
    reposts: 3,
    saves: 6,
  };
  return res.json({ items, nextCursor: null, counts });
});

// GET /users/:id/interactions - returns mixed interactions referencing posts
app.get('/users/:id/interactions', (req, res) => {
  const { id } = req.params;
  const { limit = 10, type, cursor, sort } = req.query;
  // Create interaction wrappers around posts
  const base = SAMPLE_USER_POSTS.map((p, idx) => ({ ...p, id: `${p.id}-${id}-${idx}` }));
  const interactions = base.map((post, idx) => ({
    id: `ia-${id}-${idx}`,
    type: ['like', 'comment', 'repost', 'save'][idx % 4],
    created_at: new Date(Date.now() - (idx + 1) * 1800 * 1000).toISOString(),
    post,
  }));
  // Optionally filter by type
  const filtered = typeof type === 'string' && type !== 'all' ? interactions.filter((it) => it.type === type) : interactions;
  const n = Math.max(1, Number(limit));
  const items = filtered.slice(0, n);
  const counts = {
    posts: base.length,
    likes: interactions.filter((i) => i.type === 'like').length,
    comments: interactions.filter((i) => i.type === 'comment').length,
    reposts: interactions.filter((i) => i.type === 'repost').length,
    saves: interactions.filter((i) => i.type === 'save').length,
  };
  return res.json({ items, nextCursor: null, counts });
});

// Post interactions
app.get('/posts/:id/comments', (req, res) => {
  const { id } = req.params;
  const comments = [
    { id: 'c1', content: 'Great post!', author: { display_name: 'Fan 1' }, created_at: new Date().toISOString() },
    { id: 'c2', content: 'Nice work!', author: { display_name: 'Fan 2' }, created_at: new Date().toISOString() },
  ];
  return res.json({ items: comments, nextCursor: null });
});

// Teams endpoint
app.get('/teams', (req, res) => {
  const sampleTeams = [
    {
      id: 'team-1',
      name: 'Springfield Tigers',
      sport: 'Basketball',
      school_name: 'Springfield High School',
      city: 'Springfield',
      organization_id: 'org-1',
    },
    {
      id: 'team-2',
      name: 'Lincoln Lions',
      sport: 'Football',
      school_name: 'Lincoln Prep',
      city: 'Lincoln',
      organization_id: 'org-1',
    },
    {
      id: 'team-3',
      name: 'Chelsea Warriors',
      sport: 'Soccer',
      school_name: 'Chelsea Piers Academy',
      city: 'New York',
      organization_id: 'org-3',
    },
  ];
  return res.json({ items: sampleTeams });
});

// Managed teams endpoint (teams the user manages/coaches)
app.get('/teams/managed', (req, res) => {
  const managedTeams = [
    {
      id: 'team-1',
      name: 'Springfield Tigers',
      sport: 'Basketball',
      season: 'Fall 2025',
      school_name: 'Springfield High School',
      city: 'Springfield',
      organization_id: 'org-1',
      role: 'coach',
      logo_url: null,
    },
  ];
  return res.json({ items: managedTeams });
});

// Events endpoint
app.get('/events', (req, res) => {
  const sampleEvents = [
    {
      id: 'event-1',
      title: 'Basketball Tournament Finals',
      description: 'Championship game!',
      date: new Date(Date.now() + 86400000).toISOString(),
      location: 'Springfield Arena',
    },
    {
      id: 'event-2',
      title: 'Soccer Practice',
      description: 'Weekly practice session',
      date: new Date(Date.now() + 172800000).toISOString(),
      location: 'Chelsea Piers Field',
    },
  ];
  return res.json({ items: sampleEvents });
});

// Users search endpoint
app.get('/users', (req, res) => {
  const { q, limit } = req.query;
  const sampleUsers = [
    {
      id: 'user-1',
      display_name: 'John Smith',
      username: 'jsmith',
      email: 'john@example.com',
    },
    {
      id: 'user-2',
      display_name: 'Jane Doe',
      username: 'jdoe',
      email: 'jane@example.com',
    },
  ];
  return res.json({ items: sampleUsers });
});

// Notifications endpoint
app.get('/notifications', (req, res) => {
  return res.json({ items: [], unread_count: 0 });
});

// Messages endpoint
app.get('/messages', (req, res) => {
  return res.json({ items: [], unread_count: 0 });
});

// Upload endpoint
app.post('/uploads', (req, res) => {
  // Mock file upload - return a fake URL
  return res.json({
    url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    path: '/uploads/mock-file.jpg',
    type: 'image/jpeg',
    mime: 'image/jpeg',
    size: 1024000
  });
});

// Create post endpoint
app.post('/posts', (req, res) => {
  console.log('[mock] POST /posts received:', req.body);
  const { content, media_url, event_id, lat, lng } = req.body || {};
  
  // IMPORTANT: In production, verify user is physically at the event location
  // This prevents out-of-state users from posting to events they're not attending
  // Check distance between user location (lat, lng) and event location
  // Reject if distance > threshold (e.g., 1 mile / 1.6 km)
  
  const newPost = {
    id: 'post-' + Date.now(),
    content: content || '',
    media_url: media_url || null,
    event_id: event_id || null,
    author_id: 'dev-user-1',
    author: {
      id: 'dev-user-1',
      display_name: 'Dev User',
      avatar_url: null,
    },
    upvotes_count: 0,
    created_at: new Date().toISOString(),
    _count: { comments: 0 }
  };
  console.log('[mock] Post created:', newPost.id);
  return res.json(newPost);
});

app.post('/posts/:id/comments', (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Missing content' });
  const comment = {
    id: 'c-' + Date.now(),
    content,
    author: { display_name: 'Dev User' },
    created_at: new Date().toISOString(),
  };
  return res.json(comment);
});

app.post('/posts/:id/upvote', (req, res) => {
  return res.json({ ok: true, upvoted: true });
});

app.post('/posts/:id/bookmark', (req, res) => {
  return res.json({ ok: true, bookmarked: true });
});

// ---- Mock Organizations and Team Join Requests ----
const SAMPLE_ORGANIZATIONS = [
  {
    id: 'org-1',
    name: 'Stamford High School',
    description: 'Home of the Black Knights',
    avatar_url: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400',
    cover_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
    bio: 'Official athletic organization for Stamford High School',
    contact_info: 'athletics@stamford.edu',
    teams: [
      { id: 'team-1', name: 'Stamford HS Varsity Football', sport: 'Football', logo_url: null },
      { id: 'team-2', name: 'Stamford HS JV Basketball', sport: 'Basketball', logo_url: null },
      { id: 'team-3', name: 'Stamford HS Girls Soccer', sport: 'Soccer', logo_url: null },
    ],
  },
  {
    id: 'org-2',
    name: 'Adidas Tournament Series',
    description: 'Elite youth basketball tournaments',
    avatar_url: 'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400',
    cover_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
    bio: 'Premier competitive basketball events',
    contact_info: 'info@adidastournament.com',
    teams: [
      { id: 'team-4', name: 'Elite AAU - 16U', sport: 'Basketball', logo_url: null },
      { id: 'team-5', name: 'Elite AAU - 18U', sport: 'Basketball', logo_url: null },
    ],
  },
  {
    id: 'org-3',
    name: 'Chelsea Piers',
    description: 'Sports & Entertainment Complex',
    avatar_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
    cover_url: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=800',
    bio: 'NYC premier sports facility and training center',
    contact_info: 'info@chelseapiers.com',
    teams: [
      { id: 'team-6', name: 'Chelsea Piers Youth Hockey', sport: 'Hockey', logo_url: null },
      { id: 'team-7', name: 'Chelsea Piers Gymnastics', sport: 'Gymnastics', logo_url: null },
    ],
  },
];

// In-memory storage for join requests
const TEAM_JOIN_REQUESTS = [];

// GET /organizations - List all organizations or search
app.get('/organizations', (req, res) => {
  const { q, limit = 50 } = req.query;
  let orgs = SAMPLE_ORGANIZATIONS;
  if (q) {
    const query = String(q).toLowerCase();
    orgs = orgs.filter(org => 
      org.name.toLowerCase().includes(query) || 
      org.description.toLowerCase().includes(query)
    );
  }
  const n = Math.max(1, Number(limit));
  return res.json(orgs.slice(0, n));
});

// GET /organizations/:id - Get single organization with teams
app.get('/organizations/:id', (req, res) => {
  const { id } = req.params;
  const org = SAMPLE_ORGANIZATIONS.find(o => o.id === id);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  return res.json(org);
});

// POST /organizations/:id/team-join-request - Coach requests to merge team into org
app.post('/organizations/:id/team-join-request', (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.*)$/i);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  const user = TOKENS.get(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  const { id: orgId } = req.params;
  const { team_id, team_name, message } = req.body || {};
  
  if (!team_id || !team_name) {
    return res.status(400).json({ error: 'Missing team_id or team_name' });
  }
  
  const org = SAMPLE_ORGANIZATIONS.find(o => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  
  const request = {
    id: 'req-' + Date.now(),
    organization_id: orgId,
    organization_name: org.name,
    team_id,
    team_name,
    message: message || '',
    requester_id: user.id,
    requester_name: user.display_name,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  
  TEAM_JOIN_REQUESTS.push(request);
  console.log(`[mock] Team join request created: ${team_name} → ${org.name}`);
  return res.json(request);
});

// GET /organizations/:id/team-join-requests - Get pending requests for org (admin only)
app.get('/organizations/:id/team-join-requests', (req, res) => {
  const { id: orgId } = req.params;
  const { status } = req.query;
  
  let requests = TEAM_JOIN_REQUESTS.filter(r => r.organization_id === orgId);
  if (status) {
    requests = requests.filter(r => r.status === status);
  }
  
  return res.json(requests);
});

// POST /team-join-requests/:id/approve - Approve a join request
app.post('/team-join-requests/:id/approve', (req, res) => {
  const { id: requestId } = req.params;
  const request = TEAM_JOIN_REQUESTS.find(r => r.id === requestId);
  
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Request already processed' });
  }
  
  request.status = 'approved';
  request.approved_at = new Date().toISOString();
  
  // In real implementation, this would update team.organization_id
  console.log(`[mock] Approved: ${request.team_name} → ${request.organization_name}`);
  return res.json(request);
});

// POST /team-join-requests/:id/reject - Reject a join request
app.post('/team-join-requests/:id/reject', (req, res) => {
  const { id: requestId } = req.params;
  const { reason } = req.body || {};
  const request = TEAM_JOIN_REQUESTS.find(r => r.id === requestId);
  
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Request already processed' });
  }
  
  request.status = 'rejected';
  request.rejected_at = new Date().toISOString();
  request.rejection_reason = reason || '';
  
  console.log(`[mock] Rejected: ${request.team_name} → ${request.organization_name}`);
  return res.json(request);
});

// GET /teams/managed/:id/join-requests - Get join requests for a specific team
app.get('/teams/:id/join-requests', (req, res) => {
  const { id: teamId } = req.params;
  const requests = TEAM_JOIN_REQUESTS.filter(r => r.team_id === teamId);
  return res.json(requests);
});

// Email verification endpoints
app.post('/auth/verify/request', (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.*)$/i);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  const user = TOKENS.get(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.log(`[mock] Verification code for ${user.email}: ${code}`);
  user.verification_code = code;
  return res.json({ ok: true, dev_verification_code: code });
});

app.post('/auth/verify/confirm', (req, res) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.*)$/i);
  if (!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  const user = TOKENS.get(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (code !== user.verification_code) return res.status(400).json({ error: 'Invalid code' });
  
  user.email_verified = true;
  delete user.verification_code;
  console.log(`[mock] Email verified for ${user.email}`);
  return res.json({ ok: true, user });
});

// Highlights/posts feed endpoint
app.get('/highlights', (req, res) => {
  const sampleHighlights = [
    {
      id: 'post-1',
      title: 'Amazing Basketball Dunk!',
      caption: 'What a play! #basketball',
      media_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
      upvotes_count: 124,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      author_id: 'user-1',
      author: {
        id: 'user-1',
        display_name: 'John Smith',
        avatar_url: null,
      },
      _count: { comments: 15 },
      country_code: 'US',
    },
    {
      id: 'post-2',
      title: 'Epic Football Touchdown',
      caption: 'Game winning play! #football',
      media_url: 'https://images.unsplash.com/photo-1577223625816-7546f32181e2?w=800',
      upvotes_count: 89,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      author_id: 'user-2',
      author: {
        id: 'user-2',
        display_name: 'Jane Doe',
        avatar_url: null,
      },
      _count: { comments: 8 },
      country_code: 'US',
    },
  ];

  return res.json({
    trending: sampleHighlights,
    recent: sampleHighlights,
    top: sampleHighlights,
  });
});

app.get('/api-docs', (req, res) => {
  res.send('<html><body><h1>Mock API Docs</h1><p>/auth/login /me</p></body></html>');
});

app.listen(PORT, () => {
  console.log(`Mock API listening on http://0.0.0.0:${PORT}`);
});
