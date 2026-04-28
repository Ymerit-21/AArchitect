import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return `¢${Number(n ?? 0).toFixed(2)}`;
}

function weeklyTotal(transactions) {
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return transactions
    .filter(t => t.createdAt?.toDate?.() >= monday)
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);
}

function toBars(transactions) {
  if (!transactions.length) return Array(14).fill(0.08);
  const amounts = transactions.map(t => Math.abs(t.amount ?? 0));
  const max     = Math.max(...amounts, 1);
  const bars    = amounts.map(a => a / max);
  while (bars.length < 14) bars.push(0.08);
  return bars.slice(0, 14);
}

// ── Reusable animated press card ───────────────────────────────────────────

function PressCard({ style, children, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const down  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const up    = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 120, friction: 6  }).start();

  const flat = StyleSheet.flatten(style) || {};
  const {
    flex, width, height, backgroundColor, borderRadius,
    shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation, overflow,
    ...contentStyle
  } = flat;

  const hasSizing = flex !== undefined || width !== undefined || height !== undefined;

  return (
    <Animated.View style={[{ flex, width, height, backgroundColor, borderRadius, shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation, overflow }, { transform: [{ scale }] }]}>
      <TouchableOpacity style={[contentStyle, hasSizing && { flex: 1 }]} onPress={onPress} onPressIn={down} onPressOut={up} activeOpacity={1}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Animated bar chart bars ────────────────────────────────────────────────

function ChartBars({ bars }) {
  const anims  = useRef(bars.map(() => new Animated.Value(0))).current;
  const maxIdx = bars.indexOf(Math.max(...bars));

  useEffect(() => {
    Animated.stagger(
      35,
      anims.map((a, i) =>
        Animated.spring(a, { toValue: Math.max(bars[i] * 64, 6), useNativeDriver: false, tension: 60, friction: 10 })
      )
    ).start();
  }, []);

  return (
    <View style={styles.barsRow}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, { height: anim }, i === maxIdx && styles.barActive]}
        />
      ))}
    </View>
  );
}

// ── Entrance animation hook ────────────────────────────────────────────────

function useSlideIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 55, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user }                         = useAuth();
  const { profile, goals, transactions, unreadCount } = useUserData();
  const insets                           = useSafeAreaInsets();
  const [experts, setExperts]            = useState([]);

  const firstName = profile?.displayName?.split(' ')[0]
    ?? user?.displayName?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'User';

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const balance        = fmt(profile?.balance);
  const totalAvailable = fmt(profile?.totalAvailable);
  const tier           = profile?.tier ?? 'ARCHITECT ELITE';
  const status         = profile?.status ?? 'Active';
  const bars           = toBars(transactions);
  const weekTotal      = weeklyTotal(transactions);
  const activeGoals    = goals.length;
  const milestone      = goals.find(g => g.type === 'milestone');
  const budgetPct      = profile?.monthlyBudget
    ? Math.round((profile.monthlySpent / profile.monthlyBudget) * 100)
    : 0;

  // Staggered entrance animations
  const headerAnim  = useSlideIn(0);
  const cardAnim    = useSlideIn(100);
  const actionsAnim = useSlideIn(200);
  const quickAnim   = useSlideIn(300);
  const goalsAnim   = useSlideIn(400);
  const activityAnim= useSlideIn(500);
  const marketAnim  = useSlideIn(620);
  const statsAnim   = useSlideIn(740);
  const recentAnim  = useSlideIn(860);

  // Mini chart bar pulse on balance card
  const miniAnims = useRef([0.4, 0.65, 1, 0.7, 0.5].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(60, miniAnims.map((a, i) =>
      Animated.spring(a, { toValue: [0.4,0.65,1,0.7,0.5][i] * 22, useNativeDriver: false, tension: 70, friction: 9 })
    )).start();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'experts'), snap => {
      setExperts(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e => e.uid !== user?.uid && e.id !== user?.uid),
      );
    });
    return unsub;
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0ede6" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <Animated.View style={[styles.header, headerAnim]}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            <PressCard style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="#111110" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </PressCard>
            <PressCard style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person" size={18} color="#ffffff" />
            </PressCard>
          </View>
        </Animated.View>

        {/* ── Balance Card ────────────────────────────────────────────── */}
        <Animated.View style={[styles.balanceCard, cardAnim]}>
          <View style={styles.blob1} />
          <View style={styles.blob2} />

          <View style={styles.cardTop}>
            <View style={styles.eliteBadge}>
              <View style={styles.eliteDot} />
              <Text style={styles.eliteText}>{tier}</Text>
            </View>
            <Text style={styles.dots}>···</Text>
          </View>

          <Text style={styles.balLabel}>MAIN BALANCE</Text>
          <Text style={styles.balAmount}>{balance}</Text>
          <Text style={styles.balSub}>
            Total available: <Text style={styles.balSubRed}>{totalAvailable}</Text>
          </Text>

          <View style={styles.cardBottom}>
            <Text style={styles.cardNames}>{firstName.toUpperCase()} · ARCHITECT</Text>
            <View style={styles.miniChart}>
              {miniAnims.map((anim, i) => (
                <Animated.View key={i} style={[styles.miniBar, { height: anim }]} />
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Action Buttons ──────────────────────────────────────────── */}
        <Animated.View style={[styles.actionRow, actionsAnim]}>
          <PressCard style={styles.actionBtnDark} onPress={() => navigation.navigate('AddFunds')}>
            <Ionicons name="add-outline" size={20} color="#ffffff" />
            <Text style={styles.actionTextDark}>Add funds</Text>
          </PressCard>
          <PressCard style={styles.actionBtnLight} onPress={() => navigation.navigate('Send')}>
            <Ionicons name="arrow-up-outline" size={18} color="#374151" />
            <Text style={styles.actionTextLight}>Send</Text>
          </PressCard>
        </Animated.View>

        {/* ── Quick Actions ───────────────────────────────────────────── */}
        <Animated.View style={[styles.quickRow, quickAnim]}>
          {[
            { icon: 'desktop-outline',   label: 'Log expense', route: 'LogExpense' },
            { icon: 'people-outline',    label: 'Experts',     route: 'BecomeExpert' },
            { icon: 'briefcase-outline', label: 'My jobs',     route: 'Jobs' },
          ].map((item, i) => (
            <PressCard key={item.label} style={styles.quickCard} onPress={() => item.route && navigation.navigate(item.route)}>
              <View style={styles.quickIcon}>
                <Ionicons name={item.icon} size={22} color="#c96b5a" />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </PressCard>
          ))}
        </Animated.View>

        {/* ── Goals & Budget ──────────────────────────────────────────── */}
        <Animated.View style={goalsAnim}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Goals & budget</Text>
          <View style={styles.goalsCard}>
            <View style={styles.goalRow}>
              <View style={styles.goalIcon}>
                <Ionicons name="flag-outline" size={18} color="#e63946" />
              </View>
              <Text style={styles.goalLabel}>
                {milestone ? milestone.title : 'No milestone set'}
              </Text>
              <Text style={styles.goalVal}>{fmt(milestone?.targetAmount ?? 0)}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.goalRow}>
              <View style={[styles.goalIcon, { backgroundColor: '#f9fafb' }]}>
                <Ionicons name="time-outline" size={18} color="#9ca3af" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalLabel}>Monthly budget</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(budgetPct, 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.goalVal}>{budgetPct}%</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Activity ────────────────────────────────────────────────── */}
        <Animated.View style={activityAnim}>
          <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {weekTotal > 0 && (
              <View style={styles.weekBadge}>
                <Text style={styles.weekText}>+{fmt(weekTotal)} this week</Text>
              </View>
            )}
          </View>
          <View style={styles.activityCard}>
            <Text style={styles.cashFlowLabel}>
              CASH FLOW · {new Date().toLocaleString('default', { month: 'short' }).toUpperCase()} {new Date().getFullYear()}
            </Text>
            <ChartBars bars={bars} />
          </View>
        </Animated.View>

        {/* ── Marketplace ─────────────────────────────────────────────── */}
        <Animated.View style={marketAnim}>
          <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Marketplace</Text>
            <TouchableOpacity onPress={() => navigation.navigate('BecomeExpert')}>
              <Text style={styles.viewAll}>+ Join</Text>
            </TouchableOpacity>
          </View>

          {experts.length === 0 ? (
            <View style={styles.emptyMarket}>
              <Ionicons name="people-outline" size={36} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No experts yet</Text>
              <Text style={styles.emptyBody}>Be the first to offer your services on Architect.</Text>
              <PressCard style={styles.emptyBtn} onPress={() => navigation.navigate('BecomeExpert')}>
                <Text style={styles.emptyBtnText}>Become an Expert</Text>
              </PressCard>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.expertScroll}
              contentContainerStyle={styles.expertContent}
            >
              {experts.map(e => (
                <PressCard key={e.id} style={styles.expertCard} onPress={() => navigation.navigate('ExpertProfile', { expert: e })}>
                  <View style={[styles.expertAvatar, { backgroundColor: e.bg }]}>
                    <Text style={styles.expertInitial}>{e.initials}</Text>
                  </View>
                  <View style={styles.expertNameRow}>
                    <Text style={styles.expertName} numberOfLines={1}>{e.displayName}</Text>
                    <Ionicons name="checkmark-circle" size={15} color="#e63946" />
                  </View>
                  <Text style={styles.expertRole}>{e.profession}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text style={styles.ratingText}>{(e.rating ?? 0).toFixed(1)} ({e.reviews ?? 0})</Text>
                  </View>
                  <Text style={styles.expertPrice}>From ¢{e.from}</Text>
                </PressCard>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* ── Stats Bar ───────────────────────────────────────────────── */}
        <Animated.View style={[styles.statsBar, statsAnim]}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{balance}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
          <View style={styles.statLine} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{activeGoals}</Text>
            <Text style={styles.statLabel}>Active goals</Text>
          </View>
          <View style={styles.statLine} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: status === 'Active' ? '#16a34a' : '#9ca3af' }]}>
              {status}
            </Text>
            <Text style={styles.statLabel}>Expert status</Text>
          </View>
        </Animated.View>

        {/* ── Recent Activity ─────────────────────────────────────────── */}
        <Animated.View style={recentAnim}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Activity</Text>
          <View style={styles.txCard}>
            {transactions.length === 0 ? (
              <View style={styles.txEmpty}>
                <Ionicons name="receipt-outline" size={28} color="#d1d5db" />
                <Text style={styles.txEmptyText}>No transactions yet</Text>
              </View>
            ) : (
              transactions.slice(0, 6).map((t, i) => (
                <View key={t.id || i}>
                  <View style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: (t.amount ?? 0) >= 0 ? '#dcfce7' : '#fef2f2' }]}>
                      <Ionicons
                        name={(t.amount ?? 0) >= 0 ? 'arrow-down-outline' : 'arrow-up-outline'}
                        size={16}
                        color={(t.amount ?? 0) >= 0 ? '#16a34a' : '#e63946'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {t.title || t.description || 'Transaction'}
                      </Text>
                      <Text style={styles.txDate}>
                        {t.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: (t.amount ?? 0) >= 0 ? '#16a34a' : '#111110' }]}>
                      {(t.amount ?? 0) >= 0 ? '+' : ''}{fmt(t.amount)}
                    </Text>
                  </View>
                  {i < Math.min(transactions.length, 6) - 1 && <View style={styles.txDivider} />}
                </View>
              ))
            )}
          </View>
        </Animated.View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Bottom Nav ──────────────────────────────────────────────────── */}
      <BottomNav activeTab="home" navigation={navigation} bottomInset={insets.bottom || 10} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f0ede6' },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16 },
  greeting:    { color: '#9ca3af', fontSize: 14, marginBottom: 2 },
  userName:    { color: '#111110', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  bellBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  bellBadge:    { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#f0ede6' },
  bellBadgeTxt: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
  avatarBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },

  // Balance Card
  balanceCard: { backgroundColor: '#1c1917', borderRadius: 24, padding: 22, overflow: 'hidden' },
  blob1: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#7f1d1d', top: -55, right: 30, opacity: 0.7 },
  blob2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#7f1d1d', bottom: -45, right: -20, opacity: 0.5 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  eliteBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(230,57,70,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  eliteDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e63946' },
  eliteText:  { color: '#e63946', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dots:       { color: 'rgba(255,255,255,0.4)', fontSize: 20, letterSpacing: 3 },
  balLabel:   { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  balAmount:  { color: '#ffffff', fontSize: 46, fontWeight: '800', letterSpacing: -1, marginBottom: 6 },
  balSub:     { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 32 },
  balSubRed:  { color: '#e63946', fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardNames:  { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  miniChart:  { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  miniBar:    { width: 6, backgroundColor: '#e63946', borderRadius: 2 },

  // Action Buttons
  actionRow:      { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtnDark:  { flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d2c28', borderRadius: 16, paddingVertical: 17, gap: 8 },
  actionBtnLight: { flex: 1,   flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e5de', borderRadius: 16, paddingVertical: 17, gap: 8 },
  actionTextDark: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  actionTextLight:{ color: '#374151', fontSize: 15, fontWeight: '600' },

  // Quick Actions
  quickRow:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickCard:  { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  quickIcon:  { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fce9e6', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: '#374151', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Shared
  sectionTitle: { color: '#111110', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  rowBetween:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Goals
  goalsCard:     { backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  goalRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  goalIcon:      { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  goalLabel:     { flex: 1, color: '#111110', fontSize: 14, fontWeight: '500' },
  goalVal:       { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  rowDivider:    { height: 1, backgroundColor: '#f3f4f6' },
  progressTrack: { marginTop: 8, height: 4, backgroundColor: '#f3f4f6', borderRadius: 2 },
  progressFill:  { height: 4, backgroundColor: '#e63946', borderRadius: 2 },

  // Activity
  weekBadge:     { backgroundColor: '#dcfce7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  weekText:      { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  activityCard:  { backgroundColor: '#ffffff', borderRadius: 18, padding: 16 },
  cashFlowLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 16 },
  barsRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 72 },
  bar:           { flex: 1, backgroundColor: '#fecaca', borderRadius: 4 },
  barActive:     { backgroundColor: '#e63946' },

  // Marketplace
  emptyMarket:  { backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyTitle:   { color: '#111110', fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptyBody:    { color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { backgroundColor: '#e63946', borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13 },
  emptyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  viewAll:      { color: '#e63946', fontSize: 14, fontWeight: '600' },
  expertScroll: { marginHorizontal: -20 },
  expertContent:{ paddingHorizontal: 20, gap: 12, paddingRight: 20 },
  expertCard:   { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, width: 158 },
  expertAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  expertInitial:{ color: '#ffffff', fontSize: 22, fontWeight: '800' },
  expertNameRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  expertName:   { color: '#111110', fontSize: 14, fontWeight: '700', flex: 1 },
  expertRole:   { color: '#9ca3af', fontSize: 13, marginBottom: 8 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  ratingText:   { color: '#6b7280', fontSize: 12 },
  expertPrice:  { color: '#e63946', fontSize: 13, fontWeight: '600' },

  // Recent Activity
  txCard:      { backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4 },
  txRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  txDivider:   { height: 1, backgroundColor: '#f3f4f6' },
  txIcon:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txTitle:     { color: '#111110', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  txDate:      { color: '#9ca3af', fontSize: 12 },
  txAmount:    { fontSize: 14, fontWeight: '700' },
  txEmpty:     { alignItems: 'center', paddingVertical: 28, gap: 8 },
  txEmptyText: { color: '#9ca3af', fontSize: 14 },

  // Stats Bar
  statsBar: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 18, marginTop: 16, paddingVertical: 18, paddingHorizontal: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal:  { color: '#111110', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel:{ color: '#9ca3af', fontSize: 12 },
  statLine: { width: 1, backgroundColor: '#f3f4f6' },

});
