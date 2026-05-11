import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';

const QUICK_PILLS = [20, 50, 100, 200, 500];
const NETWORKS    = ['MTN', 'Vodafone', 'AirtelTigo'];
const CARD_TYPES  = ['VISA', 'MC', 'Verve'];

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

export default function AddFundsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [amount,       setAmount]       = useState('');
  const [selectedPill, setSelectedPill] = useState(null);
  const [method,       setMethod]       = useState('mobile');
  const [network,      setNetwork]      = useState('MTN');
  const [phone,        setPhone]        = useState('');
  const [cardNumber,   setCardNumber]   = useState('');
  const [expiry,       setExpiry]       = useState('');
  const [cvv,          setCvv]          = useState('');
  const [cardHolder,   setCardHolder]   = useState('');
  const [cardType,     setCardType]     = useState('VISA');

  const cardAnim    = useSlideIn(0);
  const methodAnim  = useSlideIn(100);
  const summaryAnim = useSlideIn(200);

  const handleAmountChange = (t) => {
    const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(clean);
    setSelectedPill(null);
  };

  const handlePill = (val) => {
    setAmount(String(val));
    setSelectedPill(val);
  };

  const displayAmount = amount ? `¢${parseFloat(amount).toFixed(2)}` : '¢0.00';
  const methodLabel   = method === 'mobile' ? `Mobile Money · ${network}` : `${cardType} Card`;
  const canProceed    = parseFloat(amount || '0') > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#111110" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Funds</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

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

          {/* ── Payment Method ───────────────────────────────────────── */}
          <Animated.View style={methodAnim}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.methodRow}>

              <TouchableOpacity
                style={[styles.methodTile, method === 'mobile' && styles.methodTileActive]}
                onPress={() => setMethod('mobile')}
                activeOpacity={0.85}
              >
                <View style={[styles.checkCircle, method === 'mobile' && styles.checkCircleActive]}>
                  {method === 'mobile' && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                </View>
                <Ionicons
                  name="phone-portrait-outline" size={28}
                  color={method === 'mobile' ? '#e63946' : '#9ca3af'}
                  style={{ marginBottom: 10 }}
                />
                <Text style={[styles.methodName, method === 'mobile' && styles.methodNameActive]}>
                  Mobile Money
                </Text>
                <Text style={styles.methodSub}>MTN · Vodafone{'\n'}AirtelTigo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodTile, method === 'card' && styles.methodTileActive]}
                onPress={() => setMethod('card')}
                activeOpacity={0.85}
              >
                <View style={[styles.checkCircle, method === 'card' && styles.checkCircleActive]}>
                  {method === 'card' && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                </View>
                <Ionicons
                  name="card-outline" size={28}
                  color={method === 'card' ? '#e63946' : '#9ca3af'}
                  style={{ marginBottom: 10 }}
                />
                <Text style={[styles.methodName, method === 'card' && styles.methodNameActive]}>
                  Debit / Credit
                </Text>
                <Text style={styles.methodSub}>VISA · Mastercard{'\n'}Verve</Text>
              </TouchableOpacity>
            </View>

            {/* Mobile Money Panel */}
            {method === 'mobile' && (
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.panelInput}
                  placeholder="e.g. 024 000 0000"
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.panelLabel, { marginTop: 16 }]}>Network</Text>
                <View style={styles.networkRow}>
                  {NETWORKS.map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.networkPill, network === n && styles.networkPillActive]}
                      onPress={() => setNetwork(n)}
                    >
                      <Text style={[styles.networkPillText, network === n && styles.networkPillTextActive]}>
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.panelLabel, { marginTop: 16 }]}>Account Name</Text>
                <TextInput
                  style={[styles.panelInput, { color: '#9ca3af' }]}
                  placeholder="Verified on next screen"
                  placeholderTextColor="#9ca3af"
                  editable={false}
                />

                <View style={styles.secureNote}>
                  <Ionicons name="lock-closed-outline" size={13} color="#9ca3af" />
                  <Text style={styles.secureText}>
                    Your mobile number is encrypted and never stored.
                  </Text>
                </View>
              </View>
            )}

            {/* Card Panel */}
            {method === 'card' && (
              <View style={styles.panel}>
                <Text style={styles.panelLabel}>Card Number</Text>
                <TextInput
                  style={styles.panelInput}
                  placeholder="0000  0000  0000  0000"
                  placeholderTextColor="#9ca3af"
                  value={cardNumber}
                  onChangeText={t => {
                    const d = t.replace(/\D/g, '').slice(0, 16);
                    setCardNumber(d.replace(/(.{4})/g, '$1  ').trim());
                  }}
                  keyboardType="numeric"
                  maxLength={22}
                />

                <View style={styles.cardTwoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.panelLabel}>Expiry</Text>
                    <TextInput
                      style={styles.panelInput}
                      placeholder="MM / YY"
                      placeholderTextColor="#9ca3af"
                      value={expiry}
                      onChangeText={t => {
                        const d = t.replace(/\D/g, '').slice(0, 4);
                        setExpiry(d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);
                      }}
                      keyboardType="numeric"
                      maxLength={7}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.panelLabel}>CVV</Text>
                    <TextInput
                      style={styles.panelInput}
                      placeholder="•••"
                      placeholderTextColor="#9ca3af"
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>

                <Text style={[styles.panelLabel, { marginTop: 16 }]}>Cardholder Name</Text>
                <TextInput
                  style={styles.panelInput}
                  placeholder="As printed on card"
                  placeholderTextColor="#9ca3af"
                  value={cardHolder}
                  onChangeText={setCardHolder}
                  autoCapitalize="characters"
                />

                <Text style={[styles.panelLabel, { marginTop: 16 }]}>Card Type</Text>
                <View style={styles.networkRow}>
                  {CARD_TYPES.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.networkPill, cardType === c && styles.networkPillActive]}
                      onPress={() => setCardType(c)}
                    >
                      <Text style={[styles.networkPillText, cardType === c && styles.networkPillTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.secureNote}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#9ca3af" />
                  <Text style={styles.secureText}>
                    256-bit SSL encryption. Your card details are fully secured.
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* ── Summary ──────────────────────────────────────────────── */}
          <Animated.View style={[styles.summaryRow, summaryAnim]}>
            <View>
              <Text style={styles.summaryLabel}>You're adding</Text>
              <Text style={styles.summaryAmount}>{displayAmount}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryVia}>via</Text>
              <Text style={styles.summaryMethod}>{methodLabel}</Text>
            </View>
          </Animated.View>

          <Animated.View style={summaryAnim}>
            <AnimatedButton
              label="Proceed"
              style={[styles.proceedBtn, !canProceed && styles.proceedBtnDisabled]}
              textStyle={styles.proceedText}
              onPress={() => {
                if (!canProceed) return;
                if (method === 'mobile' && network === 'MTN') {
                  navigation.navigate('MobileMoney', {
                    amount: parseFloat(amount),
                    prefillPhone: phone,
                  });
                } else {
                  navigation.navigate('Pin', {
                    amount: parseFloat(amount),
                    method: methodLabel,
                  });
                }
              }}
              disabled={!canProceed}
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

  // Amount card
  amountCard:     { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, marginBottom: 16 },
  amountLabel:    { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  amountInputRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 22 },
  amountCurrency: { color: '#ffffff', fontSize: 34, fontWeight: '800', marginRight: 4 },
  amountInput:    { color: '#ffffff', fontSize: 48, fontWeight: '800', letterSpacing: -1, padding: 0, minWidth: 80, includeFontPadding: false },
  pillRow:        { flexDirection: 'row', gap: 7 },
  pill:           { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillActive:     { backgroundColor: '#e63946', borderColor: '#e63946' },
  pillText:       { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#ffffff' },

  // Payment method
  sectionTitle:      { color: '#111110', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  methodRow:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  methodTile:        { flex: 1, backgroundColor: '#ffffff', borderRadius: 18, padding: 16, borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  methodTileActive:  { borderColor: '#e63946' },
  checkCircle:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 12, right: 12 },
  checkCircleActive: { backgroundColor: '#e63946', borderColor: '#e63946' },
  methodName:        { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  methodNameActive:  { color: '#e63946' },
  methodSub:         { color: '#9ca3af', fontSize: 11, lineHeight: 17 },

  // Panel
  panel:                 { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, marginBottom: 14 },
  panelLabel:            { color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  panelInput:            { backgroundColor: '#f5f4f0', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', color: '#111110', fontSize: 15, paddingHorizontal: 16, paddingVertical: 13 },
  networkRow:            { flexDirection: 'row', gap: 8 },
  networkPill:           { flex: 1, backgroundColor: '#f5f4f0', borderRadius: 20, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  networkPillActive:     { backgroundColor: '#e63946', borderColor: '#e63946' },
  networkPillText:       { color: '#374151', fontSize: 13, fontWeight: '600' },
  networkPillTextActive: { color: '#ffffff' },
  cardTwoCol:            { flexDirection: 'row', gap: 12, marginTop: 16 },
  secureNote:            { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  secureText:            { color: '#9ca3af', fontSize: 12, flex: 1, lineHeight: 17 },

  // Summary
  summaryRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 12 },
  summaryLabel:  { color: '#9ca3af', fontSize: 12, marginBottom: 3 },
  summaryAmount: { color: '#111110', fontSize: 22, fontWeight: '800' },
  summaryRight:  { alignItems: 'flex-end' },
  summaryVia:    { color: '#9ca3af', fontSize: 12, marginBottom: 3 },
  summaryMethod: { color: '#111110', fontSize: 13, fontWeight: '600' },

  // Proceed
  proceedBtn:         { backgroundColor: '#111110', borderRadius: 50, height: 56, alignItems: 'center', justifyContent: 'center' },
  proceedBtnDisabled: { backgroundColor: '#d1d5db' },
  proceedText:        { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
