import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const DARK  = '#111110';
const CARD  = '#1c1917';
const MUTED = 'rgba(255,255,255,0.45)';

function getInitials(name = '') {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

const PROF_COLORS = {
  plumber:     '#6366f1',
  electrician: '#f59e0b',
  carpenter:   '#d97706',
  painter:     '#ec4899',
  cleaner:     '#10b981',
};
function profColor(str) {
  const key = Object.keys(PROF_COLORS).find(k => (str ?? '').toLowerCase().includes(k));
  return key ? PROF_COLORS[key] : '#e63946';
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

export default function ExpertProfileScreen({ route, navigation }) {
  const { expert }  = route.params;
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();

  const [messaging, setMessaging] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const accentColor = profColor(expert.profession);

  const a0 = useEntrance(0);
  const a1 = useEntrance(70);
  const a2 = useEntrance(140);
  const a3 = useEntrance(200);
  const a4 = useEntrance(260);
  const a5 = useEntrance(320);

  // ── Get or create conversation ─────────────────────────────────────────────
  const handleMessage = async () => {
    if (!user) return;
    setMessaging(true);
    try {
      const q    = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
      const snap = await getDocs(q);
      const existing = snap.docs.find(d => (d.data().participants ?? []).includes(expert.uid));

      if (existing) {
        const meta = existing.data().participantMeta?.[expert.uid] ?? {};
        navigation.navigate('Conversation', {
          conversationId: existing.id,
          name:           expert.displayName,
          avatarBg:       meta.avatarBg ?? accentColor,
          otherUid:       expert.uid,
        });
        return;
      }

      const myName   = profile?.displayName ?? user.displayName ?? 'You';
      const myBg     = profile?.bg ?? '#e63946';
      const ref = await addDoc(collection(db, 'conversations'), {
        participants: [user.uid, expert.uid],
        participantMeta: {
          [user.uid]:   { name: myName,            avatarBg: myBg,        isExpert: false, online: false },
          [expert.uid]: { name: expert.displayName, avatarBg: accentColor, isExpert: true,  online: false },
        },
        lastMessage:   '',
        lastMessageAt: serverTimestamp(),
        unread:        { [user.uid]: 0, [expert.uid]: 0 },
        createdAt:     serverTimestamp(),
      });

      navigation.navigate('Conversation', {
        conversationId: ref.id,
        name:           expert.displayName,
        avatarBg:       accentColor,
        otherUid:       expert.uid,
      });
    } catch (e) {
      console.warn('Message error:', e);
    } finally {
      setMessaging(false);
    }
  };

  const initials   = getInitials(expert.displayName);
  const hasPhoto   = !!expert.passportPhotoUrl;
  const skills     = Array.isArray(expert.skills) ? expert.skills : [];
  const rating     = (expert.rating ?? 0).toFixed(1);
  const reviews    = expert.reviews ?? 0;
  const price      = expert.from ? `¢${expert.from}` : '—';
  const locStr     = typeof expert.location === 'string' && expert.location
    ? expert.location
    : (expert.location?.label ?? expert.location?.city ?? null);

  const TABS = ['overview', 'reviews'];

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />

      {/* Back */}
      <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color="#ffffff" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <View style={st.hero}>
          <Animated.Text style={[st.serviceLabel, a0]}>SERVICE PROFESSIONAL</Animated.Text>

          {/* Avatar */}
          <Animated.View style={[st.avatarWrap, a0]}>
            {hasPhoto ? (
              <Image source={{ uri: expert.passportPhotoUrl }} style={st.avatarImg} />
            ) : (
              <View style={st.avatarCircle}>
                <Text style={st.avatarTxt}>{initials}</Text>
              </View>
            )}
            <View style={st.verifiedBadge}>
              <Ionicons name="checkmark" size={12} color="#ffffff" />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.Text style={[st.heroName, a1]}>{expert.displayName}</Animated.Text>

          {/* ★ Verified pill */}
          <Animated.View style={[st.verifiedPill, a1]}>
            <Ionicons name="star" size={13} color="#f59e0b" />
            <Text style={st.verifiedPillTxt}>Verified {expert.profession}</Text>
          </Animated.View>

          {/* Available pill */}
          {expert.isActive && (
            <Animated.View style={[st.availPill, a2]}>
              <View style={st.availDot} />
              <Text style={st.availTxt}>Available now</Text>
            </Animated.View>
          )}
        </View>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <View style={st.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={st.tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[st.tabTxt, activeTab === tab && st.tabTxtActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {activeTab === tab && <View style={st.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        <View style={st.statsStrip}>
          <View style={st.statCol}>
            <View style={[st.statIconBox, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="star" size={18} color="#f59e0b" />
            </View>
            <Text style={st.statVal}>{rating}</Text>
            <Text style={st.statLbl}>Rating</Text>
          </View>
          <View style={st.statLine} />
          <View style={st.statCol}>
            <View style={[st.statIconBox, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Ionicons name="person-outline" size={18} color="#6366f1" />
            </View>
            <Text style={st.statVal}>{reviews}</Text>
            <Text style={st.statLbl}>Reviews</Text>
          </View>
          <View style={st.statLine} />
          <View style={st.statCol}>
            <View style={[st.statIconBox, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
              <Ionicons name="bag-outline" size={18} color="#ec4899" />
            </View>
            <Text style={st.statVal}>{price}</Text>
            <Text style={st.statLbl}>Per visit</Text>
          </View>
        </View>

        {/* ── Overview content ───────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* About */}
            {!!expert.bio && (
              <Animated.View style={[st.card, a2]}>
                <View style={st.cardRow}>
                  <View style={[st.cardIconBox, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Ionicons name="person-outline" size={18} color="#f59e0b" />
                  </View>
                  <Text style={st.cardTitle}>About</Text>
                </View>
                <Text style={st.bioTxt}>{expert.bio}</Text>
              </Animated.View>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <Animated.View style={[st.card, a3]}>
                <View style={st.cardRow}>
                  <View style={[st.cardIconBox, { backgroundColor: 'rgba(230,57,70,0.15)' }]}>
                    <Ionicons name="star-outline" size={18} color="#e63946" />
                  </View>
                  <Text style={st.cardTitle}>Skills</Text>
                </View>
                <View style={st.chipsWrap}>
                  {skills.map((s, i) => (
                    <View key={i} style={st.chip}>
                      <Text style={st.chipTxt}>{s}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Location */}
            <Animated.View style={[st.card, a4]}>
              <View style={st.cardRow}>
                <View style={[st.cardIconBox, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
                  <Ionicons name="location-outline" size={18} color="#ec4899" />
                </View>
                <Text style={st.cardTitle}>Location</Text>
              </View>
              <View style={st.locRow}>
                <View style={[st.locDot, !locStr && { backgroundColor: '#e63946' }]} />
                <Text style={st.locTxt}>{locStr ?? 'Location not set'}</Text>
              </View>
            </Animated.View>

            {/* Reviews */}
            <Animated.View style={[st.card, a5]}>
              <View style={st.cardRow}>
                <View style={[st.cardIconBox, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                  <Ionicons name="stats-chart-outline" size={18} color="rgba(255,255,255,0.45)" />
                </View>
                <Text style={st.cardTitle}>Reviews · {reviews} total</Text>
              </View>
              {reviews === 0 ? (
                <View style={st.noReviewWrap}>
                  <Text style={st.noReviewTitle}>No reviews yet</Text>
                  <Text style={st.noReviewSub}>Be the first to hire {expert.displayName?.split(' ')[0]}</Text>
                </View>
              ) : (
                <Text style={st.noReviewSub}>Reviews will appear here.</Text>
              )}
            </Animated.View>
          </>
        )}

        {/* ── Reviews tab ────────────────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <Animated.View style={[st.card, a2]}>
            <View style={st.cardRow}>
              <View style={[st.cardIconBox, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                <Ionicons name="stats-chart-outline" size={18} color="rgba(255,255,255,0.45)" />
              </View>
              <Text style={st.cardTitle}>Reviews · {reviews} total</Text>
            </View>
            {reviews === 0 ? (
              <View style={st.noReviewWrap}>
                <Text style={st.noReviewTitle}>No reviews yet</Text>
                <Text style={st.noReviewSub}>Be the first to hire {expert.displayName?.split(' ')[0]}</Text>
              </View>
            ) : (
              <Text style={st.noReviewSub}>Reviews will appear here.</Text>
            )}
          </Animated.View>
        )}

      </ScrollView>

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <View style={[st.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={st.msgBtn}
          onPress={handleMessage}
          disabled={messaging}
          activeOpacity={0.8}
        >
          {messaging
            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
            : <>
                <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.8)" />
                <Text style={st.msgBtnTxt}>Message</Text>
              </>}
        </TouchableOpacity>

        <TouchableOpacity
          style={st.hireBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Hire', { expert })}
        >
          <Text style={st.hireBtnTxt}>Hire now</Text>
          <Ionicons name="arrow-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: DARK },

  // Back
  backBtn: {
    position: 'absolute', top: 16, left: 20, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero
  hero: {
    backgroundColor: DARK,
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 24,
    gap: 14,
  },
  serviceLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  avatarWrap:   { position: 'relative' },
  avatarImg:    { width: 112, height: 112, borderRadius: 56, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  avatarCircle: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: '#2a2927',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarTxt: { color: '#ffffff', fontSize: 38, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute', bottom: 5, right: 5,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#22c55e',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: DARK,
  },

  heroName: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 7,
  },
  verifiedPillTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  availPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(16,185,129,0.14)',
    borderRadius: 50, paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  availTxt: { color: '#10b981', fontSize: 13, fontWeight: '600' },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 16, position: 'relative',
  },
  tabTxt: {
    color: MUTED, fontSize: 14, fontWeight: '600',
  },
  tabTxtActive: { color: '#ffffff' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, backgroundColor: '#ffffff', borderRadius: 2,
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    paddingVertical: 20,
  },
  statCol:     { flex: 1, alignItems: 'center', gap: 6 },
  statLine:    { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },
  statIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statVal:     { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  statLbl:     { color: MUTED, fontSize: 11, fontWeight: '500' },

  // Cards
  card: {
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconBox:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  // Bio
  bioTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22 },

  // Skills chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },

  // Location
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#10b981' },
  locTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '500', flex: 1 },

  // Reviews placeholder
  noReviewWrap:  { alignItems: 'center', paddingVertical: 12, gap: 4 },
  noReviewTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  noReviewSub:   { color: MUTED, fontSize: 13, textAlign: 'center' },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#161614',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  msgBtnTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  hireBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14,
    backgroundColor: '#0d0d0b',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  hireBtnTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
