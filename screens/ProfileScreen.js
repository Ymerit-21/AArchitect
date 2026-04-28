import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG    = '#f0ede6';
const DARK  = '#111110';
const RED   = '#e63946';
const GREEN = '#10b981';

function fmt(n) { return `¢${Number(n ?? 0).toFixed(2)}`; }

function getInitials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];
function avatarColor(uid = '') {
  return AVATAR_COLORS[(uid.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
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

// ── Menu row ──────────────────────────────────────────────────────────────────
function MenuItem({ icon, label, color, badge, badgeColor, badgeTextColor, onPress, last }) {
  return (
    <TouchableOpacity
      style={[st.menuItem, !last && st.menuBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[st.menuIcon, { backgroundColor: `${color}16` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={st.menuLabel}>{label}</Text>
      {badge && (
        <View style={[st.badge, { backgroundColor: badgeColor ?? '#f3f4f6' }]}>
          <Text style={[st.badgeTxt, { color: badgeTextColor ?? '#6b7280' }]}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets                          = useSafeAreaInsets();
  const { user }                        = useAuth();
  const { profile, goals, transactions} = useUserData();
  const [expertProfile, setExpertProfile] = useState(null);

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(160);
  const a3 = useEntrance(240);

  const name     = profile?.displayName ?? user?.displayName ?? 'User';
  const email    = user?.email ?? '';
  const balance  = profile?.balance ?? 0;
  const tier     = profile?.tier ?? 'Basic';
  const joinedAt = profile?.createdAt?.toDate?.()
    ?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';

  const initials = getInitials(name);
  const color    = avatarColor(user?.uid ?? '');

  const milestones = goals.filter(g => g.type === 'milestone');
  const budgets    = goals.filter(g => g.type === 'budget');

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'experts'), where('uid', '==', user.uid)))
      .then(snap => {
        if (!snap.empty) setExpertProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
      })
      .catch(() => {});
  }, [user?.uid]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
      ],
    );
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.header, a0]}>
          <Text style={st.headerTitle}>Profile</Text>
        </Animated.View>

        {/* ── Hero card ── */}
        <Animated.View style={[st.ph, a0]}>
          <View style={st.heroCard}>
            <View style={st.heroBlob1} />
            <View style={st.heroBlob2} />

            {/* Avatar */}
            <View style={[st.avatar, { backgroundColor: color }]}>
              <Text style={st.avatarTxt}>{initials}</Text>
            </View>

            <Text style={st.heroName}>{name}</Text>
            <Text style={st.heroEmail}>{email}</Text>

            {/* Tier + joined */}
            <View style={st.heroPillRow}>
              <View style={st.tierPill}>
                <Ionicons name="star" size={11} color="#f59e0b" />
                <Text style={st.tierTxt}>{tier} Tier</Text>
              </View>
              <View style={st.dot} />
              <Text style={st.joinTxt}>Joined {joinedAt}</Text>
            </View>

            {/* Expert status badge */}
            {expertProfile && (
              <View style={[st.expertBadge, {
                backgroundColor: expertProfile.verified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              }]}>
                <Ionicons
                  name={expertProfile.verified ? 'shield-checkmark' : 'time-outline'}
                  size={13}
                  color={expertProfile.verified ? '#4ade80' : '#fbbf24'}
                />
                <Text style={[st.expertBadgeTxt, { color: expertProfile.verified ? '#4ade80' : '#fbbf24' }]}>
                  {expertProfile.verified ? 'Verified Expert' : 'Expert Approval Pending'}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View style={st.statsRow}>
              <View style={st.statItem}>
                <Text style={st.statVal}>{fmt(balance)}</Text>
                <Text style={st.statLabel}>Balance</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <Text style={st.statVal}>{transactions.length}</Text>
                <Text style={st.statLabel}>Transactions</Text>
              </View>
              <View style={st.statDivider} />
              <View style={st.statItem}>
                <Text style={st.statVal}>{milestones.length + budgets.length}</Text>
                <Text style={st.statLabel}>Goals</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Account ── */}
        <Animated.View style={[st.ph, { marginTop: 22 }, a1]}>
          <Text style={st.sectionLabel}>Account</Text>
          <View style={st.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              color={DARK}
              onPress={() => {}}
            />
            {expertProfile ? (
              <MenuItem
                icon="shield-checkmark-outline"
                label="My Expert Profile"
                color="#3b82f6"
                badge={expertProfile.verified ? 'Verified' : 'Pending'}
                badgeColor={expertProfile.verified ? '#dcfce7' : '#fef3c7'}
                badgeTextColor={expertProfile.verified ? GREEN : '#d97706'}
                onPress={() => navigation.navigate('ExpertProfile', { expert: expertProfile })}
              />
            ) : (
              <MenuItem
                icon="briefcase-outline"
                label="Become an Expert"
                color="#a855f7"
                badge="New"
                badgeColor="#ede9fe"
                badgeTextColor="#7c3aed"
                onPress={() => navigation.navigate('BecomeExpert')}
              />
            )}
            <MenuItem
              icon="keypad-outline"
              label="Change PIN"
              color={DARK}
              last
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        {/* ── Finance ── */}
        <Animated.View style={[st.ph, { marginTop: 18 }, a2]}>
          <Text style={st.sectionLabel}>Finance</Text>
          <View style={st.menuCard}>
            <MenuItem
              icon="stats-chart-outline"
              label="Financial Hub"
              color={RED}
              onPress={() => navigation.navigate('FinancialHub')}
            />
            <MenuItem
              icon="flag-outline"
              label="Milestones"
              color="#6366f1"
              badge={milestones.length > 0 ? String(milestones.length) : null}
              badgeColor="#ede9fe"
              badgeTextColor="#6366f1"
              onPress={() => navigation.navigate('Milestones')}
            />
            <MenuItem
              icon="wallet-outline"
              label="Budgets"
              color={GREEN}
              badge={budgets.length > 0 ? String(budgets.length) : null}
              badgeColor="#dcfce7"
              badgeTextColor={GREEN}
              last
              onPress={() => navigation.navigate('Budget')}
            />
          </View>
        </Animated.View>

        {/* ── Support ── */}
        <Animated.View style={[st.ph, { marginTop: 18 }, a3]}>
          <Text style={st.sectionLabel}>Support</Text>
          <View style={st.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label="Help & Support"
              color={DARK}
              onPress={() => navigation.navigate('HelpSupport')}
            />
            <MenuItem
              icon="document-text-outline"
              label="Terms & Privacy"
              color={DARK}
              last
              onPress={() => {}}
            />
          </View>
        </Animated.View>

        {/* ── Sign out ── */}
        <Animated.View style={[st.ph, { marginTop: 18 }, a3]}>
          <TouchableOpacity style={st.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={RED} />
            <Text style={st.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.Text style={[st.version, a3]}>Architect v1.0.0</Animated.Text>

      </ScrollView>

      <BottomNav activeTab="profile" navigation={navigation} bottomInset={insets.bottom || 10} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  header:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },

  // Hero card
  heroCard:    { backgroundColor: '#1c1917', borderRadius: 28, padding: 24, alignItems: 'center', overflow: 'hidden' },
  heroBlob1:   { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#7f1d1d', top: -60, right: -40, opacity: 0.6 },
  heroBlob2:   { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#1e3a5f', bottom: -30, left: -30, opacity: 0.5 },
  avatar:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)' },
  avatarTxt:   { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  heroName:    { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroEmail:   { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 14 },

  heroPillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tierPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tierTxt:     { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  joinTxt:     { color: 'rgba(255,255,255,0.35)', fontSize: 12 },

  expertBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16 },
  expertBadgeTxt: { fontSize: 12, fontWeight: '700' },

  statsRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, width: '100%', marginTop: 4 },
  statItem:     { flex: 1, alignItems: 'center' },
  statVal:      { color: '#ffffff', fontSize: 17, fontWeight: '800', marginBottom: 3 },
  statLabel:    { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  statDivider:  { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Menu
  sectionLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' },
  menuCard:     { backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  menuBorder:   { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  menuIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuLabel:    { color: DARK, fontSize: 15, fontWeight: '600', flex: 1 },
  badge:        { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' },

  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fef2f2', borderRadius: 16, height: 54, borderWidth: 1, borderColor: '#fecaca' },
  signOutTxt: { color: RED, fontSize: 15, fontWeight: '700' },

  version: { color: '#d1d5db', fontSize: 12, textAlign: 'center', marginTop: 20 },
});
