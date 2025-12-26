# Organization Feature

Centralized feature module for organization/league management and display within VarsityHub.

## Structure

```
organization/
├── README.md                    # This file
└── (Future: screens/, hooks/, services/)
```

## Data Sources

- **Teams**: Fetched via `Team.list()` filtered by `organization_id`
- **Games**: Aggregated from team schedules in the organization
- **Posts**: Activity feed posts tagged to teams in the organization
- **User Org Role**: Determined via `User.me()` preferences for privilege-gated UI

## Routes

- **Primary Route**: `/organization?id=<orgId>` (app/organization.tsx)
  - Displays org teams, schedule, and activity feed
  - Supports swipe-to-back gesture on iOS
  - Tab navigation: Teams → Schedule → Feed

- **Secondary Route**: `/organization-join-requests` (app/organization-join-requests.tsx)
  - Lists pending org join requests (for admins)

## Key Components

- **OrganizationScreen** (`app/organization.tsx`)
  - Renders hero with org metadata
  - Tab-based navigation (teams, schedule, feed)
  - Uses `RefreshControl` for pull-to-refresh
  - Integrated swipe-back gesture handler

- **Error Boundaries**: Generic error UI with retry on load failures
- **Empty States**: Uses shared `EmptyState` component for consistent no-data messaging

## TODOs / Future Work

- [x] Extract screens into `src/features/organization/screens/`
- [ ] Create dedicated hooks for org data fetching (`useOrganization`, `useOrgTeams`)
- [ ] Add services layer for org API calls
- [ ] Implement org settings/editing for admins
- [ ] Add org invite management workflows
- [ ] Performance: Memoize team/game lists to prevent re-renders
- [ ] A/B test org card layouts and feed sorting

## Dependencies

- `@/api/entities` - Organization, Team, Game, Post, User
- `@/components/ui` - SharedUI components (Card, EmptyState, etc.)
- `@/constants/Colors` - Theme and design tokens
- `expo-router` - Navigation
- `react-native-reanimated` - Gesture animations
- `react-native-gesture-handler` - Swipe gestures
