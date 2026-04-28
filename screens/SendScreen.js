import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import { useUserData } from '../context/UserDataContext';

const QUICK_PILLS = [20, 50, 100, 200, 500];

function detectNetwork(phone) {
  const p = phone.replace(/\D/g, '');
  if (p.length < 3) return null;
  const prefix = p.slice(0, 3);
  if (['024', '054', '055', '059'].includes(prefix)) return 'MTN';
  if (['020', '050'].includes(prefix))               return 'Vodafone';
  if (['027', '057', '026', '056'].includes(prefix)) return 'AirtelTigo';
  return null;
}

function useSlideIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 55, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

export default function SendScreen({ navigation }) {
  const insets         = useSafeAreaInsets();
  const { profile }    = useUserData();
  const balance        = profile?.balance ?? 0;

  const [recipient,    setRecipient]    = useState('');
  const [amount,       setAmount]       = useState('');
  const [selectedPill, setSelectedPill] = useState(null);

  const recipientAnim = useSlideIn(0);
  const cardAnim      = useSlideIn(100);
  const sourceAnim    = useSlideIn(200);
  const summaryAnim   = useSlideIn(300);

  const network       = detectNetwork(recipient);
  const digits        = recipient.replace(/\D/g, '');
  const recipientReady = digits.length >= 10;

  const handleAmountChange = (t) => {
    const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(clean);
    setSelectedPill(null);
  };

  const handlePill = (val) => {
    setAmount(String(val));
    setSelectedPill(val);
  };

  const parsedAmount   = parseFloat(amount || '0');
  const displayAmount  = amount ? `¢${parsedAmount.toFixed(2)}` : '¢0.00';
  const canProceed     = parsedAmount > 0 && recipientReady;
  const insufficient   = parsedAmount > balance;

  const handleProceed = () => {
    if (!canProceed || insufficient) return;
    navigation.navigate('Pin', {
      amount:    parsedAmount,
      method:    `Send to ${recipient}`,
      type:      'send',
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#111110" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Money</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Recipient ────────────────────────────────────────────── */}
          <Animated.View style={[styles.recipientCard, recipientAnim]}>
            <Text style={styles.recipientLabel}>TO</Text>
            <View style={styles.recipientRow}>
              <TextInput
                style={styles.recipientInput}
                placeholder="Enter mobile number"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={recipient}
                onChangeText={setRecipient}
                keyboardType="phone-pad"
                selectionColor="#e63946"
              />
              <View style={styles.recipientIcon}>
                <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </View>

            {/* Network auto-detect badge */}
            {recipientReady && (
              <View style={styles.networkBadge}>
                <View style={[styles.networkDot, { backgroundColor: network ? '#e63946' : '#9ca3af' }]} />
                <Text style={styles.networkBadgeText}>
                  {network ? `${network} · Verified` : 'Network not detected'}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ── Amount Card ───────────────────────────────────────────── */}
          <Animated.View style={[styles.amountCard, cardAnim]}>
            <Text style={styles.amountLabel}>AMOUNT</Text>

            <View style={styles.amountInputRow}>
              <Text style={styles.amountCurrency}>¢</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.25)"
                selectionColor="#e63946"
              />
            </View>

            {insufficient && parsedAmount > 0 && (
              <Text style={styles.insufficientText}>
                Insufficient balance (¢{balance.toFixed(2)} available)
              </Text>
            )}

            <View style={styles.pillRow}>
              {QUICK_PILLS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pill, selectedPill === p && styles.pillActive]}
                  onPress={() => handlePill(p)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.pillText, selectedPill === p && styles.pillTextActive]}>¢{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* ── From Source ──────────────────────────────────────────── */}
          <Animated.View style={sourceAnim}>
            <Text style={styles.sectionTitle}>From</Text>
            <View style={styles.sourceTile}>
              <View style={styles.sourceLeft}>
                <View style={styles.sourceIconWrap}>
                  <Ionicons name="wallet-outline" size={22} color="#e63946" />
                </View>
                <View>
                  <Text style={styles.sourceName}>Architect Wallet</Text>
                  <Text style={styles.sourceBal}>¢{balance.toFixed(2)} available</Text>
                </View>
              </View>
              <View style={styles.checkCircleActive}>
                <Ionicons name="checkmark" size={11} color="#ffffff" />
              </View>
            </View>
          </Animated.View>

          {/* ── Summary ──────────────────────────────────────────────── */}
          <Animated.View style={[styles.summaryRow, summaryAnim]}>
            <View>
              <Text style={styles.summaryLabel}>You're sending</Text>
              <Text style={[styles.summaryAmount, insufficient && { color: '#e63946' }]}>
                {displayAmount}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryVia}>to</Text>
              <Text style={styles.summaryMethod} numberOfLines={1}>
                {recipientReady ? recipient : '—'}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={summaryAnim}>
            <AnimatedButton
              label="Proceed"
              style={[styles.proceedBtn, (!canProceed || insufficient) && styles.proceedBtnDisabled]}
              textStyle={styles.proceedText}
              onPress={handleProceed}
              disabled={!canProceed || insufficient}
            />
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f0ede6' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#111110', fontSize: 17, fontWeight: '700' },
  content:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },

  // Recipient card
  recipientCard:    { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, marginBottom: 12 },
  recipientLabel:   { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  recipientRow:     { flexDirection: 'row', alignItems: 'center' },
  recipientInput:   { flex: 1, color: '#ffffff', fontSize: 22, fontWeight: '600', padding: 0, includeFontPadding: false },
  recipientIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  networkBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  networkDot:       { width: 7, height: 7, borderRadius: 4 },
  networkBadgeText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },

  // Amount card
  amountCard:       { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, marginBottom: 16 },
  amountLabel:      { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  amountInputRow:   { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  amountCurrency:   { color: '#ffffff', fontSize: 34, fontWeight: '800', marginRight: 4 },
  amountInput:      { color: '#ffffff', fontSize: 48, fontWeight: '800', letterSpacing: -1, padding: 0, minWidth: 80, includeFontPadding: false },
  insufficientText: { color: '#f87171', fontSize: 12, fontWeight: '500', marginBottom: 12 },
  pillRow:          { flexDirection: 'row', gap: 7, marginTop: 12 },
  pill:             { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillActive:       { backgroundColor: '#e63946', borderColor: '#e63946' },
  pillText:         { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  pillTextActive:   { color: '#ffffff' },

  // From source
  sectionTitle:     { color: '#111110', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sourceTile:       { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderWidth: 2, borderColor: '#e63946' },
  sourceLeft:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sourceIconWrap:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fce9e6', alignItems: 'center', justifyContent: 'center' },
  sourceName:       { color: '#111110', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sourceBal:        { color: '#9ca3af', fontSize: 12 },
  checkCircleActive:{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },

  // Summary
  summaryRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12 },
  summaryLabel:  { color: '#9ca3af', fontSize: 12, marginBottom: 3 },
  summaryAmount: { color: '#111110', fontSize: 22, fontWeight: '800' },
  summaryRight:  { alignItems: 'flex-end', maxWidth: '45%' },
  summaryVia:    { color: '#9ca3af', fontSize: 12, marginBottom: 3 },
  summaryMethod: { color: '#111110', fontSize: 13, fontWeight: '600' },

  // Proceed
  proceedBtn:         { backgroundColor: '#111110', borderRadius: 50, height: 56, alignItems: 'center', justifyContent: 'center' },
  proceedBtnDisabled: { backgroundColor: '#d1d5db' },
  proceedText:        { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
