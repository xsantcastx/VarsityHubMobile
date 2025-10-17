/**
 * Reusable UI Components - Export Index
 * 
 * Phase 1 Foundation Components:
 * - Card: Base card component with variants
 * - SectionHeader: Consistent section headers
 * - EmptyState: Empty state displays
 * - GameCard: Game display cards
 * - SettingItem: Settings menu items
 * - TeamCard: Team display cards
 * - StatCard: Statistics display
 * - LoadingState: Loading indicators
 * 
 * Usage:
 * import { Card, GameCard, EmptyState } from '@/components/ui';
 */

// Base Components
export { Card, CardContent, CardFooter, CardHeader } from './card';
export type { CardProps } from './card';

// Layout Components
export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';

// State Components
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { LoadingState } from './LoadingState';
export type { LoadingStateProps } from './LoadingState';

// Domain Components
export { GameCard } from './GameCard';
export type { Game, GameCardProps } from './GameCard';

export { TeamCard } from './TeamCard';
export type { Team, TeamCardProps } from './TeamCard';

export { StatCard } from './StatCard';
export type { StatCardProps } from './StatCard';

// Interactive Components
export { SettingItem } from './SettingItem';
export type { SettingItemProps } from './SettingItem';

export { Button } from './button';
export type { ButtonProps } from './button';

