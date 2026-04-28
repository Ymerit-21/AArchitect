import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import BottomNav from '../components/BottomNav';

function getInitials(name = '') {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

function StatPill({ label, count, color }) {
  return (
    <View style={[st.statPill, { backgroundColor: `${color}15` }]}>
      <Text style={[st.statCount, { color }]}>{count}</Text>
      <Text style={[st.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

function ExpertRow({ expert, onVerify, onReject, verifying }) {
  const [expanded, setExpanded] = useState(false);
  const isPending  = !expert.verified && expert.isActive !== false;
  const isVerified = expert.verified;
  const isRejected = expert.isActive === false;

  return (
    <View style={st.card}>
      {/* ── Header row ── */}
      <TouchableOpacity
        style={st.cardHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.8}
      >
        <View style={[st.avatar, { backgroundColor: expert.bg ?? '#e63946' }]}>
          <Text style={st.avatarTxt}>{getInitials(expert.displayName)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={st.name} numberOfLines={1}>{expert.displayName}</Text>
            {isVerified && <Ionicons name="shield-checkmark" size={14} color="#2563eb" />}
          </View>
          <Text style={st.profession}>{expert.profession}</Text>
          <Text style={st.ghanaNum}>{expert.ghanaCard}</Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[
            st.statusPill,
            isVerified  && { backgroundColor: '#dcfce7' },
            isPending   && { backgroundColor: '#fef9c3' },
            isRejected  && { backgroundColor: '#fee2e2' },
          ]}>
            <Text style={[
              st.statusTxt,
              isVerified  && { color: '#16a34a' },
              isPending   && { color: '#ca8a04' },
              isRejected  && { color: '#dc2626' },
            ]}>
              {isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#9ca3af"
          />
        </View>
      </TouchableOpacity>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={st.detail}>
          <View style={st.divider} />

          {/* Info grid */}
          <View style={st.infoGrid}>
            <View style={st.infoItem}>
              <Text style={st.infoLabel}>Location</Text>
              <Text style={st.infoVal}>{expert.location?.label ?? expert.location ?? '—'}</Text>
            </View>
            <View style={st.infoItem}>
              <Text style={st.infoLabel}>Starting Price</Text>
              <Text style={st.infoVal}>¢{expert.from ?? '—'}/visit</Text>
            </View>
            <View style={st.infoItem}>
              <Text style={st.infoLabel}>Skills</Text>
              <Text style={st.infoVal}>
                {Array.isArray(expert.skills) && expert.skills.length
                  ? expert.skills.join(', ')
                  : '—'}
              </Text>
            </View>
            <View style={st.infoItem}>
              <Text style={st.infoLabel}>Submitted</Text>
              <Text style={st.infoVal}>
                {expert.createdAt?.toDate?.()?.toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                }) ?? '—'}
              </Text>
            </View>
          </View>

          {/* Bio */}
          {!!expert.bio && (
            <View style={st.bioBox}>
              <Text style={st.infoLabel}>Bio</Text>
              <Text style={st.bioTxt}>{expert.bio}</Text>
            </View>
          )}

          {/* Passport photo */}
          {!!expert.passportPhotoUrl && (
            <View style={st.photoSection}>
              <Text style={st.photoLabel}>Passport Photo</Text>
              <Image source={{ uri: expert.passportPhotoUrl }} style={st.passportImg} resizeMode="cover" />
            </View>
          )}

          {/* Ghana Card photos */}
          {(expert.ghanaCardFrontUrl || expert.ghanaCardBackUrl) && (
            <View style={st.photoSection}>
              <Text style={st.photoLabel}>Ghana Card</Text>
              <View style={st.cardPhotoRow}>
                {expert.ghanaCardFrontUrl && (
                  <View style={{ flex: 1 }}>
                    <Text style={st.photoSide}>Front</Text>
                    <Image source={{ uri: expert.ghanaCardFrontUrl }} style={st.cardImg} resizeMode="cover" />
                  </View>
                )}
                {expert.ghanaCardBackUrl && (
                  <View style={{ flex: 1 }}>
                    <Text style={st.photoSide}>Back</Text>
                    <Image source={{ uri: expert.ghanaCardBackUrl }} style={st.cardImg} resizeMode="cover" />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Action buttons — only for pending */}
          {isPending && (
            <View style={st.actionRow}>
              <TouchableOpacity
                style={st.rejectBtn}
                onPress={() => onReject(expert)}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={16} color="#dc2626" />
                <Text style={st.rejectTxt}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.verifyBtn}
                onPress={() => onVerify(expert)}
                disabled={verifying === expert.id}
                activeOpacity={0.85}
              >
                {verifying === expert.id
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <>
                      <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
                      <Text style={st.verifyTxt}>Verify</Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}

          {/* Revoke for verified */}
          {isVerified && (
            <TouchableOpacity
              style={[st.rejectBtn, { alignSelf: 'flex-end', marginTop: 12 }]}
              onPress={() => onReject(expert)}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
              <Text style={st.rejectTxt}>Revoke verification</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const [experts,   setExperts]   = useState([]);
  const [tab,       setTab]       = useState('pending');
  const [verifying, setVerifying] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'experts'), snap => {
      setExperts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const pending  = experts.filter(e => !e.verified && e.isActive !== false);
  const verified = experts.filter(e => e.verified);
  const rejected = experts.filter(e => e.isActive === false);

  const displayed = tab === 'pending' ? pending : tab === 'verified' ? verified : rejected;

  const handleVerify = async (expert) => {
    setVerifying(expert.id);
    try {
      await updateDoc(doc(db, 'experts', expert.id), { verified: true, isActive: true });
    } catch (e) {
      Alert.alert('Error', 'Could not verify expert. Try again.');
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = (expert) => {
    Alert.alert(
      expert.verified ? 'Revoke verification' : 'Reject application',
      `Are you sure you want to ${expert.verified ? 'revoke' : 'reject'} ${expert.displayName}'s profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: expert.verified ? 'Revoke' : 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'experts', expert.id), { verified: false, isActive: false });
            } catch {
              Alert.alert('Error', 'Could not update expert. Try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0ede6" />

      {/* ── Header ── */}
      <View style={st.header}>
        <View>
          <Text style={st.headerTitle}>Admin Dashboard</Text>
          <Text style={st.headerSub}>Expert verification centre</Text>
        </View>
        <View style={st.shieldIcon}>
          <Ionicons name="shield-checkmark" size={22} color="#e63946" />
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={st.statsRow}>
        <StatPill label="Pending"  count={pending.length}  color="#ca8a04" />
        <StatPill label="Verified" count={verified.length} color="#16a34a" />
        <StatPill label="Rejected" count={rejected.length} color="#dc2626" />
      </View>

      {/* ── Tabs ── */}
      <View style={st.tabs}>
        {['pending', 'verified', 'rejected'].map(t => (
          <TouchableOpacity
            key={t}
            style={[st.tab, tab === t && st.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[st.tabTxt, tab === t && st.tabTxtActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Expert list ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.list}
      >
        {displayed.length === 0 ? (
          <View style={st.emptyWrap}>
            <Ionicons name="checkmark-done-outline" size={40} color="#d1d5db" />
            <Text style={st.emptyTxt}>No {tab} applications</Text>
          </View>
        ) : (
          displayed.map(e => (
            <ExpertRow
              key={e.id}
              expert={e}
              onVerify={handleVerify}
              onReject={handleReject}
              verifying={verifying}
            />
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav activeTab="grid" navigation={navigation} bottomInset={insets.bottom || 10} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0ede6' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { color: '#111110', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  headerSub:   { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  shieldIcon:  { width: 46, height: 46, borderRadius: 23, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statPill:  { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  statCount: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  tabs:       { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#e8e5de', borderRadius: 12, padding: 3, marginBottom: 14 },
  tab:        { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:  { backgroundColor: '#ffffff' },
  tabTxt:     { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  tabTxtActive:{ color: '#111110' },

  list: { paddingHorizontal: 20, gap: 12 },

  card:       { backgroundColor: '#ffffff', borderRadius: 18, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  name:       { color: '#111110', fontSize: 15, fontWeight: '700' },
  profession: { color: '#9ca3af', fontSize: 13, marginTop: 1 },
  ghanaNum:   { color: '#6b7280', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },

  statusPill: { backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },

  detail:  { paddingHorizontal: 16, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 14 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  infoItem: { width: '47%' },
  infoLabel:{ color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  infoVal:  { color: '#111110', fontSize: 13, fontWeight: '500' },

  bioBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 14 },
  bioTxt: { color: '#374151', fontSize: 13, lineHeight: 20, marginTop: 4 },

  photoSection:  { marginBottom: 14 },
  photoLabel:    { color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  passportImg:   { width: 100, height: 100, borderRadius: 12 },
  cardPhotoRow:  { flexDirection: 'row', gap: 10 },
  photoSide:     { color: '#9ca3af', fontSize: 11, marginBottom: 4 },
  cardImg:       { height: 90, borderRadius: 10 },

  actionRow:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  rejectTxt:  { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  verifyBtn:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: '#2563eb' },
  verifyTxt:  { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:  { color: '#9ca3af', fontSize: 15 },
});
