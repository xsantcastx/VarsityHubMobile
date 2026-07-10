/**
 * Coach Tier Badge Component
 *
 * Displays tier-specific badges for coaches based on subscription level
 * Rookie, Veteran, Legend tiers with visual distinctions
 */

import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { LEGEND_YEARLY_PRICE_LABEL, PLAN_DEFINITIONS, ROOKIE_TEAM_LIMIT } from '@/constants/plans';

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
  const colorScheme = useColorScheme() ?? 'light';
  const config = getTierConfig(tier, colorScheme);
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
function getTierConfig(tier: CoachTier, colorScheme: keyof typeof Colors) {
  switch (tier) {
    case 'legend':
      return {
        label: 'Legend',
        icon: 'trophy' as const,
        backgroundColor: '#FCD34D', // Gold
        iconColor: Colors.light.text,
        textColor: Colors.light.text,
      };
    case 'veteran':
      return {
        label: 'Veteran',
        icon: 'shield-checkmark' as const,
        backgroundColor: '#C0C0C0', // Silver
        iconColor: Colors[colorScheme].text,
        textColor: Colors[colorScheme].text,
      };
    case 'rookie':
    default:
      return {
        label: 'Rookie',
        icon: 'medal' as const,
        backgroundColor: '#CD7F32', // Bronze
        iconColor: Colors.dark.text,
        textColor: Colors.light.text,
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
 * Tier benefits description component
 */
interface TierBenefitsProps {
  tier: CoachTier;
  compact?: boolean;
}

export function CoachTierBenefits({ tier, compact = false }: TierBenefitsProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const benefits = getTierBenefits(tier);
  const config = getTierConfig(tier, colorScheme);

  return (
    <View style={styles.benefitsContainer}>
      <View style={styles.benefitsHeader}>
        <CoachTierBadge tier={tier} size="medium" showLabel={true} />
        {!compact && (
          <Text style={[styles.benefitsPrice, { color: theme.text }]}>{benefits.price}</Text>
        )}
      </View>

      {!compact && (
        <Text style={[styles.benefitsDescription, { color: theme.mutedText }]}>
          {benefits.description}
        </Text>
      )}

      <View style={styles.benefitsList}>
        {benefits.features.map((feature, index) => (
          <View key={index} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={config.backgroundColor} />
            <Text style={[styles.benefitText, { color: theme.text }]}>{feature}</Text>
          </View>
        ))}
      </View>

      {benefits.limitations && <Text style={styles.limitation}>{benefits.limitations}</Text>}
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
        price: LEGEND_YEARLY_PRICE_LABEL,
        description: 'Best value for established multi-team programs',
        features: [
          'Unlimited teams',
          'Priority support (24hr response)',
          'Unlimited administrators',
          'Gold trophy badge on profile',
          'Advanced analytics dashboard',
          'Custom branding options',
          'Team import/export tools',
        ],
        limitations: null,
      };
    case 'veteran': {
      // Veteran is metered per sport program on the web/Stripe rail only —
      // Apple IAP (iOS) / Google Play Billing (Android) sell it as a flat,
      // unlimited-sports subscription with no per-unit price. Display-copy
      // branch only; does not affect which checkout rail runs.
      const isIapRail = Platform.OS === 'ios' || Platform.OS === 'android';
      if (isIapRail) {
        return {
          price: 'Veteran — unlimited sports',
          description: 'One flat subscription, unlimited sport programs',
          features: [
            'Unlimited sport programs',
            'Standard support',
            'Per-team administrators',
            'Silver shield badge on profile',
            'Event scheduling tools',
            'Parent communication',
          ],
          limitations: null,
        };
      }
      return {
        price: `${PLAN_DEFINITIONS.veteran.price}/month per sport over ${ROOKIE_TEAM_LIMIT}`,
        description: 'Flexible pay-per-sport pricing as you grow',
        features: [
          `Add sports beyond the first ${ROOKIE_TEAM_LIMIT} free`,
          'Standard support',
          'Per-team administrators',
          'Silver shield badge on profile',
          'Event scheduling tools',
          'Parent communication',
        ],
        limitations: `Each sport beyond ${ROOKIE_TEAM_LIMIT} incurs a monthly charge`,
      };
    }
    case 'rookie':
    default:
      return {
        price: 'Free',
        description: 'Perfect for getting started',
        features: [
          `First ${ROOKIE_TEAM_LIMIT} teams free`,
          'Ex: Mens and Womens soccer',
          'Basic scheduling',
          'Roster management',
          'Event creation',
          'Photo/video sharing',
          'Community support',
        ],
        limitations: `Limited to ${ROOKIE_TEAM_LIMIT} teams maximum`,
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
  benefitsContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
  },
  benefitsDescription: {
    fontSize: 14,
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
    flex: 1,
    lineHeight: 20,
    fontWeight: '700',
  },
  limitation: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
