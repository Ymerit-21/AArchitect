import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, ActivityIndicator, Animated,
  Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, addDoc, collection, serverTimestamp, increment, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const MTN_YELLOW = '#FFCC00';
const MTN_DARK   = '#1a1200';
const BG         = '#fffdf5';
const DARK       = '#111110';
const MUTED      = '#9ca3af';
const GREEN      = '#22c55e';
const RED        = '#e63946';

const STEP = { INPUT: 'input', LOADING: 'loading', PENDING: 'pending', SUCCESS: 'success', FAILED: 'failed' };

// ── MTN MoMo credentials ─────────────────────────────────────────────────────
// To go live: set TARGET_ENV = 'mtnghana', BASE_URL to production URL,
// and replace SUBSCRIPTION_KEY / API_USER / API_KEY with your production keys.
const BASE_URL         = 'https://sandbox.momodeveloper.mtn.com';
const TARGET_ENV       = 'sandbox';
const SUBSCRIPTION_KEY = '55baca461f814abb98a0b9b9cc4654af';
const API_USER         = 'd28ae7bb-b3ce-44ad-8af9-50081cdd7564';
const API_KEY          = '535e01f952e042f3824ff064e97b8b53';

const MAX_POLLS = 40; // 2 minutes — gives user time to approve on their phone

// ── Helpers ──────────────────────────────────────────────────────────────────
function normalizePhone(p) {
  const d = p.replace(/\D/g, '');
  if (d.startsWith('233')) return d;
  if (d.startsWith('0'))   return '233' + d.slice(1);
  return '233' + d;
}

function isValidMtnGhana(p) {
  return /^233(24|25|53|54|55|59)\d{7}$/.test(normalizePhone(p));
}

async function getAccessToken() {
  const credentials = btoa(`${API_USER}:${API_KEY}`);
  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method:  'POST',
    headers: {
      'Authorization':             `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });
  if (!res.ok) throw new Error(`Token error ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function apiRequestToPay(token, referenceId, amount, msisdn) {
  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      'Authorization':             `Bearer ${token}`,
      'X-Reference-Id':            referenceId,
      'X-Target-Environment':      TARGET_ENV,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Content-Type':              'application/json',
    },
    body: JSON.stringify({
      amount:       String(parseFloat(amount).toFixed(2)),
      currency:     TARGET_ENV === 'sandbox' ? 'EUR' : 'GHS',
      externalId:   referenceId,
      payer:        { partyIdType: 'MSISDN', partyId: msisdn },
      payerMessage: 'Architect wallet top-up',
      payeeNote:    'Architect platform',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request failed (${res.status}): ${body}`);
  }
}

async function apiCheckStatus(token, referenceId) {
  const res = await fetch(
    `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        'Authorization':             `Bearer ${token}`,
        'X-Target-Environment':      TARGET_ENV,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}

async function apiGetAccountName(token, msisdn) {
  const res = await fetch(
    `${BASE_URL}/collection/v1_0/accountholder/msisdn/${msisdn}/basicuserinfo`,
    {
      headers: {
        'Authorization':             `Bearer ${token}`,
        'X-Target-Environment':      TARGET_ENV,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.name ?? [data.given_name, data.family_name].filter(Boolean).join(' ') ?? null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MobileMoneyScreen({ navigation, route }) {
  const { amount = 0, prefillPhone = '' } = route.params ?? {};
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [phone,       setPhone]       = useState(prefillPhone);
  const [accountName, setAccountName] = useState('');
  const [lookingUp,   setLookingUp]   = useState(false);
  const [step,        setStep]        = useState(STEP.INPUT);
  const [error,       setError]       = useState('');
  const [refId,       setRefId]       = useState('');

  const pollRef     = useRef(null);
  const pollCount   = useRef(0);
  const tokenRef    = useRef('');
  const lookupTimer = useRef(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Auto-lookup account name (fails silently — sandbox only has test data)
  useEffect(() => {
    clearTimeout(lookupTimer.current);
    setAccountName('');
    setError('');
    if (!isValidMtnGhana(phone)) return;

    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const token = await getAccessToken();
        const name  = await apiGetAccountName(token, normalizePhone(phone));
        setAccountName(name ?? '');
      } catch {
        setAccountName('');
      } finally {
        setLookingUp(false);
      }
    }, 800);

    return () => clearTimeout(lookupTimer.current);
  }, [phone]);

  // Pulse animation while pending
  useEffect(() => {
    if (step === STEP.PENDING) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [step]);

  // Success pop animation
  useEffect(() => {
    if (step === STEP.SUCCESS) {
      Animated.spring(successScale, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }).start();
    } else {
      successScale.setValue(0);
    }
  }, [step]);

  // Credit wallet helper — shared by sandbox auto-complete and live poll
  const creditWallet = async (financialTransactionId = null) => {
    await Promise.all([
      updateDoc(doc(db, 'users', user.uid), {
        balance:        increment(parseFloat(amount)),
        totalAvailable: increment(parseFloat(amount)),
      }),
      addDoc(collection(db, 'users', user.uid, 'transactions'), {
        title:     'MTN MoMo deposit',
        amount:    parseFloat(amount),
        type:      'deposit',
        createdAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'users', user.uid, 'momoTransactions', refId), {
        status: 'SUCCESSFUL',
        financialTransactionId,
      }).catch(() => {}),
    ]);
  };

  // Auto-deduct configured amounts from active milestones after a successful deposit
  const runMilestoneAutoDeduct = async () => {
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'goals'));
      const depositAmt = parseFloat(amount);

      // Collect active milestones that have auto-deduct enabled
      const targets = snap.docs
        .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
        .filter(g =>
          g.type === 'milestone' &&
          g.autoDeductEnabled === true &&
          (g.autoDeduct ?? 0) > 0 &&
          (g.currentAmount ?? 0) < (g.targetAmount ?? 0),
        );

      if (targets.length === 0) return;

      // Build deduction plan — never deduct more than the deposit itself
      let budgetLeft = depositAmt;
      const plan = [];
      for (const m of targets) {
        if (budgetLeft <= 0) break;
        const remaining  = m.targetAmount - (m.currentAmount ?? 0);
        const deductAmt  = Math.min(parseFloat(m.autoDeduct), remaining, budgetLeft);
        if (deductAmt <= 0) continue;
        plan.push({ ref: m.ref, title: m.title, targetAmount: m.targetAmount, newAmt: (m.currentAmount ?? 0) + deductAmt, deductAmt });
        budgetLeft -= deductAmt;
      }

      if (plan.length === 0) return;
      const totalDeducted = plan.reduce((s, p) => s + p.deductAmt, 0);

      await Promise.all([
        // Update each milestone's progress
        ...plan.map(p => updateDoc(p.ref, { currentAmount: p.newAmt })),
        // Deduct total from wallet
        updateDoc(doc(db, 'users', user.uid), {
          balance:        increment(-totalDeducted),
          totalAvailable: increment(-totalDeducted),
        }),
        // Record one transaction per milestone
        ...plan.map(p =>
          addDoc(collection(db, 'users', user.uid, 'transactions'), {
            title:     `Auto-save: ${p.title}`,
            amount:    -p.deductAmt,
            type:      'milestone_auto',
            category:  'Savings',
            createdAt: serverTimestamp(),
          }),
        ),
      ]);

      // Credit back any milestones that just completed
      const completed = plan.filter(p => p.newAmt >= p.targetAmount);
      if (completed.length > 0) {
        const totalCredited = completed.reduce((s, p) => s + p.newAmt, 0);
        await Promise.all([
          updateDoc(doc(db, 'users', user.uid), {
            balance:        increment(totalCredited),
            totalAvailable: increment(totalCredited),
          }),
          ...completed.map(p =>
            addDoc(collection(db, 'users', user.uid, 'transactions'), {
              title:     `Milestone Achieved: ${p.title}`,
              amount:    p.newAmt,
              type:      'milestone_complete',
              category:  'Savings',
              createdAt: serverTimestamp(),
            }),
          ),
        ]);
      }
    } catch (e) {
      console.warn('Milestone auto-deduct error:', e);
      // Non-fatal — deposit already succeeded
    }
  };

  // Poll payment status every 3 s until user approves on their phone
  useEffect(() => {
    if (step !== STEP.PENDING || !refId) return;
    pollCount.current = 0;

    pollRef.current = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(pollRef.current);
        setStep(STEP.FAILED);
        setError('Payment timed out. Please try again.');
        return;
      }
      try {
        const token  = tokenRef.current || await getAccessToken();
        const data   = await apiCheckStatus(token, refId);
        const status = data.status;

        if (status === 'SUCCESSFUL') {
          clearInterval(pollRef.current);
          await creditWallet(data.financialTransactionId ?? null);
          await runMilestoneAutoDeduct();
          setStep(STEP.SUCCESS);
        } else if (status === 'FAILED') {
          clearInterval(pollRef.current);
          setStep(STEP.FAILED);
          setError('Payment was declined by MTN. Please try again.');
        }
      } catch { /* retry next tick */ }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [step, refId]);

  const handlePay = async () => {
    setError('');
    if (!phone.trim()) { setError('Please enter your MTN MoMo number.'); return; }
    if (!isValidMtnGhana(phone)) {
      setError('Enter a valid MTN Ghana number (024, 025, 053, 054, 055, or 059).');
      return;
    }
    Keyboard.dismiss();
    setStep(STEP.LOADING);
    try {
      const token       = await getAccessToken();
      const referenceId = uuidv4();
      tokenRef.current  = token;

      await apiRequestToPay(token, referenceId, amount, normalizePhone(phone));

      // Record pending transaction in Firestore
      await setDoc(doc(db, 'users', user.uid, 'momoTransactions', referenceId), {
        referenceId,
        amount:    parseFloat(amount),
        phone:     normalizePhone(phone),
        status:    'PENDING',
        createdAt: serverTimestamp(),
      });

      setRefId(referenceId);
      setStep(STEP.PENDING);
    } catch (e) {
      setStep(STEP.INPUT);
      setError(e?.message ?? 'Could not send payment request. Please try again.');
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}
          disabled={step === STEP.PENDING}>
          <Ionicons name="arrow-back" size={20} color={step === STEP.PENDING ? MUTED : DARK} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>MTN Mobile Money</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* MTN Brand banner */}
          <View style={st.banner}>
            <View style={st.mtnBadge}>
              <Text style={st.mtnText}>MTN</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.bannerTitle}>MoMo Payment</Text>
              <Text style={st.bannerSub}>Ghana · Secure · Instant</Text>
            </View>
            <View style={st.sandboxPill}>
              <Text style={st.sandboxTxt}>SANDBOX</Text>
            </View>
          </View>

          {/* Amount card */}
          <View style={st.amountCard}>
            <Text style={st.amountLabel}>AMOUNT</Text>
            <Text style={st.amountValue}>¢{parseFloat(amount).toFixed(2)}</Text>
            <Text style={st.amountNote}>
              A MoMo prompt will be sent to your registered number
            </Text>
          </View>

          {/* ── INPUT / LOADING ── */}
          {(step === STEP.INPUT || step === STEP.LOADING) && (
            <View style={st.card}>
              <Text style={st.cardTitle}>Your MTN Number</Text>

              <View style={[st.phoneRow, !!error && st.phoneRowError]}>
                <View style={st.prefix}>
                  <Text style={st.prefixFlag}>🇬🇭</Text>
                  <Text style={st.prefixCode}>+233</Text>
                </View>
                <View style={st.prefixDivider} />
                <TextInput
                  style={st.phoneInput}
                  value={phone}
                  onChangeText={t => { setPhone(t); setError(''); }}
                  placeholder="024 XXX XXXX"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  maxLength={13}
                  editable={step !== STEP.LOADING}
                />
              </View>

              {/* Account name auto-fill */}
              {(lookingUp || accountName) ? (
                <View style={st.accountRow}>
                  <Ionicons name="person-outline" size={14} color={MUTED} />
                  {lookingUp
                    ? <ActivityIndicator size="small" color={MTN_YELLOW} style={{ marginLeft: 4 }} />
                    : <Text style={st.accountName}>{accountName}</Text>
                  }
                  {accountName ? <Ionicons name="checkmark-circle" size={14} color={GREEN} /> : null}
                </View>
              ) : null}

              {!!error && (
                <View style={st.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color={RED} />
                  <Text style={st.errorTxt}>{error}</Text>
                </View>
              )}

              <View style={st.hintRow}>
                <Ionicons name="information-circle-outline" size={14} color={MUTED} />
                <Text style={st.hintTxt}>MTN numbers: 024, 025, 053, 054, 055, 059</Text>
              </View>

              <TouchableOpacity
                style={[st.payBtn, step === STEP.LOADING && { opacity: 0.75 }]}
                onPress={handlePay}
                disabled={step === STEP.LOADING}
                activeOpacity={0.85}
              >
                {step === STEP.LOADING
                  ? <ActivityIndicator size="small" color={MTN_DARK} />
                  : <>
                      <Ionicons name="send-outline" size={18} color={MTN_DARK} />
                      <Text style={st.payBtnTxt}>Send Payment Request</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── PENDING ── */}
          {step === STEP.PENDING && (
            <View style={[st.card, st.centerCard]}>
              <Animated.View style={[st.pendingRing, { opacity: pulseAnim }]}>
                <Ionicons name="phone-portrait-outline" size={40} color={MTN_YELLOW} />
              </Animated.View>

              <Text style={st.pendingTitle}>Check your phone!</Text>
              <Text style={st.pendingBody}>
                A MoMo prompt has been sent to{'\n'}
                <Text style={{ fontWeight: '800', color: DARK }}>+{normalizePhone(phone)}</Text>.{'\n\n'}
                Open the prompt and enter your{'\n'}
                <Text style={{ fontWeight: '800' }}>MoMo PIN</Text> to approve the payment.
              </Text>

              <View style={st.refBox}>
                <Text style={st.refLabel}>Reference ID</Text>
                <Text style={st.refValue} numberOfLines={1}>{refId.slice(0, 20).toUpperCase()}…</Text>
              </View>

              <View style={st.waitRow}>
                <ActivityIndicator size="small" color={MTN_YELLOW} />
                <Text style={st.waitTxt}>Waiting for confirmation…</Text>
              </View>
            </View>
          )}

          {/* ── SUCCESS ── */}
          {step === STEP.SUCCESS && (
            <Animated.View style={[st.card, st.centerCard, { transform: [{ scale: successScale }] }]}>
              <View style={st.successRing}>
                <Ionicons name="checkmark-circle" size={60} color={GREEN} />
              </View>
              <Text style={st.successTitle}>Payment Successful!</Text>
              <Text style={st.successBody}>
                <Text style={{ color: GREEN, fontWeight: '800' }}>
                  ¢{parseFloat(amount).toFixed(2)}
                </Text>
                {' '}has been added to your Architect wallet.
              </Text>
              <TouchableOpacity style={st.doneBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.85}>
                <Text style={st.doneBtnTxt}>Back to Home</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── FAILED ── */}
          {step === STEP.FAILED && (
            <View style={[st.card, st.centerCard]}>
              <View style={st.failedRing}>
                <Ionicons name="close-circle" size={60} color={RED} />
              </View>
              <Text style={st.failedTitle}>Payment Failed</Text>
              <Text style={st.failedBody}>{error || 'The payment was not completed.'}</Text>
              <TouchableOpacity
                style={st.retryBtn}
                onPress={() => { setStep(STEP.INPUT); setError(''); }}
                activeOpacity={0.85}
              >
                <Text style={st.retryTxt}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Security footer */}
          <View style={st.secureRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={MUTED} />
            <Text style={st.secureTxt}>Secured by MTN MoMo · 256-bit encrypted</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: DARK, fontSize: 17, fontWeight: '800' },
  scroll:      { paddingHorizontal: 20, paddingTop: 8, gap: 14 },

  banner:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: MTN_YELLOW, borderRadius: 20, padding: 16 },
  mtnBadge:    { width: 52, height: 52, borderRadius: 14, backgroundColor: MTN_DARK, alignItems: 'center', justifyContent: 'center' },
  mtnText:     { color: MTN_YELLOW, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  bannerTitle: { color: MTN_DARK, fontSize: 17, fontWeight: '800' },
  bannerSub:   { color: 'rgba(26,18,0,0.6)', fontSize: 12, marginTop: 2 },
  sandboxPill: { backgroundColor: 'rgba(26,18,0,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  sandboxTxt:  { color: MTN_DARK, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  amountCard:  { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  amountLabel: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  amountValue: { color: DARK, fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  amountNote:  { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  card:       { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  centerCard: { alignItems: 'center', gap: 12 },
  cardTitle:  { color: DARK, fontSize: 15, fontWeight: '700', marginBottom: 14 },

  phoneRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f4f0', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', overflow: 'hidden' },
  phoneRowError: { borderColor: RED },
  prefix:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 14 },
  prefixFlag:    { fontSize: 18 },
  prefixCode:    { color: DARK, fontSize: 15, fontWeight: '700' },
  prefixDivider: { width: 1, height: 24, backgroundColor: '#e5e7eb' },
  phoneInput:    { flex: 1, color: DARK, fontSize: 16, fontWeight: '600', paddingHorizontal: 14, paddingVertical: 14 },

  accountRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,204,0,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  accountName: { flex: 1, color: DARK, fontSize: 13, fontWeight: '700' },
  errorRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorTxt:    { color: RED, fontSize: 13, flex: 1 },
  hintRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 20 },
  hintTxt:     { color: MUTED, fontSize: 12, flex: 1 },

  payBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: MTN_YELLOW, borderRadius: 16, height: 54 },
  payBtnTxt: { color: MTN_DARK, fontSize: 16, fontWeight: '800' },

  pendingRing:  { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,204,0,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pendingTitle: { color: DARK, fontSize: 20, fontWeight: '800' },
  pendingBody:  { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  refBox:       { backgroundColor: '#f5f4f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, width: '100%', marginTop: 4 },
  refLabel:     { color: MUTED, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  refValue:     { color: DARK, fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  waitRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  waitTxt:      { color: MUTED, fontSize: 13 },

  successRing:  { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { color: DARK, fontSize: 22, fontWeight: '900' },
  successBody:  { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  doneBtn:      { backgroundColor: DARK, borderRadius: 16, height: 52, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  doneBtnTxt:   { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  failedRing:  { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(230,57,70,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  failedTitle: { color: DARK, fontSize: 22, fontWeight: '900' },
  failedBody:  { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn:    { backgroundColor: RED, borderRadius: 16, height: 52, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  retryTxt:    { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  secureTxt: { color: MUTED, fontSize: 12 },
});
