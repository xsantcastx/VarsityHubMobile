/**
 * Coach Tier Badge Component
 * 
 * Displays tier-specific badges for coaches based on subscription level
 * Rookie, Veteran, Legend tiers with visual distinctions
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type CoachTier = 'rookie' | 'veteran' | 'legend';

interface CoachTierBadgeProps {
  tier: CoachTier;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

/**
 * Visual badge component for coach subscription tiers
 */
export function CoachTierBadge({ tier, size = 'medium', showLabel = true }: CoachTierBadgeProps) {
  const config = getTierConfig(tier);
  const sizeStyles = getSizeStyles(size);

  return (
    <View style={[styles.container, sizeStyles.container]}>
      <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
        <Ionicons name={config.icon} size={sizeStyles.iconSize} color={config.iconColor} />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: config.textColor }, sizeStyles.text]}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

/**
 * Tier configuration with colors and icons
 */
function getTierConfig(tier: CoachTier) {
  switch (tier) {
    case 'legend':
      return {
        label: 'Legend',
        icon: 'trophy' as const,
        backgroundColor: '#FCD34D', // Gold
        iconColor: '#92400E', // Dark gold
        textColor: '#92400E',
      };
    case 'veteran':
      return {
        label: 'Veteran',
        icon: 'shield-checkmark' as const,
        backgroundColor: '#2563EB', // Blue
        iconColor: '#FFFFFF',
        textColor: '#1E40AF',
      };
    case 'rookie':
    default:
      return {
        label: 'Rookie',
        icon: 'medal' as const,
        backgroundColor: '#9CA3AF', // Gray
        iconColor: '#FFFFFF',
        textColor: '#4B5563',
      };
  }
}

/**
 * Size-based styling
 */
function getSizeStyles(size: 'small' | 'medium' | 'large') {
  switch (size) {
    case 'large':
      return {
        container: { gap: 8 },
        iconSize: 28,
        text: { fontSize: 16, fontWeight: '700' as const },
      };
    case 'small':
      return {
        container: { gap: 4 },
        iconSize: 14,
        text: { fontSize: 11, fontWeight: '600' as const },
      };
    case 'medium':
    default:
      return {
        container: { gap: 6 },
        iconSize: 18,
        text: { fontSize: 13, fontWeight: '600' as const },
      };
  }
}

/**
 * Inline badge (icon only, smaller)
 */
export function CoachTierBadgeInline({ tier }: { tier: CoachTier }) {
  const config = getTierConfig(tier);

  return (
    <View
      style={[
        styles.inlineBadge,
        {
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <Ionicons name={config.icon} size={12} color={config.iconColor} />
    </View>
  );
}

/**
 * Tier benefits description component
 */
interface TierBenefitsProps {
  tier: CoachTier;
  compact?: boolean;
}

export function CoachTierBenefits({ tier, compact = false }: TierBenefitsProps) {
  const benefits = getTierBenefits(tier);
  const config = getTierConfig(tier);

  return (
    <View style={styles.benefitsContainer}>
      <View style={styles.benefitsHeader}>
        <CoachTierBadge tier={tier} size="medium" showLabel={true} />
        {!compact && (
          <Text style={styles.benefitsPrice}>{benefits.price}</Text>
        )}
      </View>
      
      {!compact && (
        <Text style={styles.benefitsDescription}>{benefits.description}</Text>
      )}
      
      <View style={styles.benefitsList}>
        {benefits.features.map((feature, index) => (
          <View key={index} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={config.backgroundColor} />
            <Text style={styles.benefitText}>{feature}</Text>
          </View>
        ))}
      </View>
      
      {benefits.limitations && (
        <Text style={styles.limitation}>{benefits.limitations}</Text>
      )}
    </View>
  );
}

/**
 * Tier benefits data
 */
function getTierBenefits(tier: CoachTier) {
  switch (tier) {
    case 'legend':
      return {
        price: '$29.99/year',
        description: 'For established programs managing multiple teams',
        features: [
          'Unlimited teams',
          'Priority support (24hr response)',
          'Dedicated admin per team',
          'Gold trophy badge on profile',
          'Advanced analytics',
          'Custom branding options',
          'Team import/export tools',
        ],
        limitations: null,
      };
    case 'veteran':
      return {
        price: '$1.50/month per team',
        description: 'Grow your program with additional teams',
        features: [
          'Add teams as needed',
          'Standard support',
          'Dedicated admin per team',
          'Blue shield badge on profile',
          'Event scheduling tools',
          'Parent communication',
        ],
        limitations: 'Teams charged individually',
      };
    case 'rookie':
    default:
      return {
        price: 'Free',
        description: 'Perfect for getting started',
        features: [
          'Up to 2 teams',
          'Basic scheduling',
          'Roster management',
          'Event creation',
          'Photo/video sharing',
          'Community support',
        ],
        limitations: 'Limited to 2 teams maximum',
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    borderRadius: 20,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
  inlineBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitsContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benefitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitsPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  benefitsDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  benefitsList: {
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  limitation: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
