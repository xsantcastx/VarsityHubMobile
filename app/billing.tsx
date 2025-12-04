import { httpPost } from '@/api/http';
// @ts-ignore
import { Subscriptions } from '@/api/entities';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function BillingScreen() {
  // Demo subtotal; replace with real cart subtotal
  const [subtotalCents] = useState(4999);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showQtyEditor, setShowQtyEditor] = useState(false);
  const [qty, setQty] = useState<string>('3');

  useEffect(() => {
    const load = async () => {
      setLoadingSummary(true);
      try {
        const s = await Subscriptions.getSummary();
        setSummary(s);
        if (s?.quantity) setQty(String(s.quantity));
      } catch {
        // ignore
      } finally {
        setLoadingSummary(false);
      }
    };
    load();
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
      Alert.alert('Updated', `Subscription updated to ${n} teams ($${(n * 2.5).toFixed(2)}/month).`);
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
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Billing' }} />
      {/* Veteran Plan Banner */}
      {summary?.plan === 'veteran' && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Veteran Plan</Text>
          <Text style={styles.bannerLine}>Paid teams: <Text style={styles.bold}>{summary.quantity ?? '—'}</Text></Text>
          <Text style={styles.bannerLine}>Monthly: <Text style={styles.bold}>${summary.monthly_cost?.toFixed?.(2) ?? ((summary.quantity || 0) * 2.5).toFixed(2)}</Text></Text>
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
                style={styles.qtyInput}
                placeholder="Teams"
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
      <Text style={styles.title}>Billing</Text>
      <Text style={styles.subtitle}>Demo subtotal: ${ (subtotalCents/100).toFixed(2) }</Text>

      <View style={styles.applyRow}>
        <TextInput
          placeholder="Promo code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          style={styles.input}
        />
        <Pressable style={[styles.btn, busy ? styles.btnDisabled : null]} onPress={onApply} disabled={busy}>
          <Text style={styles.btnText}>{busy ? '...' : 'Apply'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>Promo not valid: {error}</Text> : null}
      {preview?.valid ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewLine}>Code: {preview.code}</Text>
          {preview.percent_off ? <Text style={styles.previewLine}>{preview.percent_off}% off</Text> : <Text style={styles.previewLine}>Complimentary</Text>}
          <Text style={styles.previewLine}>Discount: ${ (preview.discount_cents/100).toFixed(2) }</Text>
          <Text style={styles.previewLine}>New total: ${ (preview.new_total_cents/100).toFixed(2) }</Text>
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
  subtitle: { color: '#6b7280', marginBottom: 12 },
  applyRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, height: 44 },
  btn: { backgroundColor: '#111827', paddingHorizontal: 16, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  error: { color: '#b91c1c', marginTop: 6 },
  previewBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', gap: 6 },
  previewLine: { color: '#111827' },
  btnPrimary: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: 'white', fontWeight: '800' },
  banner: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', backgroundColor: '#F0FDF4' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#065F46' },
  bannerLine: { marginTop: 4, color: '#065F46' },
  bannerHint: { marginTop: 6, color: '#047857', fontSize: 12 },
  bold: { fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyInput: { width: 80, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, height: 44 },
});

