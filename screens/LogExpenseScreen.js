import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Pressable,
  ScrollView, Platform, Animated, Modal, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const CRIMSON = '#8B0000';
const PALE    = 'rgba(139,0,0,0.08)';
const BG      = '#FAFAFA';
const MONO    = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const CATS = [
  { id: 'food',      label: 'Food',      emoji: '🍽️' },
  { id: 'transport', label: 'Transport', emoji: '🚗' },
  { id: 'tools',     label: 'Tools',     emoji: '🛠️' },
  { id: 'other',     label: 'Other',     emoji: '📦' },
];

const PRESETS = {
  food:      'Meal / dining expense',
  transport: 'Fare / fuel / travel expense',
  tools:     'Equipment / tool purchase',
};

const PAID_OPTS = ['Personal – Cash', 'Mobile Money', 'Credit Card'];

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Pulsing green dot ──────────────────────────────────────────────────────────
function PulseDot() {
  const ring = useRef(new Animated.Value(1)).current;
  const op   = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(ring, { toValue: 2.4, duration: 850, useNativeDriver: true }),
        Animated.timing(op,   { toValue: 0,   duration: 850, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ring, { toValue: 1,   duration: 0, useNativeDriver: true }),
        Animated.timing(op,   { toValue: 0.7, duration: 0, useNativeDriver: true }),
      ]),
      Animated.delay(500),
    ])).start();
  }, []);
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        backgroundColor: '#22c55e', opacity: op, transform: [{ scale: ring }],
      }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
    </View>
  );
}

// ── Animated toggle ────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  const a = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: value ? 1 : 0, useNativeDriver: false, tension: 80, friction: 10 }).start();
  }, [value]);
  return (
    <TouchableOpacity onPress={onChange} activeOpacity={0.85}>
      <Animated.View style={[st.track, {
        backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['#d1d5db', CRIMSON] }),
      }]}>
        <Animated.View style={[st.knob, {
          transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [2, 24] }) }],
        }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Dropdown (bottom-sheet style) ──────────────────────────────────────────────
function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={st.dropBtn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={st.dropVal}>{value}</Text>
        <Ionicons name="chevron-down" size={15} color="#9ca3af" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.overlay} onPress={() => setOpen(false)}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>Paid by</Text>
            {options.map(o => (
              <TouchableOpacity
                key={o}
                style={st.sheetRow}
                onPress={() => { onChange(o); setOpen(false); }}
              >
                <Text style={[st.sheetRowTxt, value === o && { color: CRIMSON, fontWeight: '700' }]}>{o}</Text>
                {value === o && <Ionicons name="checkmark" size={16} color={CRIMSON} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ── Simple date picker row ─────────────────────────────────────────────────────
function DateRow({ date, onChange }) {
  const [show, setShow] = useState(false);
  const onPick = (_, selected) => {
    setShow(Platform.OS === 'ios');
    if (selected) onChange(selected);
  };
  return (
    <View>
      <TouchableOpacity style={st.frow} onPress={() => setShow(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
        <Text style={[st.finput, { color: '#111110' }]}>{fmtDate(date)}</Text>
      </TouchableOpacity>
      {show && (() => {
        try {
          const DateTimePicker = require('@react-native-community/datetimepicker').default;
          return (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPick}
              maximumDate={new Date()}
            />
          );
        } catch { return null; }
      })()}
    </View>
  );
}

// ── Success Modal ──────────────────────────────────────────────────────────────
function SuccessModal({ visible, amount, category, date, onDone }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7);
      opacity.setValue(0);
      checkScale.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale,   { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
        Animated.spring(checkScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const catObj = CATS.find(c => c.id === category);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={st.successBg}>
        <Animated.View style={[st.successCard, { opacity, transform: [{ scale }] }]}>

          {/* Checkmark ring */}
          <View style={st.checkRing}>
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <Ionicons name="checkmark" size={44} color="#ffffff" />
            </Animated.View>
          </View>

          <Text style={st.successTitle}>Expense Logged!</Text>
          <Text style={st.successSub}>Your record has been saved successfully.</Text>

          {/* Summary pills */}
          <View style={st.summaryBox}>
            <View style={st.summaryRow}>
              <Text style={st.summaryKey}>Amount</Text>
              <Text style={[st.summaryVal, { color: CRIMSON, fontWeight: '800' }]}>
                GH₵ {parseFloat(amount || 0).toFixed(2)}
              </Text>
            </View>
            {catObj && (
              <View style={st.summaryRow}>
                <Text style={st.summaryKey}>Category</Text>
                <Text style={st.summaryVal}>{catObj.emoji} {catObj.label}</Text>
              </View>
            )}
            <View style={[st.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={st.summaryKey}>Date</Text>
              <Text style={st.summaryVal}>{fmtDate(date)}</Text>
            </View>
          </View>

          <TouchableOpacity style={st.doneBtn} onPress={onDone} activeOpacity={0.85}>
            <Text style={st.doneTxt}>Done</Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function LogExpenseScreen({ navigation }) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const amtRef       = useRef(null);
  const scrollRef    = useRef(null);

  const [amount,   setAmount]   = useState('');
  const [cat,      setCat]      = useState(null);
  const [desc,     setDesc]     = useState('');
  const [date,     setDate]     = useState(new Date());
  const [paidBy,   setPaidBy]   = useState('Personal – Cash');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);

  const pickCat = (id) => {
    setCat(id);
    setDesc(PRESETS[id] ?? '');
  };

  const save = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      amtRef.current?.focus();
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const catObj = CATS.find(c => c.id === cat);
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        title:       desc || (catObj ? catObj.label : 'Expense'),
        description: desc,
        category:    cat,
        amount:      -Math.abs(parseFloat(amount)),
        paidBy,
        note,
        date:        Timestamp.fromDate(date),
        type:        'expense',
        createdAt:   serverTimestamp(),
      });
      setSuccess(true);
    } catch (e) {
      console.error('Failed to log expense:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = () => {
    setSuccess(false);
    navigation.goBack();
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={CRIMSON} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={[st.header, { paddingTop: insets.top + 12 }]}>
            <View style={st.decorLayer}>
              <View style={st.dec1} />
              <View style={st.dec2} />
            </View>

            <View style={st.navRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={st.navBack}>
                <Ionicons name="arrow-back" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 52 }}>
              <Text style={st.hTitle}>Log Expense</Text>
              <Text style={st.hSub}>Track your spending accurately</Text>
            </View>
          </View>

          {/* ── Amount card ─────────────────────────────────────────────── */}
          <View style={st.amtCard}>
            <View style={st.amtLeft}>
              <View style={st.coinWrap}>
                <Ionicons name="cash-outline" size={20} color={CRIMSON} />
              </View>
              <View>
                <Text style={st.amtLabel}>Amount</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={st.amtCurr}>GH₵</Text>
                  <TextInput
                    ref={amtRef}
                    style={st.amtInput}
                    value={amount}
                    onChangeText={t => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#d1d5db"
                    selectionColor={CRIMSON}
                  />
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <PulseDot />
              <Text style={st.syncTxt}>Live sync</Text>
            </View>
          </View>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <View style={st.body}>

            {/* Category */}
            <View style={st.card}>
              <Text style={st.clabel}>Category</Text>
              <View style={st.catGrid}>
                {CATS.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[st.chip, cat === c.id && st.chipOn]}
                    onPress={() => pickCat(c.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={st.chipEmoji}>{c.emoji}</Text>
                    <Text style={[st.chipTxt, cat === c.id && st.chipTxtOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={st.card}>
              <Text style={st.clabel}>Description</Text>
              <View style={st.frow}>
                <Ionicons name="reorder-three-outline" size={20} color="#9ca3af" />
                <TextInput
                  style={st.finput}
                  placeholder="What was this expense for?"
                  placeholderTextColor="#c4c4c4"
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>
            </View>

            {/* Date */}
            <View style={st.card}>
              <Text style={st.clabel}>Date</Text>
              <DateRow date={date} onChange={setDate} />
            </View>

            {/* Paid by */}
            <View style={st.card}>
              <Text style={st.clabel}>Paid by</Text>
              <View style={st.frow}>
                <Ionicons name="wallet-outline" size={20} color="#9ca3af" />
                <View style={{ flex: 1 }}>
                  <Dropdown value={paidBy} options={PAID_OPTS} onChange={setPaidBy} />
                </View>
              </View>
            </View>

            {/* Note — scroll to it on focus so keyboard never hides it */}
            <View
              style={st.card}
              onLayout={e => {
                const { y } = e.nativeEvent.layout;
                // store y so we can scroll to it on focus
                scrollRef._noteY = y;
              }}
            >
              <Text style={st.clabel}>
                Note <Text style={st.optTxt}>(optional)</Text>
              </Text>
              <TextInput
                style={[st.finput, st.area]}
                placeholder="Any extra context…"
                placeholderTextColor="#c4c4c4"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({
                      y: (scrollRef._noteY ?? 0) + 40,
                      animated: true,
                    });
                  }, 300);
                }}
              />
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              <Text style={st.saveTxt}>{saving ? 'Saving…' : 'Save Expense'}</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success overlay ──────────────────────────────────────────────── */}
      <SuccessModal
        visible={success}
        amount={amount}
        category={cat}
        date={date}
        onDone={handleDone}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header:     { backgroundColor: CRIMSON },
  decorLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  dec1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 },
  dec2: { position: 'absolute', width: 160, height: 160, borderRadius: 80,  backgroundColor: 'rgba(255,255,255,0.05)', top: 20,   left: -50 },
  navRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12 },
  navBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hTitle:  { color: '#ffffff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  hSub:    { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 4 },

  // Amount card
  amtCard: {
    marginHorizontal: 20,
    marginTop: -48,
    zIndex: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  amtLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: PALE, alignItems: 'center', justifyContent: 'center' },
  amtLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '500', marginBottom: 2 },
  amtCurr:  { color: '#374151', fontSize: 18, fontWeight: '700', marginRight: 3 },
  amtInput: { color: '#111110', fontSize: 32, fontWeight: '700', fontFamily: MONO, padding: 0, minWidth: 80, includeFontPadding: false },
  syncTxt:  { color: '#9ca3af', fontSize: 10, fontWeight: '500' },

  body: { paddingHorizontal: 20, paddingTop: 24 },

  // Field cards
  card:   { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#eeeeee' },
  clabel: { color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 12, letterSpacing: 0.1 },
  optTxt: { color: '#9ca3af', fontWeight: '400' },

  // Category chips
  catGrid:   { flexDirection: 'row', gap: 8 },
  chip:      { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#eeeeee' },
  chipOn:    { backgroundColor: PALE, borderColor: CRIMSON },
  chipEmoji: { fontSize: 18, marginBottom: 5 },
  chipTxt:   { color: '#6b7280', fontSize: 11, fontWeight: '600' },
  chipTxtOn: { color: CRIMSON },

  // Field rows
  frow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finput: { flex: 1, color: '#111110', fontSize: 14, padding: 0 },
  area:   { minHeight: 72, paddingTop: 4, textAlignVertical: 'top' },

  // Toggle (unused but kept for style completeness)
  trow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tlabel:   { color: '#374151', fontSize: 14, fontWeight: '500' },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PALE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { color: CRIMSON, fontSize: 11, fontWeight: '600' },
  track:    { width: 48, height: 28, borderRadius: 14, justifyContent: 'center' },
  knob:     { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  // Dropdown
  dropBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropVal:    { color: '#111110', fontSize: 14, flex: 1 },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle: { color: '#111110', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  sheetRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  sheetRowTxt:{ color: '#374151', fontSize: 15 },

  // Save button
  saveBtn: { backgroundColor: CRIMSON, borderRadius: 16, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 8 },
  saveTxt: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // Success modal
  successBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:  { backgroundColor: '#ffffff', borderRadius: 28, padding: 32, alignItems: 'center', width: '100%', maxWidth: 380 },
  checkRing:    { width: 88, height: 88, borderRadius: 44, backgroundColor: CRIMSON, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: CRIMSON, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  successTitle: { color: '#111110', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  successSub:   { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  summaryBox:   { width: '100%', backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 16, marginBottom: 24 },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  summaryKey:   { color: '#9ca3af', fontSize: 13 },
  summaryVal:   { color: '#111110', fontSize: 14, fontWeight: '600' },
  doneBtn:      { backgroundColor: CRIMSON, borderRadius: 50, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center' },
  doneTxt:      { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
