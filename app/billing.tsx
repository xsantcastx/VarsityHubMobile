import { httpPost } from '@/api/http';
// @ts-ignore
import { Subscriptions } from '@/api/entities';
import { PLAN_DEFINITIONS, Plan, formatPlanPrice } from '@/constants/plans';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function BillingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  // Demo subtotal; replace with real cart subtotal
  const [subtotalCents] = useState(4999);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [_loadingSummary, setLoadingSummary] = useState(false);
  const [showQtyEditor, setShowQtyEditor] = useState(false);
  const [qty, setQty] = useState<string>('3');
  const currentPlan = ((summary?.plan as Plan) ?? 'rookie') as Plan;
  const planDefinition = PLAN_DEFINITIONS[currentPlan];
  const planFeatures = planDefinition?.features ?? [];
  const planPriceLabel = formatPlanPrice(currentPlan);
  const planBillingCopy = planDefinition?.billing;
  const isRookie = currentPlan === 'rookie';

  useEffect(() => {
    const load = async () => {
      setLoadingSummary(true);
      try {
        const s = await Subscriptions.getSummary();
        setSummary(s);
        if (typeof s?.quantity === 'number') setQty(String(s.quantity + 2)); // include 2 free Rookie teams
      } catch {
        // ignore
      } finally {
        setLoadingSummary(false);
      }
    };
    void load();
  }, []);

  const onUpdateQuantity = async () => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 3) {
      Alert.alert('Invalid quantity', 'Please enter 3 or higher.');
      return;
    }
    try {
      setBusy(true);
      await Subscriptions.updateQuantity(n);
      const s = await Subscriptions.getSummary();
      setSummary(s);
      setShowQtyEditor(false);
      const billable = Math.max(0, n - 2);
      Alert.alert('Updated', `Subscription updated to ${n} total teams (${billable} billed at $1.50 each = $${(billable * 1.5).toFixed(2)}/month).`);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Unable to update quantity.');
    } finally {
      setBusy(false);
    }
  };

  async function onApply() {
    if (!code.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await httpPost('/promos/preview', { code, subtotal_cents: subtotalCents, service: 'membership' });
      if (!res?.valid) { setPreview(null); setError(res?.reason || 'invalid'); }
      else setPreview(res);
    } catch (e: any) {
      setPreview(null);
      setError(e?.message || 'Failed to apply promo');
    } finally { setBusy(false); }
  }

  async function onRedeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      // For demo, fake an order id; replace with real checkout id
      const orderId = 'order_' + Math.random().toString(36).slice(2);
      const res = await httpPost('/promos/redeem', { code, subtotal_cents: subtotalCents, service: 'membership', order_id: orderId });
      if (!res?.ok) {
        Alert.alert('Promo', res?.error || 'Unable to redeem');
        return;
      }
      Alert.alert('Promo applied', `Discount: $${(res.discount_cents/100).toFixed(2)}\nNew total: $${(res.new_total_cents/100).toFixed(2)}`);
    } catch (e: any) {
      Alert.alert('Promo', e?.message || 'Unable to redeem');
    } finally { setBusy(false); }
  }

  const getPlanDescription = (plan: string) => {
    switch (plan) {
      case 'veteran':
        return 'First 2 teams free, then $1.50/month per additional team. Up to 2 authorized users per team.';
      case 'legend':
        return 'Unlimited teams at $20/year. Create extracurricular clubs (Theater, Chess, etc.). Unlimited authorized users.';
      default:
        return 'Free plan with 2 teams. 1 authorized user per team.';
    }
  };

  // ── iOS: Simple free-plan screen with no pricing ────────────────────
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{
          title: 'Billing',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <MaterialIcons name="chevron-left" size={24} color="#3B82F6" />
            </Pressable>
          ),
        }} />
        <Text style={[styles.title, { color: theme.text }]}>Your Plan</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Your free plan includes up to 2 teams with no charges.
        </Text>
        <View style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={styles.planBadge}>Free plan</Text>
          <Text style={[styles.planPrice, { color: theme.text }]}>Free</Text>
          <View style={styles.featureList}>
            {['Up to 2 teams', 'Roster management', 'Game scheduling', 'Team feed & posts'].map((feature) => (
              <View style={styles.featureItem} key={feature}>
                <MaterialIcons name="check-circle" size={16} color="#16A34A" />
                <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Android / Web: Full billing screen ─────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{
        title: 'Billing',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingLeft: 8 }}>
            <MaterialIcons name="chevron-left" size={24} color="#3B82F6" />
          </Pressable>
        ),
      }} />
      {/* Veteran Plan Banner */}
      {summary?.plan === 'veteran' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Veteran Plan</Text>
          <Text style={styles.bannerDescription}>{getPlanDescription('veteran')}</Text>
          <Text style={styles.bannerLine}>Billable teams beyond 2 free: <Text style={styles.bold}>{summary.quantity ?? '—'}</Text></Text>
          <Text style={styles.bannerLine}>Monthly: <Text style={styles.bold}>${summary.monthly_cost?.toFixed?.(2) ?? ((summary.quantity || 0) * 1.5).toFixed(2)}</Text></Text>
          {!!summary.current_period_end && (
            <Text style={styles.bannerHint}>Renews: {new Date(summary.current_period_end).toLocaleDateString()}</Text>
          )}
          {!showQtyEditor ? (
            <Pressable style={styles.btnPrimary} onPress={() => setShowQtyEditor(true)}>
              <Text style={styles.btnPrimaryText}>Update Quantity</Text>
            </Pressable>
          ) : (
            <View style={styles.qtyRow}>
              <TextInput
                keyboardType="number-pad"
                value={qty}
                onChangeText={setQty}
                style={[styles.qtyInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                placeholder="Teams"
                placeholderTextColor={theme.mutedText}
              />
              <Pressable style={styles.btnPrimary} onPress={onUpdateQuantity} disabled={busy}>
                <Text style={styles.btnPrimaryText}>{busy ? '...' : 'Update'}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setShowQtyEditor(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      {/* Legend Plan Banner */}
      {summary?.plan === 'legend' && (
        <View style={[styles.banner, styles.bannerLegend]}>
          <Text style={[styles.bannerTitle, styles.bannerTitleLegend]}>Legend Plan</Text>
          <Text style={styles.bannerDescription}>{getPlanDescription('legend')}</Text>
          <Text style={styles.bannerLine}>Annual: <Text style={styles.bold}>$20/year</Text></Text>
          {!!summary.current_period_end && (
            <Text style={styles.bannerHint}>Renews: {new Date(summary.current_period_end).toLocaleDateString()}</Text>
          )}
        </View>
      )}
      <Text style={[styles.title, { color: theme.text }]}>Billing & Plan</Text>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>
        {isRookie
          ? 'Rookie stays free for your first two teams—no trial clocks, no surprise charges. Upgrade only when you need more capacity.'
          : `Your ${planDefinition.name} plan renews automatically. Keep your roster up to date and adjust quantity whenever team counts change.`}
      </Text>

      <View style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={styles.planBadge}>{planDefinition.name} plan</Text>
        <Text style={[styles.planPrice, { color: theme.text }]}>{planPriceLabel}</Text>
        {planBillingCopy?.description ? (
          <Text style={[styles.planDescription, { color: theme.mutedText }]}>{planBillingCopy.description}</Text>
        ) : null}
        <View style={styles.featureList}>
          {planFeatures.map((feature) => (
            <View style={styles.featureItem} key={feature}>
              <MaterialIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
        {planBillingCopy?.cta ? (
          <Text style={[styles.planDescriptionMuted, { color: theme.mutedText }]}>{planBillingCopy.cta}</Text>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Promo code</Text>
      <View style={styles.applyRow}>
        <TextInput
          placeholder="Promo code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
          placeholderTextColor={theme.mutedText}
        />
        <Pressable style={[styles.btn, busy ? styles.btnDisabled : null]} onPress={onApply} disabled={busy}>
          <Text style={styles.btnText}>{busy ? '...' : 'Apply'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>Promo not valid: {error}</Text> : null}
      {preview?.valid ? (
        <View style={[styles.previewBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.previewLine, { color: theme.text }]}>Code: {preview.code}</Text>
          {preview.percent_off ? <Text style={[styles.previewLine, { color: theme.text }]}>{preview.percent_off}% off</Text> : <Text style={[styles.previewLine, { color: theme.text }]}>Complimentary</Text>}
          <Text style={[styles.previewLine, { color: theme.text }]}>Discount: ${ (preview.discount_cents/100).toFixed(2) }</Text>
          <Text style={[styles.previewLine, { color: theme.text }]}>New total: ${ (preview.new_total_cents/100).toFixed(2) }</Text>
          <Pressable style={styles.btnPrimary} onPress={onRedeem}>
            <Text style={styles.btnPrimaryText}>Redeem & Pay</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  planCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  planBadge: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: '#2563EB', marginBottom: 6 },
  planPrice: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  planDescription: { marginBottom: 12, lineHeight: 20 },
  planDescriptionMuted: { color: '#6B7280', fontSize: 13 },
  featureList: { gap: 8, marginBottom: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  applyRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, height: 44 },
  btn: { backgroundColor: '#111827', paddingHorizontal: 16, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  error: { color: '#b91c1c', marginTop: 6 },
  previewBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', gap: 6 },
  previewLine: {},
  btnPrimary: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: 'white', fontWeight: '800' },
  banner: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', backgroundColor: '#F5F5F5' },
  bannerLegend: { backgroundColor: '#FFFBEB' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#6B6B6B' },
  bannerTitleLegend: { color: '#92600A' },
  bannerDescription: { fontSize: 13, marginTop: 4, marginBottom: 8, color: '#6B6B6B', lineHeight: 18 },
  bannerLine: { marginTop: 4, color: '#6B6B6B' },
  bannerHint: { marginTop: 6, color: '#047857', fontSize: 12 },
  bold: { fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyInput: { width: 80, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, height: 44 },
});
