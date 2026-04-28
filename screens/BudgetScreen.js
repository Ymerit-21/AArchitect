import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Modal, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG   = '#f0ede6';
const DARK = '#111110';
const RED  = '#e63946';
const GREEN= '#10b981';
const AMBER= '#f59e0b';

const CATEGORIES = [
  { name: 'Food',      icon: 'fast-food-outline',      color: '#e63946' },
  { name: 'Transport', icon: 'car-outline',             color: '#3b82f6' },
  { name: 'Tools',     icon: 'construct-outline',       color: '#10b981' },
  { name: 'Shopping',  icon: 'bag-handle-outline',      color: '#a855f7' },
  { name: 'Health',    icon: 'heart-outline',           color: '#ec4899' },
  { name: 'Bills',     icon: 'document-text-outline',   color: '#f97316' },
  { name: 'Other',     icon: 'ellipsis-horizontal-circle-outline', color: '#eab308' },
];

const PERIODS = ['Weekly', 'Monthly', 'Yearly'];

function fmt(n)      { return `¢${Number(n ?? 0).toFixed(2)}`; }
function fmtShort(n) { return `¢${Number(n ?? 0).toFixed(0)}`; }

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'Weekly')  { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  if (period === 'Monthly') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'Yearly')  return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getSpent(transactions, category, period) {
  const start = getPeriodStart(period);
  return transactions
    .filter(t => {
      const td = t.createdAt?.toDate?.();
      return t.amount < 0 &&
        (t.category ?? 'Other') === category &&
        td && td >= start;
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

function useEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Budget card ────────────────────────────────────────────────────────────────
function BudgetCard({ budget, transactions, onDelete }) {
  const cat      = CATEGORIES.find(c => c.name === budget.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const spent    = getSpent(transactions, budget.category, budget.period ?? 'Monthly');
  const limit    = budget.limitAmount ?? 0;
  const pct      = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const over     = pct >= 1;
  const warning  = pct >= 0.75 && !over;
  const barColor = over ? RED : warning ? AMBER : GREEN;

  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false, tension: 55, friction: 10, delay: 80 }).start();
  }, [pct]);

  return (
    <View style={[bc.card, { borderLeftColor: cat.color, borderLeftWidth: 4 }]}>
      {/* Top row */}
      <View style={bc.topRow}>
        <View style={[bc.iconWrap, { backgroundColor: `${cat.color}18` }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bc.title} numberOfLines={1}>{budget.title}</Text>
          <View style={bc.periodRow}>
            <Ionicons name="time-outline" size={11} color="#9ca3af" />
            <Text style={bc.period}>{budget.period ?? 'Monthly'}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {over && (
            <View style={bc.overBadge}>
              <Ionicons name="warning-outline" size={11} color="#dc2626" />
              <Text style={bc.overTxt}>Over budget</Text>
            </View>
          )}
          {warning && !over && (
            <View style={bc.warnBadge}>
              <Ionicons name="alert-outline" size={11} color="#d97706" />
              <Text style={bc.warnTxt}>Near limit</Text>
            </View>
          )}
          <TouchableOpacity style={bc.delBtn} onPress={onDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color="#d1d5db" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Amounts */}
      <View style={bc.amtRow}>
        <Text style={[bc.spent, { color: barColor }]}>{fmt(spent)}</Text>
        <Text style={bc.divText}> / </Text>
        <Text style={bc.limit}>{fmt(limit)}</Text>
      </View>

      {/* Progress bar */}
      <View style={bc.track}>
        <Animated.View style={[bc.fill, {
          width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: barColor,
        }]} />
      </View>

      {/* Bottom row */}
      <View style={bc.bottomRow}>
        <Text style={[bc.remaining, { color: over ? RED : '#9ca3af' }]}>
          {over
            ? `${fmt(spent - limit)} over`
            : `${fmt(limit - spent)} remaining`}
        </Text>
        <Text style={[bc.pct, { color: barColor }]}>{Math.round(pct * 100)}%</Text>
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  card:       { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  topRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconWrap:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title:      { color: DARK, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  periodRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  period:     { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  overBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fee2e2', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  overTxt:    { color: '#dc2626', fontSize: 10, fontWeight: '700' },
  warnBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  warnTxt:    { color: '#d97706', fontSize: 10, fontWeight: '700' },
  delBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  amtRow:     { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  spent:      { fontSize: 22, fontWeight: '800' },
  divText:    { color: '#d1d5db', fontSize: 18 },
  limit:      { color: '#9ca3af', fontSize: 16, fontWeight: '600' },
  track:      { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  fill:       { height: 8, borderRadius: 4 },
  bottomRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remaining:  { fontSize: 12, fontWeight: '500' },
  pct:        { fontSize: 13, fontWeight: '800' },
});

// ── Create Budget sheet ────────────────────────────────────────────────────────
function CreateSheet({ visible, onClose, onSave, saving }) {
  const sheetY  = useRef(new Animated.Value(600)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  const [selectedCat, setSelectedCat] = useState(null);
  const [title,       setTitle]       = useState('');
  const [limitAmt,    setLimitAmt]    = useState('');
  const [period,      setPeriod]      = useState('Monthly');
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedCat(null); setTitle(''); setLimitAmt('');
      setPeriod('Monthly'); setError('');
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY,  { toValue: 600, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleCatSelect = (cat) => {
    setSelectedCat(cat);
    if (!title) setTitle(`${cat.name} Budget`);
    setError('');
  };

  const handleSave = () => {
    if (!selectedCat)  return setError('Select a spending category.');
    if (!title.trim()) return setError('Enter a budget name.');
    if (!limitAmt || isNaN(parseFloat(limitAmt)) || parseFloat(limitAmt) <= 0)
                       return setError('Enter a valid spending limit.');
    setError('');
    onSave({
      type:        'budget',
      title:       title.trim(),
      category:    selectedCat.name,
      limitAmount: parseFloat(limitAmt),
      period,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.overlay, { opacity: overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[sh.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={sh.handle} />

            <View style={sh.headRow}>
              <Text style={sh.sheetTitle}>New Budget</Text>
              <TouchableOpacity onPress={onClose} style={sh.closeBtn}>
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Category picker */}
              <Text style={sh.label}>Category</Text>
              <View style={sh.catGrid}>
                {CATEGORIES.map(cat => {
                  const active = selectedCat?.name === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[sh.catPill, { borderColor: cat.color, backgroundColor: active ? cat.color : `${cat.color}12` }]}
                      onPress={() => handleCatSelect(cat)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={cat.icon} size={16} color={active ? '#ffffff' : cat.color} />
                      <Text style={[sh.catTxt, { color: active ? '#ffffff' : cat.color }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Name */}
              <Text style={sh.label}>Budget name</Text>
              <TextInput
                style={sh.input}
                placeholder="e.g. Monthly Food Budget…"
                placeholderTextColor="#c4c4c4"
                value={title}
                onChangeText={t => { setTitle(t); setError(''); }}
              />

              {/* Limit */}
              <Text style={sh.label}>Spending limit</Text>
              <View style={sh.amtWrap}>
                <Text style={sh.cedi}>¢</Text>
                <TextInput
                  style={sh.amtInput}
                  placeholder="0.00"
                  placeholderTextColor="#c4c4c4"
                  value={limitAmt}
                  onChangeText={t => { setLimitAmt(t); setError(''); }}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Period */}
              <Text style={sh.label}>Resets every</Text>
              <View style={sh.periodRow}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[sh.periodPill, period === p && sh.periodPillActive]}
                    onPress={() => setPeriod(p)}
                    activeOpacity={0.75}
                  >
                    <Text style={[sh.periodTxt, period === p && sh.periodTxtActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error */}
              {!!error && (
                <View style={sh.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={RED} />
                  <Text style={sh.errorTxt}>{error}</Text>
                </View>
              )}

              <View style={{ height: 20 }} />

              <TouchableOpacity
                style={[sh.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={sh.saveTxt}>Create Budget</Text>}
              </TouchableOpacity>

              <View style={{ height: 28 }} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14, maxHeight: '90%' },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 22 },
  headRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  sheetTitle:     { color: DARK, fontSize: 22, fontWeight: '800' },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  label:          { color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catPill:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, borderWidth: 1.5 },
  catTxt:         { fontSize: 13, fontWeight: '700' },
  input:          { backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: DARK, marginBottom: 18 },
  amtWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 18 },
  cedi:           { color: RED, fontSize: 20, fontWeight: '800', marginRight: 6 },
  amtInput:       { flex: 1, fontSize: 20, fontWeight: '700', color: DARK, padding: 0 },
  periodRow:      { flexDirection: 'row', gap: 10, marginBottom: 18 },
  periodPill:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 50, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent' },
  periodPillActive: { backgroundColor: DARK, borderColor: DARK },
  periodTxt:      { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  periodTxtActive:{ color: '#ffffff' },
  errorBox:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorTxt:       { color: RED, fontSize: 13, flex: 1 },
  saveBtn:        { backgroundColor: RED, borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  saveTxt:        { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function BudgetScreen({ navigation }) {
  const insets              = useSafeAreaInsets();
  const { user }            = useAuth();
  const { goals, transactions } = useUserData();

  const [createOpen, setCreateOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);

  const budgets = goals.filter(g => g.type === 'budget');

  // Summary numbers
  const totalBudgeted = budgets.reduce((s, b) => s + (b.limitAmount ?? 0), 0);
  const totalSpent    = budgets.reduce((s, b) => s + getSpent(transactions, b.category, b.period ?? 'Monthly'), 0);
  const overallPct    = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const totalRemain   = Math.max(totalBudgeted - totalSpent, 0);

  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(barAnim, { toValue: overallPct, useNativeDriver: false, tension: 55, friction: 10 }).start();
  }, [overallPct]);

  const over    = budgets.filter(b => getSpent(transactions, b.category, b.period ?? 'Monthly') >= (b.limitAmount ?? 0)).length;
  const onTrack = budgets.length - over;

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(160);

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'goals'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      setCreateOpen(false);
    } catch {
      Alert.alert('Error', 'Could not create budget. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (budget) => {
    Alert.alert(
      'Delete Budget',
      `Delete "${budget.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'goals', budget.id));
            } catch {
              Alert.alert('Error', 'Could not delete budget.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.header, a0]}>
          <View>
            <Text style={st.headerTitle}>Budgets</Text>
            <Text style={st.headerSub}>Track your spending limits</Text>
          </View>
          <TouchableOpacity style={st.addBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Summary hero card ── */}
        {budgets.length > 0 && (
          <Animated.View style={[st.ph, a1]}>
            <View style={st.heroCard}>
              <View style={st.heroBlob} />

              <View style={st.heroTop}>
                <View style={st.heroBadge}>
                  <View style={st.heroDot} />
                  <Text style={st.heroBadgeTxt}>TOTAL BUDGETED</Text>
                </View>
                <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.3)" />
              </View>

              <Text style={st.heroAmt}>{fmt(totalBudgeted)}</Text>

              {/* Progress bar */}
              <View style={st.heroTrack}>
                <Animated.View style={[st.heroFill, {
                  width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: overallPct >= 1 ? RED : overallPct >= 0.75 ? AMBER : GREEN,
                }]} />
              </View>

              {/* Stats row */}
              <View style={st.heroStats}>
                <View style={st.heroStatItem}>
                  <Text style={st.heroStatLabel}>SPENT</Text>
                  <Text style={[st.heroStatVal, { color: '#f87171' }]}>{fmt(totalSpent)}</Text>
                </View>
                <View style={st.heroDivider} />
                <View style={st.heroStatItem}>
                  <Text style={st.heroStatLabel}>REMAINING</Text>
                  <Text style={[st.heroStatVal, { color: '#4ade80' }]}>{fmt(totalRemain)}</Text>
                </View>
                <View style={st.heroDivider} />
                <View style={st.heroStatItem}>
                  <Text style={st.heroStatLabel}>ON TRACK</Text>
                  <Text style={[st.heroStatVal, { color: '#ffffff' }]}>{onTrack}/{budgets.length}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Budget list ── */}
        <Animated.View style={[st.ph, { marginTop: 20 }, a2]}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>My Budgets</Text>
            <Text style={st.sectionCount}>{budgets.length}</Text>
          </View>

          {budgets.length === 0 ? (
            <View style={st.emptyBox}>
              <View style={st.emptyIconWrap}>
                <Ionicons name="wallet-outline" size={36} color={RED} />
              </View>
              <Text style={st.emptyTitle}>No budgets yet</Text>
              <Text style={st.emptySub}>Set spending limits by category to keep your finances on track</Text>
              <TouchableOpacity style={st.emptyBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={st.emptyBtnTxt}>Create Budget</Text>
              </TouchableOpacity>
            </View>
          ) : (
            budgets.map(b => (
              <BudgetCard
                key={b.id}
                budget={b}
                transactions={transactions}
                onDelete={() => handleDelete(b)}
              />
            ))
          )}
        </Animated.View>

      </ScrollView>

      <BottomNav activeTab="grid" navigation={navigation} bottomInset={insets.bottom || 10} />

      <CreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        saving={saving}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerTitle: { color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  headerSub:   { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  addBtn:      { width: 46, height: 46, borderRadius: 23, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },

  heroCard:    { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, overflow: 'hidden' },
  heroBlob:    { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#7f1d1d', top: -50, right: -20, opacity: 0.65 },
  heroTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  heroBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(230,57,70,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  heroDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  heroBadgeTxt:{ color: RED, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroAmt:     { color: '#ffffff', fontSize: 44, fontWeight: '800', letterSpacing: -1, marginBottom: 16 },
  heroTrack:   { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 18 },
  heroFill:    { height: 6, borderRadius: 3 },
  heroStats:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 },
  heroStatItem:{ flex: 1, alignItems: 'center' },
  heroStatLabel:{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  heroStatVal: { fontSize: 15, fontWeight: '800' },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: DARK, fontSize: 18, fontWeight: '800' },
  sectionCount: { color: '#9ca3af', fontSize: 14 },

  emptyBox:     { backgroundColor: '#ffffff', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { color: DARK, fontSize: 17, fontWeight: '700' },
  emptySub:     { color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13, marginTop: 4 },
  emptyBtnTxt:  { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
