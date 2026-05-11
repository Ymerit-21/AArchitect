import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Modal, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Switch, Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, Timestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG   = '#f0ede6';
const DARK = '#111110';
const RED  = '#e63946';
const GREEN= '#10b981';

function fmt(n) { return `¢${Number(n ?? 0).toFixed(2)}`; }

const LOCK_OPTIONS = [
  { label: '1 Mo',  months: 1  },
  { label: '3 Mo',  months: 3  },
  { label: '6 Mo',  months: 6  },
  { label: '1 Yr',  months: 12 },
  { label: '2 Yr',  months: 24 },
];

function getLockInfo(lockUntil) {
  if (!lockUntil) return { locked: false, label: 'No lock' };
  const until = lockUntil.toDate ? lockUntil.toDate() : new Date(lockUntil);
  const now   = new Date();
  if (until <= now) return { locked: false, label: 'Unlocked', date: until };
  const diffMs   = until - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffMo   = Math.floor(diffDays / 30);
  const label    = diffMo >= 1 ? `${diffMo} mo left` : `${diffDays}d left`;
  return { locked: true, label, date: until };
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

// ── Milestone Detail Sheet ─────────────────────────────────────────────────────
function MilestoneDetailSheet({ visible, goal, onClose, onAdd }) {
  const sheetY   = useRef(new Animated.Value(600)).current;
  const overlay  = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;

  const pct      = goal ? (goal.targetAmount > 0 ? Math.min((goal.currentAmount ?? 0) / goal.targetAmount, 1) : 0) : 0;
  const done     = pct >= 1;
  const lockInfo = goal ? getLockInfo(goal.lockUntil) : { locked: false, label: 'No lock' };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
      Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false, tension: 55, friction: 10, delay: 250 }).start();
    } else {
      fillAnim.setValue(0);
      Animated.parallel([
        Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY,  { toValue: 600, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!goal) return null;

  const barColor  = done ? GREEN : RED;
  const remaining = (goal.targetAmount ?? 0) - (goal.currentAmount ?? 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.overlay, { opacity: overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[dt.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={sh.handle} />

          {/* Header */}
          <View style={dt.headRow}>
            <View style={[dt.iconWrap, { backgroundColor: done ? '#dcfce7' : '#fef2f2' }]}>
              <Ionicons name={done ? 'checkmark-circle' : 'flag'} size={22} color={done ? GREEN : RED} />
            </View>
            <Text style={dt.title} numberOfLines={1}>{goal.title}</Text>
            <TouchableOpacity onPress={onClose} style={dt.closeBtn}>
              <Ionicons name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Progress section */}
          <View style={dt.progressSection}>
            <View style={dt.amtRow}>
              <View>
                <Text style={dt.amtLabel}>Saved</Text>
                <Text style={[dt.amtVal, { color: barColor }]}>{fmt(goal.currentAmount ?? 0)}</Text>
              </View>
              <View style={dt.pctBadge}>
                <Text style={[dt.pctTxt, { color: barColor }]}>{Math.round(pct * 100)}%</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={dt.amtLabel}>Target</Text>
                <Text style={dt.amtVal}>{fmt(goal.targetAmount)}</Text>
              </View>
            </View>
            <View style={dt.track}>
              <Animated.View style={[dt.fill, {
                width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: barColor,
              }]} />
            </View>
            {!done && (
              <Text style={dt.remainingTxt}>{fmt(remaining)} remaining to reach goal</Text>
            )}
          </View>

          {/* Info rows */}
          <View style={dt.infoSection}>
            <View style={dt.infoRow}>
              <View style={dt.infoIcon}>
                <Ionicons name={lockInfo.locked ? 'lock-closed' : 'lock-open-outline'} size={16} color={lockInfo.locked ? '#d97706' : '#9ca3af'} />
              </View>
              <Text style={dt.infoLabel}>Lock Status</Text>
              <Text style={[dt.infoVal, { color: lockInfo.locked ? '#d97706' : '#6b7280' }]}>{lockInfo.label}</Text>
            </View>

            {lockInfo.locked && lockInfo.date && (
              <View style={dt.infoRow}>
                <View style={dt.infoIcon}>
                  <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                </View>
                <Text style={dt.infoLabel}>Unlocks On</Text>
                <Text style={dt.infoVal}>
                  {lockInfo.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            )}

            <View style={[dt.infoRow, { borderBottomWidth: 0 }]}>
              <View style={dt.infoIcon}>
                <Ionicons name="repeat" size={16} color={goal.autoDeductEnabled ? '#7c3aed' : '#9ca3af'} />
              </View>
              <Text style={dt.infoLabel}>Auto-save</Text>
              <Text style={[dt.infoVal, { color: goal.autoDeductEnabled ? '#7c3aed' : '#6b7280' }]}>
                {goal.autoDeductEnabled && (goal.autoDeduct ?? 0) > 0
                  ? `¢${goal.autoDeduct} per deposit`
                  : 'Not enabled'}
              </Text>
            </View>
          </View>

          {/* Add Funds CTA */}
          {!lockInfo.locked && !done && (
            <TouchableOpacity
              style={dt.addBtn}
              onPress={() => { onClose(); setTimeout(() => onAdd(goal), 260); }}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" />
              <Text style={dt.addBtnTxt}>Add Funds</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const dt = StyleSheet.create({
  sheet:          { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14 },
  headRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  iconWrap:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title:          { flex: 1, color: DARK, fontSize: 20, fontWeight: '800' },
  closeBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  progressSection:{ backgroundColor: '#f9fafb', borderRadius: 20, padding: 20, marginBottom: 14 },
  amtRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  amtLabel:       { color: '#9ca3af', fontSize: 12, fontWeight: '500', marginBottom: 4 },
  amtVal:         { color: DARK, fontSize: 18, fontWeight: '800' },
  pctBadge:       { backgroundColor: '#ffffff', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  pctTxt:         { fontSize: 20, fontWeight: '800' },
  track:          { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  fill:           { height: 10, borderRadius: 5 },
  remainingTxt:   { color: '#9ca3af', fontSize: 12, textAlign: 'center', marginTop: 2 },
  infoSection:    { backgroundColor: '#f9fafb', borderRadius: 20, overflow: 'hidden', marginBottom: 18 },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
  infoIcon:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  infoLabel:      { flex: 1, color: '#374151', fontSize: 14, fontWeight: '500' },
  infoVal:        { color: '#6b7280', fontSize: 14, fontWeight: '600' },
  addBtn:         { backgroundColor: RED, borderRadius: 16, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnTxt:      { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

// ── Milestone card ─────────────────────────────────────────────────────────────
function MilestoneCard({ goal, onAdd, onDelete, onOpen }) {
  const pct      = goal.targetAmount > 0 ? Math.min((goal.currentAmount ?? 0) / goal.targetAmount, 1) : 0;
  const done     = pct >= 1;
  const lockInfo = getLockInfo(goal.lockUntil);
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false, tension: 55, friction: 10, delay: 100 }).start();
  }, [pct]);

  const barColor = done ? GREEN : RED;

  return (
    <TouchableOpacity style={[mc.card, done && mc.cardDone]} onPress={() => onOpen?.(goal)} activeOpacity={0.85}>
      {/* Top row */}
      <View style={mc.topRow}>
        <View style={[mc.iconWrap, { backgroundColor: done ? '#dcfce7' : '#fef2f2' }]}>
          <Ionicons name={done ? 'checkmark-circle' : 'flag'} size={20} color={done ? GREEN : RED} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mc.title} numberOfLines={1}>{goal.title}</Text>
          <Text style={mc.sub}>{fmt(goal.currentAmount ?? 0)} of {fmt(goal.targetAmount)}</Text>
        </View>
        {!lockInfo.locked && !done && (
          <TouchableOpacity style={mc.addBtn} onPress={() => onAdd(goal)} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="#ffffff" />
          </TouchableOpacity>
        )}
        {!lockInfo.locked && (
          <TouchableOpacity style={mc.delBtn} onPress={() => onDelete(goal)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color="#d1d5db" />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={mc.track}>
        <Animated.View style={[mc.fill, {
          width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: barColor,
        }]} />
      </View>

      {/* Bottom badges */}
      <View style={mc.badgeRow}>
        {/* Lock badge */}
        <View style={[mc.badge, { backgroundColor: lockInfo.locked ? '#fef3c7' : '#f3f4f6' }]}>
          <Ionicons
            name={lockInfo.locked ? 'lock-closed' : 'lock-open-outline'}
            size={11}
            color={lockInfo.locked ? '#d97706' : '#9ca3af'}
          />
          <Text style={[mc.badgeTxt, { color: lockInfo.locked ? '#d97706' : '#9ca3af' }]}>
            {lockInfo.label}
          </Text>
        </View>

        {/* Auto-deduct badge */}
        {goal.autoDeductEnabled && (goal.autoDeduct ?? 0) > 0 && (
          <View style={[mc.badge, { backgroundColor: '#ede9fe' }]}>
            <Ionicons name="repeat" size={11} color="#7c3aed" />
            <Text style={[mc.badgeTxt, { color: '#7c3aed' }]}>
              ¢{goal.autoDeduct} / deposit
            </Text>
          </View>
        )}

        {/* Done badge */}
        {done && (
          <View style={[mc.badge, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="checkmark-circle" size={11} color={GREEN} />
            <Text style={[mc.badgeTxt, { color: GREEN }]}>Completed ✓</Text>
          </View>
        )}

        {!done && <Text style={mc.pct}>{Math.round(pct * 100)}%</Text>}
      </View>

      {/* Lock expiry date */}
      {lockInfo.locked && lockInfo.date && (
        <Text style={mc.lockDate}>
          Locked until {lockInfo.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const mc = StyleSheet.create({
  card:    { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1, borderWidth: 1, borderColor: 'transparent' },
  cardDone:{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconWrap:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title:   { color: DARK, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sub:     { color: '#9ca3af', fontSize: 12 },
  addBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  delBtn:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  track:   { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  fill:    { height: 8, borderRadius: 4 },
  badgeRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:{ fontSize: 11, fontWeight: '600' },
  pct:     { marginLeft: 'auto', color: RED, fontSize: 13, fontWeight: '800' },
  lockDate:{ color: '#9ca3af', fontSize: 11, marginTop: 8 },
});

// ── Add Funds to Milestone sheet ───────────────────────────────────────────────
function AddFundsSheet({ visible, goal, onClose, onConfirm, saving }) {
  const sheetY  = useRef(new Animated.Value(400)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const [amount, setAmount] = useState('');
  const { profile } = useUserData();

  useEffect(() => {
    if (visible) {
      setAmount('');
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY,  { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!goal) return null;
  const remaining = (goal.targetAmount ?? 0) - (goal.currentAmount ?? 0);
  const walletBalance = profile?.balance ?? 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.overlay, { opacity: overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[sh.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={sh.handle} />
            <Text style={sh.title}>Add to "{goal.title}"</Text>
            <View style={sh.subRow}>
              <Text style={sh.sub}>¢{remaining.toFixed(2)} remaining</Text>
              <View style={sh.balancePill}>
                <Ionicons name="wallet-outline" size={12} color="#6366f1" />
                <Text style={sh.balanceTxt}>Wallet: {fmt(walletBalance)}</Text>
              </View>
            </View>

            <View style={sh.inputWrap}>
              <Text style={sh.cedi}>¢</Text>
              <TextInput
                style={sh.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#d1d5db"
                autoFocus
              />
            </View>

            {/* Quick amounts */}
            <View style={sh.quickRow}>
              {[10, 20, 50, 100].map(v => (
                <TouchableOpacity key={v} style={sh.quickPill} onPress={() => setAmount(String(v))} activeOpacity={0.8}>
                  <Text style={sh.quickTxt}>+¢{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[sh.confirmBtn, (!amount || saving) && { opacity: 0.5 }]}
              onPress={() => onConfirm(parseFloat(amount))}
              disabled={!amount || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <Text style={sh.confirmTxt}>Add to Milestone</Text>}
            </TouchableOpacity>
            <View style={{ height: 12 }} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 22 },
  title:       { color: DARK, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  subRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  sub:         { color: '#9ca3af', fontSize: 14 },
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef2ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  balanceTxt:  { color: '#6366f1', fontSize: 12, fontWeight: '700' },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#e5e7eb' },
  cedi:       { color: RED, fontSize: 28, fontWeight: '800', marginRight: 6 },
  input:      { flex: 1, fontSize: 32, fontWeight: '800', color: DARK, padding: 0 },
  quickRow:   { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickPill:  { flex: 1, backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  quickTxt:   { color: RED, fontSize: 13, fontWeight: '700' },
  confirmBtn: { backgroundColor: RED, borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  confirmTxt: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

// ── Create Milestone sheet ─────────────────────────────────────────────────────
function CreateSheet({ visible, onClose, onSave, saving }) {
  const sheetY  = useRef(new Animated.Value(600)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  const [title,            setTitle]           = useState('');
  const [targetAmount,     setTargetAmount]    = useState('');
  const [lockMonths,       setLockMonths]      = useState(null);
  const [autoDeduct,       setAutoDeduct]      = useState(false);
  const [autoDeductAmount, setAutoDeductAmt]   = useState('');
  const [error,            setError]           = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(''); setTargetAmount(''); setLockMonths(null);
      setAutoDeduct(false); setAutoDeductAmt(''); setError('');
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

  const handleSave = () => {
    if (!title.trim())       return setError('Give your milestone a name.');
    if (!targetAmount || isNaN(parseFloat(targetAmount)) || parseFloat(targetAmount) <= 0)
                             return setError('Enter a valid target amount.');
    if (autoDeduct && (!autoDeductAmount || parseFloat(autoDeductAmount) <= 0))
                             return setError('Enter a valid auto-deduct amount.');
    setError('');

    let lockUntil = null;
    if (lockMonths) {
      const d = new Date();
      d.setMonth(d.getMonth() + lockMonths);
      lockUntil = Timestamp.fromDate(d);
    }

    onSave({
      title:             title.trim(),
      targetAmount:      parseFloat(targetAmount),
      currentAmount:     0,
      lockUntil,
      autoDeductEnabled: autoDeduct,
      autoDeduct:        autoDeduct ? parseFloat(autoDeductAmount) : 0,
      type:              'milestone',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[sh.overlay, { opacity: overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[cr.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={sh.handle} />

            <View style={cr.headRow}>
              <Text style={cr.title}>New Milestone</Text>
              <TouchableOpacity onPress={onClose} style={cr.closeBtn}>
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Name */}
              <Text style={cr.label}>Milestone name</Text>
              <TextInput
                style={cr.input}
                placeholder="e.g. School Fees, New Car…"
                placeholderTextColor="#c4c4c4"
                value={title}
                onChangeText={t => { setTitle(t); setError(''); }}
              />

              {/* Target */}
              <Text style={cr.label}>Target amount</Text>
              <View style={cr.amtWrap}>
                <Text style={cr.cedi}>¢</Text>
                <TextInput
                  style={cr.amtInput}
                  placeholder="0.00"
                  placeholderTextColor="#c4c4c4"
                  value={targetAmount}
                  onChangeText={t => { setTargetAmount(t); setError(''); }}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Lock duration */}
              <Text style={cr.label}>Lock duration</Text>
              <Text style={cr.hint}>Funds cannot be withdrawn until the lock expires</Text>
              <View style={cr.lockRow}>
                <TouchableOpacity
                  style={[cr.lockPill, lockMonths === null && cr.lockPillActive]}
                  onPress={() => setLockMonths(null)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="lock-open-outline" size={13} color={lockMonths === null ? '#ffffff' : '#9ca3af'} />
                  <Text style={[cr.lockTxt, lockMonths === null && cr.lockTxtActive]}>None</Text>
                </TouchableOpacity>
                {LOCK_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.months}
                    style={[cr.lockPill, lockMonths === opt.months && cr.lockPillActive]}
                    onPress={() => setLockMonths(opt.months)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="lock-closed-outline" size={13} color={lockMonths === opt.months ? '#ffffff' : '#9ca3af'} />
                    <Text style={[cr.lockTxt, lockMonths === opt.months && cr.lockTxtActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Lock preview */}
              {lockMonths && (
                <View style={cr.lockPreview}>
                  <Ionicons name="calendar-outline" size={14} color="#d97706" />
                  <Text style={cr.lockPreviewTxt}>
                    Locked until{' '}
                    {(() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + lockMonths);
                      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                    })()}
                  </Text>
                </View>
              )}

              {/* Auto-deduct */}
              <View style={cr.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cr.label}>Auto-save per deposit</Text>
                  <Text style={cr.hint}>Deduct a fixed amount every time funds are added</Text>
                </View>
                <Switch
                  value={autoDeduct}
                  onValueChange={setAutoDeduct}
                  trackColor={{ false: '#e5e7eb', true: `${RED}60` }}
                  thumbColor={autoDeduct ? RED : '#ffffff'}
                />
              </View>

              {autoDeduct && (
                <View style={cr.amtWrap}>
                  <Text style={cr.cedi}>¢</Text>
                  <TextInput
                    style={cr.amtInput}
                    placeholder="Amount per deposit"
                    placeholderTextColor="#c4c4c4"
                    value={autoDeductAmount}
                    onChangeText={t => { setAutoDeductAmt(t); setError(''); }}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* Error */}
              {!!error && (
                <View style={cr.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={RED} />
                  <Text style={cr.errorTxt}>{error}</Text>
                </View>
              )}

              <View style={{ height: 20 }} />

              {/* Submit */}
              <TouchableOpacity
                style={[cr.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={cr.saveTxt}>Create Milestone</Text>}
              </TouchableOpacity>

              <View style={{ height: 28 }} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const cr = StyleSheet.create({
  sheet:      { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14, maxHeight: '90%' },
  headRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  title:      { color: DARK, fontSize: 22, fontWeight: '800' },
  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  label:      { color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  hint:       { color: '#9ca3af', fontSize: 12, marginBottom: 10, marginTop: -4 },
  input:      { backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: DARK, marginBottom: 18 },
  amtWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 18 },
  cedi:       { color: RED, fontSize: 20, fontWeight: '800', marginRight: 6 },
  amtInput:   { flex: 1, fontSize: 20, fontWeight: '700', color: DARK, padding: 0 },
  lockRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  lockPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent' },
  lockPillActive: { backgroundColor: DARK, borderColor: DARK },
  lockTxt:    { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  lockTxtActive:  { color: '#ffffff' },
  lockPreview:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginBottom: 18 },
  lockPreviewTxt: { color: '#d97706', fontSize: 13, fontWeight: '500' },
  switchRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  errorBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorTxt:   { color: RED, fontSize: 13, flex: 1 },
  saveBtn:    { backgroundColor: RED, borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  saveTxt:    { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

// ── Completion Toast ───────────────────────────────────────────────────────────
function CompletionToast({ message, onHide }) {
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    translateY.setValue(120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 3800);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[tn.wrap, { opacity, transform: [{ translateY }] }]}>
      <View style={tn.inner}>
        <View style={tn.iconWrap}>
          <Ionicons name="trophy" size={18} color={GREEN} />
        </View>
        <Text style={tn.text} numberOfLines={2}>{message}</Text>
        <TouchableOpacity onPress={onHide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const tn = StyleSheet.create({
  wrap:    { position: 'absolute', bottom: 96, left: 16, right: 16, zIndex: 999 },
  inner:   { backgroundColor: '#1c1917', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 14, borderWidth: 1, borderColor: '#14532d' },
  iconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  text:    { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function MilestonesScreen({ navigation }) {
  const insets        = useSafeAreaInsets();
  const { user }      = useAuth();
  const { goals, profile } = useUserData();

  const [createOpen,  setCreateOpen]  = useState(false);
  const [addTarget,   setAddTarget]   = useState(null);
  const [detailGoal,  setDetailGoal]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [toastMsg,    setToastMsg]    = useState(null);

  const milestones = goals.filter(g => g.type === 'milestone');
  const active     = milestones.filter(g => (g.currentAmount ?? 0) <  (g.targetAmount ?? 0));
  const completed  = milestones.filter(g => (g.currentAmount ?? 0) >= (g.targetAmount ?? 0));

  const totalSaved  = milestones.reduce((s, g) => s + (g.currentAmount ?? 0), 0);
  const totalTarget = milestones.reduce((s, g) => s + (g.targetAmount ?? 0), 0);
  const overallPct  = totalTarget > 0 ? Math.min(totalSaved / totalTarget, 1) : 0;
  const barAnim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(barAnim, { toValue: overallPct, useNativeDriver: false, tension: 55, friction: 10 }).start();
  }, [overallPct]);

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(160);
  const a3 = useEntrance(240);

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'goals'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      setCreateOpen(false);
    } catch {
      Alert.alert('Error', 'Could not create milestone. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFunds = async (amount) => {
    if (!addTarget || isNaN(amount) || amount <= 0) return;

    const currentBalance = profile?.balance ?? 0;
    if (amount > currentBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${fmt(currentBalance)} available in your wallet.`,
      );
      return;
    }

    setSaving(true);
    try {
      const before       = addTarget.currentAmount ?? 0;
      const newAmt       = Math.min(before + amount, addTarget.targetAmount);
      const actualAmount = newAmt - before; // may be less than amount if near goal

      const justCompleted = newAmt >= addTarget.targetAmount;

      await Promise.all([
        // Update milestone progress
        updateDoc(doc(db, 'users', user.uid, 'goals', addTarget.id), {
          currentAmount: newAmt,
        }),
        // Deduct from wallet balance
        updateDoc(doc(db, 'users', user.uid), {
          balance:        increment(-actualAmount),
          totalAvailable: increment(-actualAmount),
        }),
        // Record deduction transaction
        addDoc(collection(db, 'users', user.uid, 'transactions'), {
          title:     `Milestone: ${addTarget.title}`,
          amount:    -actualAmount,
          type:      'milestone_manual',
          category:  'Savings',
          createdAt: serverTimestamp(),
        }),
      ]);

      // Milestone just hit its target — release the full saved amount back to wallet
      if (justCompleted) {
        await Promise.all([
          updateDoc(doc(db, 'users', user.uid), {
            balance:        increment(newAmt),
            totalAvailable: increment(newAmt),
          }),
          addDoc(collection(db, 'users', user.uid, 'transactions'), {
            title:     `Milestone Achieved: ${addTarget.title}`,
            amount:    newAmt,
            type:      'milestone_complete',
            category:  'Savings',
            createdAt: serverTimestamp(),
          }),
        ]);
        setToastMsg(`"${addTarget.title}" completed! ${fmt(newAmt)} added to your balance.`);
      }

      setAddTarget(null);
    } catch {
      Alert.alert('Error', 'Could not update milestone.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (goal) => {
    Alert.alert(
      'Delete Milestone',
      `Delete "${goal.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'goals', goal.id));
            } catch {
              Alert.alert('Error', 'Could not delete milestone.');
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
            <Text style={st.headerTitle}>Milestones</Text>
            <Text style={st.headerSub}>Track and lock your savings goals</Text>
          </View>
          <TouchableOpacity style={st.addBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Summary card ── */}
        {milestones.length > 0 && (
          <Animated.View style={[st.ph, a1]}>
            <View style={st.summaryCard}>
              <View style={st.summaryBlob} />
              <Text style={st.summaryLabel}>TOTAL SAVED</Text>
              <Text style={st.summaryAmt}>{fmt(totalSaved)}</Text>
              <Text style={st.summaryOf}>of {fmt(totalTarget)} goal</Text>
              <View style={st.summaryTrack}>
                <Animated.View style={[st.summaryFill, {
                  width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <View style={st.summaryStats}>
                <View style={st.summaryStatItem}>
                  <Text style={st.summaryStatVal}>{active.length}</Text>
                  <Text style={st.summaryStatLabel}>Active</Text>
                </View>
                <View style={st.summaryDivider} />
                <View style={st.summaryStatItem}>
                  <Text style={st.summaryStatVal}>{completed.length}</Text>
                  <Text style={st.summaryStatLabel}>Completed</Text>
                </View>
                <View style={st.summaryDivider} />
                <View style={st.summaryStatItem}>
                  <Text style={[st.summaryStatVal, { color: '#4ade80' }]}>{Math.round(overallPct * 100)}%</Text>
                  <Text style={st.summaryStatLabel}>Overall</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Active milestones ── */}
        <Animated.View style={[st.ph, { marginTop: 20 }, a2]}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>Active</Text>
            <Text style={st.sectionCount}>{active.length}</Text>
          </View>
          {active.length === 0 ? (
            <View style={st.emptyBox}>
              <Ionicons name="flag-outline" size={36} color="#d1d5db" />
              <Text style={st.emptyTitle}>No active milestones</Text>
              <Text style={st.emptySub}>Tap the + button to create your first savings goal</Text>
              <TouchableOpacity style={st.emptyBtn} onPress={() => setCreateOpen(true)} activeOpacity={0.85}>
                <Text style={st.emptyBtnTxt}>Create Milestone</Text>
              </TouchableOpacity>
            </View>
          ) : (
            active.map(g => (
              <MilestoneCard
                key={g.id}
                goal={g}
                onAdd={setAddTarget}
                onDelete={handleDelete}
                onOpen={setDetailGoal}
              />
            ))
          )}
        </Animated.View>

        {/* ── Completed ── */}
        {completed.length > 0 && (
          <Animated.View style={[st.ph, { marginTop: 20 }, a3]}>
            <View style={st.sectionRow}>
              <Text style={st.sectionTitle}>Completed</Text>
              <Text style={st.sectionCount}>{completed.length}</Text>
            </View>
            {completed.map(g => (
              <MilestoneCard key={g.id} goal={g} onAdd={() => {}} onDelete={handleDelete} />
            ))}
          </Animated.View>
        )}

      </ScrollView>

      <BottomNav activeTab="grid" navigation={navigation} bottomInset={insets.bottom || 10} />

      <CreateSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        saving={saving}
      />

      <AddFundsSheet
        visible={!!addTarget}
        goal={addTarget}
        onClose={() => setAddTarget(null)}
        onConfirm={handleAddFunds}
        saving={saving}
      />

      <MilestoneDetailSheet
        visible={!!detailGoal}
        goal={detailGoal}
        onClose={() => setDetailGoal(null)}
        onAdd={setAddTarget}
      />

      <CompletionToast message={toastMsg} onHide={() => setToastMsg(null)} />
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

  // Summary card
  summaryCard:    { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, overflow: 'hidden' },
  summaryBlob:    { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#7f1d1d', top: -40, right: -20, opacity: 0.6 },
  summaryLabel:   { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  summaryAmt:     { color: '#ffffff', fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  summaryOf:      { color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 18, marginTop: 4 },
  summaryTrack:   { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 18 },
  summaryFill:    { height: 6, backgroundColor: RED, borderRadius: 3 },
  summaryStats:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 },
  summaryStatItem:{ flex: 1, alignItems: 'center' },
  summaryStatVal: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  summaryStatLabel:{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: DARK, fontSize: 18, fontWeight: '800' },
  sectionCount: { color: '#9ca3af', fontSize: 14 },

  emptyBox:   { backgroundColor: '#ffffff', borderRadius: 20, padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { color: DARK, fontSize: 16, fontWeight: '700' },
  emptySub:   { color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { backgroundColor: RED, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13, marginTop: 6 },
  emptyBtnTxt:{ color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
