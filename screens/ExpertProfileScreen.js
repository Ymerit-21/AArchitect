import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, ActivityIndicator, Image, Platform,
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

const BG = '#f0ede6';

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
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Stat({ icon, value, label, color = '#e63946' }) {
  return (
    <View style={st.statPill}>
      <View style={[st.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ExpertProfileScreen({ route, navigation }) {
  const { expert } = route.params;
  const insets     = useSafeAreaInsets();
  const { user }   = useAuth();
  const { profile } = useUserData();
  const [messaging, setMessaging] = useState(false);

  const accentColor = profColor(expert.profession);

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(155);
  const a3 = useEntrance(230);
  const a4 = useEntrance(305);

  // ── Get or create conversation, then navigate ─────────────────────────────
  const handleMessage = async () => {
    if (!user) return;
    setMessaging(true);
    try {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
      );
      const snap = await getDocs(q);
      const existing = snap.docs.find(d => {
        const p = d.data().participants ?? [];
        return p.includes(expert.uid);
      });

      if (existing) {
        const d = existing.data();
        const meta = d.participantMeta?.[expert.uid] ?? {};
        navigation.navigate('Conversation', {
          conversationId: existing.id,
          name:           expert.displayName,
          avatarBg:       meta.avatarBg ?? accentColor,
          online:         meta.online   ?? false,
          otherUid:       expert.uid,
        });
        return;
      }

      // Create new conversation
      const myName   = profile?.displayName ?? user.displayName ?? 'You';
      const myBg     = profile?.bg ?? '#e63946';
      const expertBg = accentColor;

      const ref = await addDoc(collection(db, 'conversations'), {
        participants: [user.uid, expert.uid],
        participantMeta: {
          [user.uid]: {
            name:     myName,
            avatarBg: myBg,
            isExpert: false,
            online:   false,
          },
          [expert.uid]: {
            name:     expert.displayName,
            avatarBg: expertBg,
            isExpert: true,
            online:   false,
          },
        },
        lastMessage:   '',
        lastMessageAt: serverTimestamp(),
        unread: { [user.uid]: 0, [expert.uid]: 0 },
        createdAt: serverTimestamp(),
      });

      navigation.navigate('Conversation', {
        conversationId: ref.id,
        name:           expert.displayName,
        avatarBg:       expertBg,
        online:         false,
        otherUid:       expert.uid,
      });
    } catch (e) {
      console.warn('Message error:', e);
    } finally {
      setMessaging(false);
    }
  };

  const initials   = getInitials(expert.displayName);
  const avatarBg   = expert.bg ?? accentColor;
  const hasPhoto   = !!expert.passportPhotoUrl;
  const skills     = Array.isArray(expert.skills) ? expert.skills : [];
  const ratingStr  = (expert.rating ?? 0).toFixed(1);
  const reviewsStr = expert.reviews ?? 0;
  const priceStr   = expert.from ? `¢${expert.from}/visit` : 'Price TBD';
  const locStr     = expert.location?.label ?? expert.location?.city ?? 'Location not set';

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#111110" />

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <View style={st.hero}>
        {/* Back button */}
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
        </TouchableOpacity>

        {/* Avatar */}
        <Animated.View style={[st.avatarWrap, a0]}>
          {hasPhoto ? (
            <Image source={{ uri: expert.passportPhotoUrl }} style={st.avatarImg} />
          ) : (
            <View style={[st.avatarInitials, { backgroundColor: avatarBg }]}>
              <Text style={st.avatarInitialsTxt}>{initials}</Text>
            </View>
          )}
          {expert.verified && (
            <View style={st.verifiedBadge}>
              <Ionicons name="checkmark" size={11} color="#ffffff" />
            </View>
          )}
        </Animated.View>

        {/* Name + profession */}
        <Animated.View style={[{ alignItems: 'center', marginTop: 14 }, a1]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.heroName}>{expert.displayName}</Text>
            {expert.verified && (
              <Ionicons name="shield-checkmark" size={18} color="#60a5fa" />
            )}
          </View>
          <Text style={[st.heroProfession, { color: accentColor }]}>{expert.profession}</Text>
          {expert.isActive && (
            <View style={st.activePill}>
              <View style={st.activeDot} />
              <Text style={st.activeTxt}>Available</Text>
            </View>
          )}
        </Animated.View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Stats row ───────────────────────────────────────────────── */}
        <Animated.View style={[st.statsRow, a1]}>
          <Stat icon="star"            value={ratingStr}  label="Rating"   color="#f59e0b" />
          <View style={st.statDivider} />
          <Stat icon="people-outline"  value={reviewsStr} label="Reviews"  color="#6366f1" />
          <View style={st.statDivider} />
          <Stat icon="cash-outline"    value={priceStr}   label="Starting" color="#e63946" />
        </Animated.View>

        {/* ── Location card ───────────────────────────────────────────── */}
        <Animated.View style={[st.section, a2]}>
          <View style={st.sectionHeader}>
            <Ionicons name="location-outline" size={18} color="#e63946" />
            <Text style={st.sectionTitle}>Location</Text>
          </View>
          <View style={st.locRow}>
            <View style={st.locDot} />
            <Text style={st.locTxt}>{locStr}</Text>
          </View>
        </Animated.View>

        {/* ── Skills ──────────────────────────────────────────────────── */}
        {skills.length > 0 && (
          <Animated.View style={[st.section, a3]}>
            <View style={st.sectionHeader}>
              <Ionicons name="construct-outline" size={18} color="#e63946" />
              <Text style={st.sectionTitle}>Skills</Text>
            </View>
            <View style={st.skillsWrap}>
              {skills.map((s, i) => (
                <View key={i} style={[st.skillChip, { borderColor: `${accentColor}50` }]}>
                  <Text style={[st.skillTxt, { color: accentColor }]}>{s}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Bio ─────────────────────────────────────────────────────── */}
        {!!expert.bio && (
          <Animated.View style={[st.section, a4]}>
            <View style={st.sectionHeader}>
              <Ionicons name="person-outline" size={18} color="#e63946" />
              <Text style={st.sectionTitle}>About</Text>
            </View>
            <Text style={st.bioTxt}>{expert.bio}</Text>
          </Animated.View>
        )}

        {/* ── Reviews placeholder ─────────────────────────────────────── */}
        <Animated.View style={[st.section, a4]}>
          <View style={st.sectionHeader}>
            <Ionicons name="chatbubbles-outline" size={18} color="#e63946" />
            <Text style={st.sectionTitle}>Reviews</Text>
            <Text style={st.reviewCount}>{reviewsStr} total</Text>
          </View>
          {reviewsStr === 0 ? (
            <Text style={st.noReviewsTxt}>No reviews yet — be the first to hire {expert.displayName?.split(' ')[0]}.</Text>
          ) : (
            <Text style={st.noReviewsTxt}>Reviews will appear here.</Text>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <View style={[st.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={st.msgBtn}
          onPress={handleMessage}
          disabled={messaging}
          activeOpacity={0.85}
        >
          {messaging
            ? <ActivityIndicator size="small" color="#e63946" />
            : <>
                <Ionicons name="chatbubble-outline" size={18} color="#e63946" />
                <Text style={st.msgBtnTxt}>Message</Text>
              </>}
        </TouchableOpacity>

        <TouchableOpacity style={st.hireBtn} activeOpacity={0.85}>
          <Text style={st.hireBtnTxt}>Hire Now</Text>
          <Ionicons name="arrow-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Hero
  hero:       { backgroundColor: '#111110', alignItems: 'center', paddingTop: 10, paddingBottom: 32, paddingHorizontal: 24 },
  backBtn:    { position: 'absolute', top: 10, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  avatarWrap:         { position: 'relative', marginTop: 12 },
  avatarImg:          { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#ffffff' },
  avatarInitials:     { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)' },
  avatarInitialsTxt:  { color: '#ffffff', fontSize: 32, fontWeight: '800' },
  verifiedBadge:      { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#111110' },

  heroName:       { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroProfession: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  activePill:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 50, paddingHorizontal: 14, paddingVertical: 5 },
  activeDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10b981' },
  activeTxt:      { color: '#10b981', fontSize: 12, fontWeight: '600' },

  // Stats
  statsRow:    { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#ffffff', marginHorizontal: 20, marginTop: -18, borderRadius: 20, paddingVertical: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  statPill:    { flex: 1, alignItems: 'center', gap: 6 },
  statIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  statValue:   { color: '#111110', fontSize: 14, fontWeight: '800' },
  statLabel:   { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#f3f4f6', marginVertical: 4 },

  // Section
  section:       { backgroundColor: '#ffffff', marginHorizontal: 20, marginTop: 14, borderRadius: 18, padding: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle:  { color: '#111110', fontSize: 15, fontWeight: '700', flex: 1 },
  reviewCount:   { color: '#9ca3af', fontSize: 13 },

  // Location
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' },
  locTxt: { color: '#374151', fontSize: 14, fontWeight: '500', flex: 1 },

  // Skills
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50, backgroundColor: '#fef2f2', borderWidth: 1 },
  skillTxt:   { fontSize: 13, fontWeight: '600' },

  // Bio
  bioTxt: { color: '#374151', fontSize: 14, lineHeight: 22 },

  // No reviews
  noReviewsTxt: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 10 },
    }),
  },
  msgBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, backgroundColor: '#fef2f2', borderWidth: 1.5, borderColor: '#fecaca' },
  msgBtnTxt: { color: '#e63946', fontSize: 15, fontWeight: '700' },
  hireBtn:   { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, backgroundColor: '#e63946' },
  hireBtnTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
