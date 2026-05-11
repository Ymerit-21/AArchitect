import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG      = '#f0ede6';
const DARK    = '#1c1917';
const RED     = '#e63946';
const GREEN   = '#10b981';
const PURPLE  = '#6366f1';
const AMBER   = '#f59e0b';
const PINK    = '#ec4899';

// Case-insensitive color map — keys are lowercase
const CAT_COLOR_MAP = {
  food:       '#3b82f6',  // Blue
  transport:  '#10b981',  // Green
  other:      '#f59e0b',  // Amber
  others:     '#f59e0b',  // Amber
  shopping:   '#a855f7',  // Purple
  health:     '#6366f1',  // Indigo
  bills:      '#ec4899',  // Pink
  tools:      '#14b8a6',  // Teal
  education:  '#f97316',  // Orange
  utilities:  '#06b6d4',  // Cyan
  salary:     '#22c55e',  // Green
  groceries:  '#3b82f6',  // Blue
};

// Auto-assigned palette for any category not in the map above
const EXTRA_PALETTE = ['#8b5cf6','#f97316','#ec4899','#06b6d4','#84cc16','#e11d48','#0ea5e9'];

function getCatColor(name, fallbackIndex) {
  return CAT_COLOR_MAP[name.toLowerCase()] ?? EXTRA_PALETTE[fallbackIndex % EXTRA_PALETTE.length];
}

function fmt(n) { return `¢${Number(n ?? 0).toFixed(2)}`; }
function fmtShort(n) { return `¢${Number(n ?? 0).toFixed(0)}`; }

function useEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 430, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Cash flow bar chart (5 days, paired income / expense bars) ───────────────
function CashFlowChart({ dailyData }) {
  const maxVal = Math.max(...dailyData.flatMap(d => [d.income, d.expense]), 1);
  const HEIGHT = 80;
  const anims  = useRef(dailyData.map(() => ({
    inc: new Animated.Value(0),
    exp: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    Animated.stagger(60, anims.flatMap((a, i) => [
      Animated.spring(a.inc, { toValue: Math.max((dailyData[i].income  / maxVal) * HEIGHT, 4), useNativeDriver: false, tension: 65, friction: 10 }),
      Animated.spring(a.exp, { toValue: Math.max((dailyData[i].expense / maxVal) * HEIGHT, 4), useNativeDriver: false, tension: 65, friction: 10 }),
    ])).start();
  }, []);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HEIGHT + 28, gap: 6 }}>
        {dailyData.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              <Animated.View style={{ width: 8, height: anims[i].inc, backgroundColor: GREEN, borderRadius: 4 }} />
              <Animated.View style={{ width: 8, height: anims[i].exp, backgroundColor: RED,   borderRadius: 4 }} />
            </View>
            <Text style={ch.dayLbl}>{d.label}</Text>
          </View>
        ))}
      </View>
      {/* Legend */}
      <View style={ch.legend}>
        <View style={ch.legendItem}><View style={[ch.legendDot, { backgroundColor: GREEN }]} /><Text style={ch.legendTxt}>Income</Text></View>
        <View style={ch.legendItem}><View style={[ch.legendDot, { backgroundColor: RED   }]} /><Text style={ch.legendTxt}>Expenses</Text></View>
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  dayLbl:     { color: '#9ca3af', fontSize: 10, fontWeight: '500' },
  legend:     { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: '#9ca3af', fontSize: 12 },
});

// ── Pie chart helpers ─────────────────────────────────────────────────────────
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 359.9) {
    const t = polarToCartesian(cx, cy, r, 0);
    const b = polarToCartesian(cx, cy, r, 180);
    return `M ${t.x} ${t.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y} A ${r} ${r} 0 1 1 ${t.x} ${t.y} Z`;
  }
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end   = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

// ── Spending pie chart ────────────────────────────────────────────────────────
function SpendingPieChart({ categories, total }) {
  const SIZE  = 200;
  const cx    = SIZE / 2;
  const cy    = SIZE / 2;
  const R     = 86;
  const INNER = 50;

  // Assign colors upfront so chart segments and legend rows share the same color
  let unknownIdx = 0;
  let angle = 0;
  const slices = categories.map(([cat, amount]) => {
    const isKnown = !!CAT_COLOR_MAP[cat.toLowerCase()];
    const color   = isKnown ? CAT_COLOR_MAP[cat.toLowerCase()] : EXTRA_PALETTE[(unknownIdx++) % EXTRA_PALETTE.length];
    const sweep   = total > 0 ? (amount / total) * 360 : 0;
    const start   = angle;
    angle += sweep;
    return { cat, amount, color, start, end: angle };
  });

  return (
    <View>
      {/* Donut chart */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            {slices.map(({ cat, color, start, end }) => (
              <Path
                key={cat}
                d={slicePath(cx, cy, R, start, end)}
                fill={color}
                stroke="#ffffff"
                strokeWidth={3}
              />
            ))}
            <Circle cx={cx} cy={cy} r={INNER} fill="#ffffff" />
          </Svg>
          <View style={sp.centerOverlay}>
            <Text style={sp.centerLabel}>TOTAL</Text>
            <Text style={sp.centerAmt}>{fmtShort(total)}</Text>
          </View>
        </View>
      </View>

      {/* Legend rows */}
      {slices.map(({ cat, amount, color }) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        return (
          <View
            key={cat}
            style={[sp.catRow, { backgroundColor: `${color}14`, borderLeftColor: color }]}
          >
            <View style={[sp.dot, { backgroundColor: color }]} />
            <Text style={sp.catName}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            <View style={{ flex: 1 }} />
            <Text style={sp.catPct}>{pct}%</Text>
            <Text style={[sp.catAmt, { color }]}>{fmtShort(amount)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const sp = StyleSheet.create({
  centerOverlay: { position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  centerLabel:   { color: '#9ca3af', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  centerAmt:     { color: '#111110', fontSize: 20, fontWeight: '800', marginTop: 2 },
  catRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderLeftWidth: 4 },
  dot:     { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  catName: { color: '#374151', fontSize: 13, fontWeight: '600' },
  catPct:  { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginRight: 12 },
  catAmt:  { fontSize: 13, fontWeight: '800', minWidth: 36, textAlign: 'right' },
});

// ── Milestone card ────────────────────────────────────────────────────────────
function MilestoneCard({ goal }) {
  const pct     = goal.targetAmount > 0 ? Math.min((goal.currentAmount ?? 0) / goal.targetAmount, 1) : 0;
  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false, tension: 55, friction: 10 }).start();
  }, [pct]);

  return (
    <View style={ms.card}>
      <View style={ms.iconWrap}>
        <Ionicons name="flag-outline" size={20} color={RED} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ms.name} numberOfLines={1}>{goal.title}</Text>
        <Text style={ms.amounts}>{fmt(goal.currentAmount ?? 0)} / {fmt(goal.targetAmount)}</Text>
        <View style={ms.track}>
          <Animated.View style={[ms.fill, { width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
      </View>
      <Text style={ms.pct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

const ms = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 12, marginBottom: 10 },
  iconWrap:{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  name:    { color: '#111110', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  amounts: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  track:   { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  fill:    { height: 4, backgroundColor: RED, borderRadius: 2 },
  pct:     { color: RED, fontSize: 13, fontWeight: '800', width: 38, textAlign: 'right' },
});

// ── Budget card ───────────────────────────────────────────────────────────────
function BudgetCard({ goal }) {
  const spent   = Math.abs(goal.currentAmount ?? 0);
  const budget  = goal.targetAmount ?? 0;
  const pct     = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const over    = pct >= 1;
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fillAnim, { toValue: pct, useNativeDriver: false, tension: 55, friction: 10 }).start();
  }, [pct]);

  return (
    <View style={bg.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={[bg.dot, { backgroundColor: over ? RED : GREEN }]} />
        <Text style={bg.name}>{goal.title}</Text>
        <TouchableOpacity style={bg.delBtn}>
          <Ionicons name="trash-outline" size={14} color="#d1d5db" />
        </TouchableOpacity>
      </View>
      <View style={bg.track}>
        <Animated.View style={[bg.fill, {
          width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: over ? RED : GREEN,
        }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={bg.spent}>{fmt(spent)}</Text>
        <Text style={[bg.limit, over && { color: RED }]}>{over ? 'Over budget!' : `${fmt(budget)} limit`}</Text>
      </View>
    </View>
  );
}

const bg = StyleSheet.create({
  card:  { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 10 },
  dot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name:  { flex: 1, color: '#111110', fontSize: 14, fontWeight: '700' },
  delBtn:{ padding: 4 },
  track: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: 6, borderRadius: 3 },
  spent: { color: '#9ca3af', fontSize: 12 },
  limit: { color: '#6b7280', fontSize: 12 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function FinancialHubScreen({ navigation }) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const { profile, goals, transactions } = useUserData();

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(160);
  const a3 = useEntrance(240);
  const a4 = useEntrance(320);
  const a5 = useEntrance(400);

  const firstName = profile?.displayName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';

  // ── Derived financials ─────────────────────────────────────────────────────
  const totalDeposits = transactions.filter(t => t.amount > 0 && t.type !== 'income').reduce((s, t) => s + t.amount, 0);
  const totalIncome   = transactions.filter(t => t.amount > 0 && t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense  = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const balance       = profile?.balance ?? 0;

  // ── Cash flow: last 5 days ─────────────────────────────────────────────────
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dailyData = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i));
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dayTx = transactions.filter(t => {
      const td = t.createdAt?.toDate?.();
      return td && td >= d && td < next;
    });
    return {
      label:   DAY_LABELS[d.getDay()],
      income:  dayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      expense: dayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
    };
  });

  // ── Spending distribution ──────────────────────────────────────────────────
  const catMap = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const key = (t.category ?? 'other').toLowerCase();
    catMap[key] = (catMap[key] ?? 0) + Math.abs(t.amount);
  });
  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const catTotal   = categories.reduce((s, [, v]) => s + v, 0);

  // ── Goals split ────────────────────────────────────────────────────────────
  const milestones = goals.filter(g => g.type === 'milestone' && (g.currentAmount ?? 0) < (g.targetAmount ?? 0));
  const budgets    = goals.filter(g => g.type === 'budget');

  const miniAnims = useRef([0.3, 0.55, 0.9, 0.65, 0.45, 0.7, 1].map(v =>
    new Animated.Value(0)
  )).current;
  const miniVals = [0.3, 0.55, 0.9, 0.65, 0.45, 0.7, 1];
  useEffect(() => {
    Animated.stagger(55, miniAnims.map((a, i) =>
      Animated.spring(a, { toValue: miniVals[i] * 24, useNativeDriver: false, tension: 70, friction: 9 })
    )).start();
  }, []);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.header, a0]}>
          <View>
            <Text style={st.headerTitle}>Financial Hub</Text>
          </View>
          <TouchableOpacity style={st.addBtn} onPress={() => navigation.navigate('Milestones')}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Hero Balance Card ── */}
        <Animated.View style={[st.ph, a0]}>
          <View style={st.heroCard}>
            <View style={st.heroBlob1} />
            <View style={st.heroBlob2} />

            <View style={st.heroTop}>
              <View style={st.eliteBadge}>
                <View style={st.eliteDot} />
                <Text style={st.eliteTxt}>TOTAL BALANCE</Text>
              </View>
              <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.35)" />
            </View>

            <Text style={st.heroAmt}>{fmt(balance)}</Text>

            {/* Mini chart */}
            <View style={st.miniChartRow}>
              {miniAnims.map((anim, i) => (
                <Animated.View key={i} style={[st.miniBar, { height: anim }]} />
              ))}
            </View>

            {/* Deposits / Expenses row */}
            <View style={st.heroRow}>
              <View style={st.heroStatItem}>
                <View style={st.heroStatDot} />
                <View>
                  <Text style={st.heroStatLabel}>DEPOSITS</Text>
                  <Text style={[st.heroStatVal, { color: '#4ade80' }]}>{fmt(totalDeposits)}</Text>
                </View>
              </View>
              <View style={st.heroDivider} />
              <View style={st.heroStatItem}>
                <View style={[st.heroStatDot, { backgroundColor: '#a78bfa' }]} />
                <View>
                  <Text style={st.heroStatLabel}>INCOME</Text>
                  <Text style={[st.heroStatVal, { color: '#a78bfa' }]}>{fmt(totalIncome)}</Text>
                </View>
              </View>
              <View style={st.heroDivider} />
              <View style={st.heroStatItem}>
                <View style={[st.heroStatDot, { backgroundColor: RED }]} />
                <View>
                  <Text style={st.heroStatLabel}>EXPENSES</Text>
                  <Text style={[st.heroStatVal, { color: RED }]}>{fmt(totalExpense)}</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Quick stats row ── */}
        <Animated.View style={[st.ph, { marginTop: 14 }, a1]}>
          <View style={st.quickRow}>
            {[
              { icon: 'trending-up-outline',   label: 'Net Flow',     val: fmt(totalDeposits + totalIncome - totalExpense), color: (totalDeposits + totalIncome) >= totalExpense ? GREEN : RED },
              { icon: 'receipt-outline',       label: 'Transactions', val: transactions.length.toString(), color: PURPLE },
              { icon: 'calendar-outline',      label: 'This Month',   val: fmt(totalExpense),              color: AMBER  },
            ].map(item => (
              <View key={item.label} style={st.quickCard}>
                <View style={[st.quickIcon, { backgroundColor: `${item.color}18` }]}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={[st.quickVal, { color: item.color }]}>{item.val}</Text>
                <Text style={st.quickLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Cash Flow ── */}
        <Animated.View style={[st.ph, { marginTop: 14 }, a2]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <Text style={st.cardTitle}>Cash Flow</Text>
              <Text style={st.cardSub}>Last 5 days</Text>
            </View>
            {transactions.length === 0 ? (
              <View style={st.emptyChart}>
                <Ionicons name="bar-chart-outline" size={32} color="#e5e7eb" />
                <Text style={st.emptyTxt}>No transactions yet</Text>
              </View>
            ) : (
              <CashFlowChart dailyData={dailyData} />
            )}
          </View>
        </Animated.View>

        {/* ── Spending Distribution ── */}
        <Animated.View style={[st.ph, { marginTop: 14 }, a3]}>
          <View style={st.card}>
            <View style={st.cardHeader}>
              <Text style={st.cardTitle}>Spending Distribution</Text>
              <Text style={[st.cardSub, { color: RED, fontWeight: '700' }]}>{fmt(catTotal)}</Text>
            </View>
            {categories.length === 0 ? (
              <View style={st.emptyChart}>
                <Ionicons name="pie-chart-outline" size={32} color="#e5e7eb" />
                <Text style={st.emptyTxt}>No expense data yet</Text>
              </View>
            ) : (
              <SpendingPieChart categories={categories} total={catTotal} />
            )}
          </View>
        </Animated.View>

        {/* ── Active Milestones ── */}
        <Animated.View style={[st.ph, { marginTop: 14 }, a4]}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>Active Milestones</Text>
            <TouchableOpacity style={st.newBtn} onPress={() => navigation.navigate('Milestones')}>
              <Ionicons name="add" size={14} color={RED} />
              <Text style={st.newBtnTxt}>New</Text>
            </TouchableOpacity>
          </View>
          {milestones.length === 0 ? (
            <View style={[st.emptySection]}>
              <Ionicons name="flag-outline" size={28} color="#d1d5db" />
              <Text style={st.emptyTxt}>No active milestones</Text>
            </View>
          ) : (
            milestones.map(g => <MilestoneCard key={g.id} goal={g} />)
          )}
        </Animated.View>

        {/* ── Budgets ── */}
        <Animated.View style={[st.ph, { marginTop: 14 }, a5]}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>Budgets</Text>
            <TouchableOpacity style={st.newBtn} onPress={() => navigation.navigate('Budget')}>
              <Ionicons name="add" size={14} color={RED} />
              <Text style={st.newBtnTxt}>Add Budget</Text>
            </TouchableOpacity>
          </View>
          {budgets.length === 0 ? (
            <View style={st.emptySection}>
              <Ionicons name="wallet-outline" size={28} color="#d1d5db" />
              <Text style={st.emptyTxt}>No budgets set</Text>
            </View>
          ) : (
            budgets.map(g => <BudgetCard key={g.id} goal={g} />)
          )}
        </Animated.View>

      </ScrollView>

      <BottomNav activeTab="grid" navigation={navigation} bottomInset={insets.bottom || 10} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  headerSub:   { color: '#9ca3af', fontSize: 13, marginBottom: 2 },
  headerTitle: { color: '#111110', fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  addBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },

  // Hero card
  heroCard:    { backgroundColor: DARK, borderRadius: 24, padding: 22, overflow: 'hidden' },
  heroBlob1:   { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#7f1d1d', top: -50, right: 20, opacity: 0.7 },
  heroBlob2:   { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#7f1d1d', bottom: -40, right: -15, opacity: 0.45 },
  heroTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  eliteBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(230,57,70,0.18)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  eliteDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  eliteTxt:    { color: RED, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroAmt:     { color: '#ffffff', fontSize: 48, fontWeight: '800', letterSpacing: -1, marginBottom: 14 },
  miniChartRow:{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 20 },
  miniBar:     { width: 6, backgroundColor: RED, borderRadius: 2, opacity: 0.7 },
  heroRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 },
  heroStatItem:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStatDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  heroStatLabel:{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  heroStatVal:  { fontSize: 16, fontWeight: '800' },
  heroDivider:  { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },

  // Quick stats
  quickRow:  { flexDirection: 'row', gap: 10 },
  quickCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  quickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quickVal:  { fontSize: 14, fontWeight: '800' },
  quickLabel:{ color: '#9ca3af', fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // Generic card
  card:       { backgroundColor: '#ffffff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle:  { color: '#111110', fontSize: 16, fontWeight: '800' },
  cardSub:    { color: '#9ca3af', fontSize: 13 },

  // Section headers
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#111110', fontSize: 18, fontWeight: '800' },
  newBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#fecaca' },
  newBtnTxt:    { color: RED, fontSize: 13, fontWeight: '700' },

  // Empty states
  emptyChart:   { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptySection: { backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 28, alignItems: 'center', gap: 8 },
  emptyTxt:     { color: '#9ca3af', fontSize: 13 },
});
