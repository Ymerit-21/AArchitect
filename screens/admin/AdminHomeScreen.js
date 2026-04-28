import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, Animated, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import AdminBottomNav from '../../components/AdminBottomNav';

function useSlideIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function StatCard({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity style={[st.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      <View style={[st.statIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.statValue}>{value}</Text>
        <Text style={st.statLabel}>{label}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color="#d1d5db" />}
    </TouchableOpacity>
  );
}

function ActivityItem({ icon, color, title, sub }) {
  return (
    <View style={st.actItem}>
      <View style={[st.actIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.actTitle} numberOfLines={1}>{title}</Text>
        <Text style={st.actSub}>{sub}</Text>
      </View>
    </View>
  );
}

export default function AdminHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [experts, setExperts] = useState([]);
  const [users,   setUsers]   = useState([]);

  const a0 = useSlideIn(0);
  const a1 = useSlideIn(80);
  const a2 = useSlideIn(160);
  const a3 = useSlideIn(240);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'experts'),
      snap => setExperts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('Admin experts listener:', err.code),
    );
    const u2 = onSnapshot(
      collection(db, 'users'),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('Admin users listener:', err.code),
    );
    return () => { u1(); u2(); };
  }, []);

  const pending  = experts.filter(e => !e.verified && e.isActive !== false);
  const verified = experts.filter(e => e.verified);
  const rejected = experts.filter(e => e.isActive === false);

  const recentExperts = [...experts]
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    .slice(0, 5);

  const recentUsers = [...users]
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    .slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0ede6" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.header, a0]}>
          <View>
            <Text style={st.greeting}>{greeting}</Text>
            <Text style={st.title}>Admin Dashboard</Text>
          </View>
            <TouchableOpacity style={st.signOutBtn} onPress={() => signOut(auth)} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#e63946" />
            <Text style={st.signOutTxt}>Sign out</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Expert stats ── */}
        <Animated.View style={[st.ph, a1]}>
          <Text style={st.sectionTitle}>Expert Applications</Text>
          <View style={st.statsCol}>
            <StatCard
              icon="time-outline"
              label="Pending review"
              value={pending.length}
              color="#f59e0b"
              onPress={() => navigation.navigate('AdminExperts', { tab: 'pending' })}
            />
            <StatCard
              icon="shield-checkmark-outline"
              label="Verified experts"
              value={verified.length}
              color="#16a34a"
              onPress={() => navigation.navigate('AdminExperts', { tab: 'verified' })}
            />
            <StatCard
              icon="close-circle-outline"
              label="Rejected"
              value={rejected.length}
              color="#dc2626"
              onPress={() => navigation.navigate('AdminExperts', { tab: 'rejected' })}
            />
          </View>
        </Animated.View>

        {/* ── User stats ── */}
        <Animated.View style={[st.ph, { marginTop: 20 }, a2]}>
          <Text style={st.sectionTitle}>Users</Text>
          <StatCard
            icon="people-outline"
            label="Registered users"
            value={users.length}
            color="#6366f1"
            onPress={() => navigation.navigate('AdminUsers')}
          />
        </Animated.View>

        {/* ── Recent activity ── */}
        <Animated.View style={[st.ph, { marginTop: 20 }, a3]}>
          <Text style={st.sectionTitle}>Recent Activity</Text>
          <View style={st.actCard}>
            {recentExperts.length === 0 && recentUsers.length === 0 ? (
              <Text style={st.emptyTxt}>No activity yet</Text>
            ) : (
              <>
                {recentExperts.map(e => (
                  <ActivityItem
                    key={`exp-${e.id}`}
                    icon="shield-checkmark-outline"
                    color="#f59e0b"
                    title={`${e.displayName} applied as ${e.profession}`}
                    sub={e.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}
                  />
                ))}
                {recentUsers.map(u => (
                  <ActivityItem
                    key={`usr-${u.id}`}
                    icon="person-add-outline"
                    color="#6366f1"
                    title={`${u.displayName ?? 'New user'} joined`}
                    sub={u.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}
                  />
                ))}
              </>
            )}
          </View>
        </Animated.View>

      </ScrollView>

      <AdminBottomNav
        activeTab="overview"
        navigation={navigation}
        bottomInset={insets.bottom || 10}
        pendingCount={pending.length}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede6' },
  ph:   { paddingHorizontal: 20 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  greeting:    { color: '#9ca3af', fontSize: 13, marginBottom: 2 },
  title:       { color: '#111110', fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  signOutBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: '#fecaca' },
  signOutTxt:  { color: '#e63946', fontSize: 13, fontWeight: '700' },

  sectionTitle: { color: '#111110', fontSize: 16, fontWeight: '800', marginBottom: 10 },

  statsCol: { gap: 10 },
  statCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 14 },
  statIcon:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#111110', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#9ca3af', fontSize: 13, marginTop: 1 },

  actCard:  { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, gap: 14 },
  actItem:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actTitle: { color: '#111110', fontSize: 13, fontWeight: '600' },
  actSub:   { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  emptyTxt: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});
