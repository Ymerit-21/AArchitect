import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';

const TABS = ['All', 'Experts', 'Unknown', 'New'];

// Derive a consistent color from a string (for avatar bg)
function colorFromStr(str = '') {
  const palette = ['#7c3aed','#dc2626','#0284c7','#d97706','#059669','#db2777','#0891b2','#65a30d'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function relativeTime(ts) {
  if (!ts) return '';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)           return 'Now';
  if (diff < 3600)         return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 2 * 86400)   return 'Yesterday';
  if (diff < 7 * 86400)   return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function useSlideIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 60, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, bg, online, size = 52 }) {
  const ini = initials(name);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[st.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg || colorFromStr(name) }]}>
        <Text style={[st.avatarTxt, { fontSize: size * 0.31 }]}>{ini}</Text>
      </View>
      {online && <View style={st.onlineDot} />}
    </View>
  );
}

// ── Conversation row ────────────────────────────────────────────────────────────
function ConvoRow({ item, uid, delay, navigation }) {
  const anim     = useSlideIn(delay);
  const unread   = item.unread?.[uid] ?? 0;
  const otherUid = item.participants?.find(p => p !== uid) ?? '';
  const name     = item.participantMeta?.[otherUid]?.name ?? 'Unknown';
  const bg       = item.participantMeta?.[otherUid]?.avatarBg ?? colorFromStr(name);
  const online   = item.participantMeta?.[otherUid]?.online ?? false;

  return (
    <Animated.View style={anim}>
      <TouchableOpacity
        style={st.row}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Conversation', {
          conversationId: item.id,
          name,
          avatarBg: bg,
          online,
          otherUid,
        })}
      >
        <Avatar name={name} bg={bg} online={online} />
        <View style={st.rowMid}>
          <Text style={st.rowName} numberOfLines={1}>{name}</Text>
          <Text style={[st.rowPreview, unread > 0 && st.rowPreviewBold]} numberOfLines={1}>
            {item.lastMessage || 'Start a conversation'}
          </Text>
        </View>
        <View style={st.rowRight}>
          <Text style={st.rowTime}>{relativeTime(item.lastMessageAt)}</Text>
          {unread > 0 && (
            <View style={st.badge}>
              <Text style={st.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function MessagesScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const [tab, setTab]     = useState('All');
  const [query_,  setQuery]  = useState('');
  const [convos,  setConvos] = useState([]);
  const [loading, setLoading]= useState(true);

  const headerAnim = useSlideIn(0);
  const searchAnim = useSlideIn(70);
  const tabAnim    = useSlideIn(140);

  // ── Firestore: real-time conversations ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setConvos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user]);

  // ── Filter logic ─────────────────────────────────────────────────────────────
  const filtered = convos.filter(c => {
    const otherUid  = c.participants?.find(p => p !== user?.uid) ?? '';
    const meta      = c.participantMeta?.[otherUid] ?? {};
    const name      = meta.name ?? '';
    const isExpert  = meta.isExpert ?? false;
    const unread    = c.unread?.[user?.uid] ?? 0;

    const matchTab =
      tab === 'All'     ? true :
      tab === 'Experts' ? isExpert :
      tab === 'Unknown' ? !isExpert :
      tab === 'New'     ? unread > 0 :
      true;

    const matchSearch =
      !query_ ||
      name.toLowerCase().includes(query_.toLowerCase()) ||
      (c.lastMessage ?? '').toLowerCase().includes(query_.toLowerCase());

    return matchTab && matchSearch;
  });

  // ── New conversation helper (creates a convo doc if none exists) ──────────────
  const startConversation = async (otherUid, otherMeta) => {
    if (!user) return;
    await addDoc(collection(db, 'conversations'), {
      participants: [user.uid, otherUid],
      participantMeta: {
        [user.uid]:  { name: user.displayName ?? 'Me',   avatarBg: colorFromStr(user.uid),   isExpert: false },
        [otherUid]:  { ...otherMeta },
      },
      lastMessage:   '',
      lastMessageAt: serverTimestamp(),
      unread:        { [user.uid]: 0, [otherUid]: 0 },
    });
  };

  const totalUnread = convos.reduce((sum, c) => sum + (c.unread?.[user?.uid] ?? 0), 0);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0ede6" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Animated.View style={[st.header, headerAnim]}>
        <Text style={st.title}>Messages</Text>
        {totalUnread > 0 && (
          <View style={st.headerBadge}>
            <Text style={st.headerBadgeTxt}>{totalUnread}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
      </Animated.View>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <Animated.View style={[st.searchRow, searchAnim]}>
        <View style={st.searchBox}>
          <Ionicons name="search-outline" size={17} color="#9ca3af" />
          <TextInput
            style={st.searchInput}
            placeholder="Search messages"
            placeholderTextColor="#9ca3af"
            value={query_}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query_.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={17} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Animated.View style={[st.tabRow, tabAnim]}>
        {TABS.map(t => {
          const count =
            t === 'New'     ? convos.filter(c => (c.unread?.[user?.uid] ?? 0) > 0).length :
            t === 'Experts' ? convos.filter(c => {
              const o = c.participants?.find(p => p !== user?.uid) ?? '';
              return c.participantMeta?.[o]?.isExpert;
            }).length : 0;
          return (
            <TouchableOpacity
              key={t}
              style={[st.tab, tab === t && st.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[st.tabTxt, tab === t && st.tabTxtActive]}>{t}</Text>
              {count > 0 && tab !== t && (
                <View style={st.tabDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* ── List ──────────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.listContent}
        ItemSeparatorComponent={() => <View style={st.separator} />}
        ListEmptyComponent={() => (
          <View style={st.empty}>
            {loading ? null : (
              <>
                <View style={st.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={36} color="#d1d5db" />
                </View>
                <Text style={st.emptyTitle}>
                  {tab === 'All' ? 'No messages yet' :
                   tab === 'Experts' ? 'No expert conversations' :
                   tab === 'New'     ? 'All caught up!' :
                   'No unknown contacts'}
                </Text>
                <Text style={st.emptyBody}>
                  {tab === 'All'
                    ? 'Conversations with experts and clients will appear here.'
                    : 'Switch to All to see all your messages.'}
                </Text>
              </>
            )}
          </View>
        )}
        renderItem={({ item, index }) => (
          <ConvoRow item={item} uid={user?.uid} delay={210 + index * 50} navigation={navigation} />
        )}
      />

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="messages" navigation={navigation} bottomInset={insets.bottom || 10} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede6' },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  title:           { color: '#111110', fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  headerBadge:     { backgroundColor: '#e63946', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  headerBadgeTxt:  { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  iconBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },

  // Search
  searchRow:   { paddingHorizontal: 20, marginBottom: 14 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  searchInput: { flex: 1, color: '#111110', fontSize: 14, padding: 0 },

  // Tabs
  tabRow:       { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 50, backgroundColor: '#e8e5de' },
  tabActive:    { backgroundColor: '#111110' },
  tabTxt:       { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  tabTxtActive: { color: '#ffffff' },
  tabDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e63946' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  separator:   { height: 1, backgroundColor: 'rgba(0,0,0,0.04)', marginLeft: 78 },

  // Row
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  rowMid:         { flex: 1, gap: 4 },
  rowName:        { color: '#111110', fontSize: 15, fontWeight: '700' },
  rowPreview:     { color: '#9ca3af', fontSize: 13 },
  rowPreviewBold: { color: '#374151', fontWeight: '600' },
  rowRight:       { alignItems: 'flex-end', gap: 6, minWidth: 60 },
  rowTime:        { color: '#9ca3af', fontSize: 12 },

  // Badge
  badge:    { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#111110', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeTxt: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  // Avatar
  avatar:    { alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#ffffff', fontWeight: '800' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#ffffff' },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: '#111110', fontSize: 17, fontWeight: '700' },
  emptyBody:  { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
