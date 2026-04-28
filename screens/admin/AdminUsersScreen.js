import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import AdminBottomNav from '../../components/AdminBottomNav';

const ADMIN_EMAIL = 'admin1234@test.com';

function getInitials(name = '') {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

function fmt(n) {
  return `¢${Number(n ?? 0).toFixed(2)}`;
}

const AVATAR_COLORS = ['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'];
function avatarColor(uid = '') {
  return AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];
}

function UserRow({ user, onSuspend, onUnsuspend, loading }) {
  const [expanded, setExpanded] = useState(false);
  const isSuspended = !!user.suspended;
  const isAdmin     = user.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <View style={st.card}>
      <TouchableOpacity style={st.cardHeader} onPress={() => setExpanded(v => !v)} activeOpacity={0.8}>
        <View style={[st.avatar, { backgroundColor: avatarColor(user.id) }]}>
          <Text style={st.avatarTxt}>{getInitials(user.displayName)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={1}>{user.displayName ?? 'Unnamed user'}</Text>
          <Text style={st.email} numberOfLines={1}>{user.email ?? '—'}</Text>
          <Text style={st.joined}>
            Joined {user.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {isAdmin ? (
            <View style={[st.statusPill, { backgroundColor: '#ede9fe' }]}>
              <Text style={[st.statusTxt, { color: '#7c3aed' }]}>Admin</Text>
            </View>
          ) : isSuspended ? (
            <View style={[st.statusPill, { backgroundColor: '#fee2e2' }]}>
              <Text style={[st.statusTxt, { color: '#dc2626' }]}>Suspended</Text>
            </View>
          ) : (
            <View style={[st.statusPill, { backgroundColor: '#dcfce7' }]}>
              <Text style={[st.statusTxt, { color: '#16a34a' }]}>Active</Text>
            </View>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={st.detail}>
          <View style={st.divider} />

          <View style={st.infoGrid}>
            {[
              { label: 'Balance',         value: fmt(user.balance)        },
              { label: 'Total Available', value: fmt(user.totalAvailable) },
              { label: 'Tier',            value: user.tier ?? '—'         },
              { label: 'Status',          value: user.status ?? 'Active'  },
            ].map(({ label, value }) => (
              <View key={label} style={st.infoItem}>
                <Text style={st.infoLabel}>{label}</Text>
                <Text style={st.infoVal}>{value}</Text>
              </View>
            ))}
          </View>

          {!isAdmin && (
            <View style={st.actionRow}>
              {isSuspended ? (
                <TouchableOpacity
                  style={st.unsuspendBtn}
                  onPress={() => onUnsuspend(user)}
                  disabled={loading === user.id}
                  activeOpacity={0.85}
                >
                  {loading === user.id
                    ? <ActivityIndicator size="small" color="#16a34a" />
                    : <><Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" /><Text style={st.unsuspendTxt}>Unsuspend</Text></>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={st.suspendBtn}
                  onPress={() => onSuspend(user)}
                  disabled={loading === user.id}
                  activeOpacity={0.85}
                >
                  {loading === user.id
                    ? <ActivityIndicator size="small" color="#dc2626" />
                    : <><Ionicons name="ban-outline" size={16} color="#dc2626" /><Text style={st.suspendTxt}>Suspend account</Text></>}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminUsersScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const [users,   setUsers]   = useState([]);
  const [experts, setExperts] = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'users'),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('Admin users listener:', err.code),
    );
    const u2 = onSnapshot(
      collection(db, 'experts'),
      snap => setExperts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn('Admin experts listener:', err.code),
    );
    return () => { u1(); u2(); };
  }, []);

  const pending = experts.filter(e => !e.verified && e.isActive !== false).length;

  const displayed = users.filter(u =>
    !search ||
    (u.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email       ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const active    = displayed.filter(u => !u.suspended && u.email?.toLowerCase() !== ADMIN_EMAIL).length;
  const suspended = displayed.filter(u =>  u.suspended).length;

  const handleSuspend = (user) => {
    Alert.alert(
      'Suspend account',
      `Suspend ${user.displayName ?? user.email}? They will not be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setLoading(user.id);
            try {
              await updateDoc(doc(db, 'users', user.id), { suspended: true });
            } catch {
              Alert.alert('Error', 'Could not suspend user.');
            } finally {
              setLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleUnsuspend = async (user) => {
    setLoading(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), { suspended: false });
    } catch {
      Alert.alert('Error', 'Could not unsuspend user.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0ede6" />

      {/* Header */}
      <View style={st.header}>
        <View>
          <Text style={st.title}>Users</Text>
          <Text style={st.sub}>{users.length} registered · {active} active · {suspended} suspended</Text>
        </View>
        <View style={st.peopleBadge}>
          <Ionicons name="people-outline" size={22} color="#e63946" />
        </View>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" />
        <Text
          style={st.searchInput}
          onPress={() => {}}
        />
        {/* Simple search — use TextInput */}
        <View style={{ flex: 1 }}>
          <TextInputSearch value={search} onChange={setSearch} />
        </View>
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.list}>
        {displayed.length === 0 ? (
          <View style={st.emptyWrap}>
            <Ionicons name="people-outline" size={48} color="#d1d5db" />
            <Text style={st.emptyTxt}>No users found</Text>
          </View>
        ) : (
          displayed.map(u => (
            <UserRow
              key={u.id}
              user={u}
              onSuspend={handleSuspend}
              onUnsuspend={handleUnsuspend}
              loading={loading}
            />
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <AdminBottomNav
        activeTab="users"
        navigation={navigation}
        bottomInset={insets.bottom || 10}
        pendingCount={pending}
      />
    </View>
  );
}

import { TextInput } from 'react-native';
function TextInputSearch({ value, onChange }) {
  return (
    <TextInput
      style={{ color: '#111110', fontSize: 14, padding: 0 }}
      placeholder="Search name or email…"
      placeholderTextColor="#c4c4c4"
      value={value}
      onChangeText={onChange}
    />
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede6' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title:       { color: '#111110', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  sub:         { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  peopleBadge: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  searchInput:{ flex: 1 },

  list: { paddingHorizontal: 20, gap: 12 },

  card:       { backgroundColor: '#ffffff', borderRadius: 18, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  name:       { color: '#111110', fontSize: 15, fontWeight: '700' },
  email:      { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  joined:     { color: '#c4c4c4', fontSize: 11, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  detail:  { paddingHorizontal: 16, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 14 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  infoItem: { width: '47%' },
  infoLabel:{ color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  infoVal:  { color: '#111110', fontSize: 13, fontWeight: '600' },

  actionRow:    { marginTop: 4 },
  suspendBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  suspendTxt:   { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  unsuspendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  unsuspendTxt: { color: '#16a34a', fontSize: 14, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:  { color: '#9ca3af', fontSize: 15 },
});
