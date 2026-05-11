import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const DARK  = '#111110';
const CARD  = '#1c1917';
const INPUT = '#141412';
const GREEN = '#22c55e';
const RED   = '#e63946';
const MUTED = 'rgba(255,255,255,0.4)';

const AVATAR_COLORS = ['#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];
function avatarColor(uid = '') {
  return AVATAR_COLORS[(uid?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}
function initials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function Section({ label, children }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>{label}</Text>
      <View style={st.card}>{children}</View>
    </View>
  );
}

function Row({ icon, color, label, value, multiline }) {
  return (
    <View style={st.row}>
      <View style={[st.rowIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        <Text style={[st.rowValue, multiline && { lineHeight: 20 }]} numberOfLines={multiline ? 6 : 2}>
          {value ?? '—'}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={st.divider} />;
}

export default function BookingDetailScreen({ navigation, route }) {
  const { notif } = route.params ?? {};
  const insets    = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();

  const [job,       setJob]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!notif?.jobId) { setLoading(false); return; }
    getDoc(doc(db, 'jobs', notif.jobId))
      .then(snap => { if (snap.exists()) setJob({ id: snap.id, ...snap.data() }); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // mark notification read
    if (notif?.id && user?.uid && !notif.read) {
      updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true }).catch(() => {});
    }
  }, [notif?.jobId]);

  const handleAction = async (status) => {
    if (!job || actioning) return;
    setActioning(true);
    try {
      await updateDoc(doc(db, 'jobs', job.id), { status });
      setJob(j => ({ ...j, status }));

      // Notify the client about the accept / decline
      const clientId   = job.clientId;
      const expertName = profile?.displayName ?? user?.displayName ?? 'Your expert';
      if (clientId) {
        const isAccepted = status === 'accepted';
        await addDoc(collection(db, 'users', clientId, 'notifications'), {
          type:      'booking',
          title:     isAccepted ? '🎉 Booking Accepted!' : 'Booking Declined',
          body:      isAccepted
            ? `${expertName} has accepted your booking for ${job.category}. They'll be there on ${job.date} at ${job.time}.`
            : `${expertName} has declined your booking for ${job.category} on ${job.date}. Please try booking another expert.`,
          jobId:     job.id,
          clientId,
          clientName: job.clientName,
          read:      false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioning(false);
    }
  };

  const clientName     = job?.clientName ?? notif?.clientName ?? 'Client';
  const clientId       = job?.clientId   ?? notif?.clientId;
  const clientBg       = avatarColor(clientId ?? clientName);
  const statusColor    = job?.status === 'accepted' ? GREEN : job?.status === 'declined' ? RED : job?.status === 'completed' ? '#3b82f6' : '#f59e0b';
  const statusLabel    = job?.status === 'accepted' ? 'Accepted' : job?.status === 'declined' ? 'Declined' : job?.status === 'completed' ? 'Completed' : 'Pending';

  const handleJobDone = async () => {
    if (!job || actioning) return;
    setActioning(true);
    try {
      await updateDoc(doc(db, 'jobs', job.id), { status: 'completed' });
      setJob(j => ({ ...j, status: 'completed' }));

      const clientId   = job.clientId;
      const expertName = profile?.displayName ?? user?.displayName ?? 'Your expert';
      if (clientId) {
        await addDoc(collection(db, 'users', clientId, 'notifications'), {
          type:       'review_request',
          title:      'How was the service?',
          body:       `${expertName} has completed your ${job.category} job. Rate and review your experience!`,
          jobId:      job.id,
          expertId:   user.uid,
          expertName,
          category:   job.category   ?? '',
          profession: job.profession ?? '',
          clientId,
          read:       false,
          createdAt:  serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioning(false);
    }
  };

  const handleMessage = () => {
    if (!clientId || !user?.uid) return;
    const conversationId = [user.uid, clientId].sort().join('_');
    navigation.navigate('Conversation', {
      conversationId,
      otherUid:  clientId,
      otherName: clientName,
      avatarBg:  clientBg,
    });
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />

      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={st.centerTxt}>Loading details…</Text>
        </View>
      ) : !job ? (
        <View style={st.center}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={st.centerTxt}>Booking not found</Text>
          <TouchableOpacity style={st.goBackPill} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={st.goBackPillTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 110 }]}
          >
            {/* ── Client card ── */}
            <View style={st.clientCard}>
              <View style={[st.clientAvatar, { backgroundColor: clientBg }]}>
                <Text style={st.clientInitials}>{initials(clientName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.clientName}>{clientName}</Text>
                <Text style={st.clientSub}>
                  wants to hire you for{' '}
                  <Text style={{ color: '#f59e0b', fontWeight: '700' }}>{job.profession}</Text>
                </Text>
              </View>
              <View style={[st.statusBadge, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}18` }]}>
                <View style={[st.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[st.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>

            {/* ── Message button ── */}
            <TouchableOpacity style={st.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
              <View style={st.msgIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.msgBtnTitle}>Message {clientName.split(' ')[0]}</Text>
                <Text style={st.msgBtnSub}>Chat directly with the client</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TouchableOpacity>

            {/* ── Job details ── */}
            <Section label="Job Details">
              <Row icon="construct-outline"      color="#6366f1" label="Category"    value={job.category} />
              <Divider />
              <Row icon="document-text-outline"  color="#f59e0b" label="Description" value={job.description} multiline />
            </Section>

            {/* ── Schedule ── */}
            <Section label="Schedule">
              <Row icon="calendar-outline" color="#3b82f6" label="Date" value={job.date} />
              <Divider />
              <Row icon="time-outline"     color="#a855f7" label="Time" value={job.time} />
            </Section>

            {/* ── Location ── */}
            <Section label="Location">
              <Row icon="location-outline"      color="#ec4899" label="Address" value={job.address} multiline />
              {!!job.note && (
                <>
                  <Divider />
                  <Row icon="chatbubble-outline" color="#9ca3af" label="Note"    value={job.note} multiline />
                </>
              )}
            </Section>

            {/* ── Payment ── */}
            <Section label="Payment">
              <View style={st.payRow}>
                <View style={st.payLeft}>
                  <View style={st.payIconWrap}>
                    <Ionicons name="cash-outline" size={20} color={GREEN} />
                  </View>
                  <View>
                    <Text style={st.payTitle}>Pay on-site</Text>
                    <Text style={st.paySub}>Collect directly from client</Text>
                  </View>
                </View>
                <Text style={st.payAmount}>¢{(job.budget ?? 0).toFixed(2)}</Text>
              </View>
            </Section>
          </ScrollView>

          {/* ── Bottom action bar ── */}
          <View style={[st.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            {job.status === 'pending' ? (
              <>
                <TouchableOpacity
                  style={[st.actionBtn, st.declineBtn, actioning && { opacity: 0.5 }]}
                  onPress={() => handleAction('declined')}
                  disabled={actioning}
                  activeOpacity={0.85}
                >
                  {actioning
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <>
                        <Ionicons name="close-circle-outline" size={20} color="#ffffff" />
                        <Text style={st.actionBtnTxt}>Decline</Text>
                      </>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.actionBtn, st.acceptBtn, actioning && { opacity: 0.5 }]}
                  onPress={() => handleAction('accepted')}
                  disabled={actioning}
                  activeOpacity={0.85}
                >
                  {actioning
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                        <Text style={st.actionBtnTxt}>Accept</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            ) : job.status === 'accepted' && user?.uid === job?.expertId ? (
              <>
                <TouchableOpacity style={[st.actionBtn, st.msgSolidBtn]} onPress={handleMessage} activeOpacity={0.85}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" />
                  <Text style={st.actionBtnTxt}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.actionBtn, st.jobDoneBtn, actioning && { opacity: 0.5 }]}
                  onPress={handleJobDone}
                  disabled={actioning}
                  activeOpacity={0.85}
                >
                  {actioning
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <>
                        <Ionicons name="checkmark-done-circle-outline" size={20} color="#ffffff" />
                        <Text style={st.actionBtnTxt}>Job Done</Text>
                      </>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[st.actionBtn, st.msgSolidBtn]} onPress={handleMessage} activeOpacity={0.85}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" />
                <Text style={st.actionBtnTxt}>Message {clientName.split(' ')[0]}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DARK },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  centerTxt:   { color: MUTED, fontSize: 15 },
  goBackPill:  { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 50, backgroundColor: CARD, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  goBackPillTxt:{ color: '#ffffff', fontSize: 14, fontWeight: '700' },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // Client card
  clientCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 20, padding: 16, marginBottom: 12 },
  clientAvatar:   { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  clientInitials: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  clientName:     { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  clientSub:      { color: MUTED, fontSize: 13, marginTop: 3 },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusTxt:      { fontSize: 12, fontWeight: '700' },

  // Message button
  msgBtn:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', marginBottom: 20 },
  msgIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(59,130,246,0.18)', alignItems: 'center', justifyContent: 'center' },
  msgBtnTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  msgBtnSub:   { color: MUTED, fontSize: 12, marginTop: 2 },

  // Sections
  section:      { marginBottom: 14 },
  sectionLabel: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: CARD, borderRadius: 18, overflow: 'hidden' },

  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  rowIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  rowLabel:  { color: MUTED, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  rowValue:  { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 64 },

  // Payment
  payRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  payLeft:    { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  payIconWrap:{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  payTitle:   { color: GREEN, fontSize: 15, fontWeight: '700' },
  paySub:     { color: MUTED, fontSize: 12, marginTop: 2 },
  payAmount:  { color: '#ffffff', fontSize: 22, fontWeight: '800' },

  // Bottom bar
  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#161614', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 16 },
  declineBtn: { backgroundColor: 'rgba(230,57,70,0.2)', borderWidth: 1, borderColor: 'rgba(230,57,70,0.4)' },
  acceptBtn:  { backgroundColor: GREEN },
  msgSolidBtn: { backgroundColor: '#3b82f6' },
  jobDoneBtn:  { backgroundColor: GREEN },
  actionBtnTxt:{ color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
