import { Colors } from '@/constants/Colors';
import { PUBLIC_PRIVACY_POLICY_URL } from '@/constants/legal';
import { Plan, PLAN_DEFINITIONS, ROOKIE_TEAM_LIMIT } from '@/constants/plans';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  colorScheme: 'light' | 'dark';
  plan: Plan;
  storePrice?: string | null;
  compact?: boolean;
};

const SERVICE_TITLE = 'VarsityHub League Subscription';

export function SubscriptionDisclosureCard({
  colorScheme,
  plan,
  storePrice,
  compact = false,
}: Props) {
  const theme = Colors[colorScheme];
  const planDefinition = PLAN_DEFINITIONS[plan];
  const length = getPlanLength(plan);
  const price = getPlanPrice(plan, storePrice);
  const includes = getPlanIncludes(plan);

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.eyebrow, { color: theme.mutedText }]}>In-App Purchase Details</Text>
      <Text style={[styles.serviceTitle, { color: theme.text }]}>{SERVICE_TITLE}</Text>
      <Text style={[styles.planTitle, { color: theme.text }]}>{planDefinition.name}</Text>

      <View style={styles.detailList}>
        <Text style={[styles.detailLine, { color: theme.mutedText }]}>
          Length: <Text style={[styles.detailValue, { color: theme.text }]}>{length}</Text>
        </Text>
        <Text style={[styles.detailLine, { color: theme.mutedText }]}>
          Price: <Text style={[styles.detailValue, { color: theme.text }]}>{price}</Text>
        </Text>
        <Text style={[styles.detailLine, { color: theme.mutedText }]}>
          Includes: <Text style={[styles.detailValue, { color: theme.text }]}>{includes}</Text>
        </Text>
      </View>

      <Text style={[styles.renewalText, { color: theme.mutedText }]}>
        {plan === 'rookie'
          ? 'No payment method is required for Rookie.'
          : `Auto-renewable subscription. Payment is charged to your ${
              Platform.OS === 'ios'
                ? 'Apple ID'
                : Platform.OS === 'android'
                  ? 'Google Play'
                  : 'selected payment method'
            } and renews automatically unless canceled at least 24 hours before the current period ends.`}
      </Text>

      <View style={styles.linksRow}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open Privacy Policy"
          onPress={() =>
            void openExternalUrl(PUBLIC_PRIVACY_POLICY_URL, {
              context: 'subscription_disclosure_privacy_link',
            })
          }
        >
          <Text style={[styles.linkText, { color: theme.tint }]}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getPlanLength(plan: Plan): string {
  switch (plan) {
    case 'veteran':
      return '1 month';
    case 'legend':
      return '1 year';
    case 'rookie':
    default:
      return 'Free plan with no renewal term';
  }
}

function getPlanPrice(plan: Plan, storePrice?: string | null): string {
  switch (plan) {
    case 'veteran':
      return `${storePrice || PLAN_DEFINITIONS.veteran.price} per month per team over ${ROOKIE_TEAM_LIMIT} teams`;
    case 'legend':
      return `${storePrice || PLAN_DEFINITIONS.legend.price} per year`;
    case 'rookie':
    default:
      return 'Free';
  }
}

function getPlanIncludes(plan: Plan): string {
  switch (plan) {
    case 'veteran':
      return `Unlimited teams, up to 5 staff per team, up to ${PLAN_DEFINITIONS.veteran.max_roster_size_per_team} athletes per team, and coach coverage for growing leagues.`;
    case 'legend':
      return 'Unlimited teams and coaches, extracurricular clubs, and the full VarsityHub league feature set.';
    case 'rookie':
    default:
      return `Up to ${ROOKIE_TEAM_LIMIT} teams with core VarsityHub league tools.`;
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardCompact: {
    padding: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  detailList: {
    gap: 8,
  },
  detailLine: {
    fontSize: 15,
    lineHeight: 23,
  },
  detailValue: {
    fontWeight: '600',
  },
  renewalText: {
    fontSize: 14,
    lineHeight: 21,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
