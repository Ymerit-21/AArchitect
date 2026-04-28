import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Modal, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, onSnapshot, query, orderBy, where, getDocs,
  serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG    = '#f0ede6';
const DARK  = '#111110';
const RED   = '#e63946';
const GREEN = '#10b981';

// ── Job categories ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Architecture',   icon: 'business-outline',      color: '#e63946' },
  { name: 'Construction',   icon: 'hammer-outline',         color: '#f97316' },
  { name: 'Interior Design',icon: 'color-palette-outline',  color: '#a855f7' },
  { name: 'Electrical',     icon: 'flash-outline',          color: '#eab308' },
  { name: 'Plumbing',       icon: 'water-outline',          color: '#3b82f6' },
  { name: 'Landscaping',    icon: 'leaf-outline',           color: '#10b981' },
  { name: 'Engineering',    icon: 'construct-outline',      color: '#6366f1' },
  { name: 'Surveying',      icon: 'map-outline',            color: '#ec4899' },
  { name: 'Other',          icon: 'ellipsis-horizontal-circle-outline', color: '#9ca3af' },
];

const DURATIONS = ['< 1 Week', '1–2 Weeks', '1 Month', '3 Months', '6 Months', 'Ongoing'];

const STATUS_META = {
  open:        { label: 'Open',        color: GREEN,    bg: '#dcfce7' },
  in_progress: { label: 'In Progress', color: '#f97316', bg: '#ffedd5' },
  completed:   { label: 'Completed',   color: '#6b7280', bg: '#f3f4f6' },
  closed:      { label: 'Closed',      color: RED,       bg: '#fee2e2' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];
function avatarColor(str = '') {
  return AVATAR_COLORS[(str.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

async function getOrCreateConversation(myUid, myName, otherUid, otherName) {
  const q    = query(collection(db, 'conversations'), where('participants', 'array-contains', myUid));
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => (d.data().participants ?? []).includes(otherUid));
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, 'conversations'), {
    participants:  [myUid, otherUid],
    names:         { [myUid]: myName, [otherUid]: otherName },
    lastMessage:   '',
    lastAt:        serverTimestamp(),
    createdAt:     serverTimestamp(),
  });
  return ref.id;
}

function useEntrance(delay = 0) {
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

// ── Job card ──────────────────────────────────────────────────────────────────
function JobCard({ job, currentUid, currentName, navigation, onApply, onWithdraw, onDelete, onMarkDone }) {
  const cat       = CATEGORIES.find(c => c.name === job.category) ?? CATEGORIES[CATEGORIES.length - 1];
  const status    = STATUS_META[job.status] ?? STATUS_META.open;
  const isOwner   = job.postedBy === currentUid;
  const applied   = (job.applicants ?? []).includes(currentUid);
  const count     = (job.applicants ?? []).length;
  const initials  = getInitials(job.postedByName);
  const avColor   = avatarColor(job.postedBy);

  const handleMessage = async () => {
    try {
      const convId = await getOrCreateConversation(
        currentUid, currentName, job.postedBy, job.postedByName ?? 'User'
      );
      navigation.navigate('Conversation', {
        conversationId: convId,
        otherName:      job.postedByName ?? 'User',
        otherUid:       job.postedBy,
      });
    } catch {
      Alert.alert('Error', 'Could not open conversation.');
    }
  };

  return (
    <View style={[jc.card, { borderTopColor: cat.color, borderTopWidth: 3 }]}>
      {/* Top row */}
      <View style={jc.topRow}>
        <View style={[jc.avatar, { backgroundColor: avColor }]}>
          <Text style={jc.avatarTxt}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={jc.postedBy}>{job.postedByName ?? 'Anonymous'}</Text>
          <Text style={jc.time}>{timeAgo(job.createdAt)}</Text>
        </View>
        <View style={[jc.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[jc.statusTxt, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={jc.title} numberOfLines={2}>{job.title}</Text>
      {job.description ? <Text style={jc.desc} numberOfLines={2}>{job.description}</Text> : null}

      {/* Tags */}
      <View style={jc.tagsRow}>
        <View style={[jc.tag, { backgroundColor: `${cat.color}14` }]}>
          <Ionicons name={cat.icon} size={12} color={cat.color} />
          <Text style={[jc.tagTxt, { color: cat.color }]}>{cat.name}</Text>
        </View>
        {job.location ? (
          <View style={jc.tag}>
            <Ionicons name="location-outline" size={12} color="#9ca3af" />
            <Text style={jc.tagTxt}>{job.location}</Text>
          </View>
        ) : null}
        {job.duration ? (
          <View style={jc.tag}>
            <Ionicons name="time-outline" size={12} color="#9ca3af" />
            <Text style={jc.tagTxt}>{job.duration}</Text>
          </View>
        ) : null}
      </View>

      {/* Budget + applicants */}
      <View style={jc.footRow}>
        <View>
          <Text style={jc.budgetLabel}>Budget</Text>
          <Text style={jc.budget}>
            {job.budgetMin && job.budgetMax
              ? `¢${job.budgetMin} – ¢${job.budgetMax}`
              : job.budgetMin ? `From ¢${job.budgetMin}` : 'Negotiable'}
          </Text>
        </View>
        <View style={jc.footRight}>
          <Ionicons name="people-outline" size={14} color="#9ca3af" />
          <Text style={jc.applicantsTxt}>{count} applicant{count !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Actions */}
      {isOwner ? (
        <View style={jc.actionRow}>
          {job.status === 'open' && (
            <TouchableOpacity style={jc.doneBtn} onPress={() => onMarkDone(job)} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle-outline" size={15} color={GREEN} />
              <Text style={jc.doneTxt}>Mark Complete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={jc.deleteBtn} onPress={() => onDelete(job)} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={15} color={RED} />
            <Text style={jc.deleteTxt}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : job.status === 'open' ? (
        <View style={jc.actionRow}>
          <TouchableOpacity style={jc.msgBtn} onPress={handleMessage} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={16} color={DARK} />
            <Text style={jc.msgTxt}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[jc.applyBtn, applied && jc.appliedBtn]}
            onPress={() => applied ? onWithdraw(job) : onApply(job)}
            activeOpacity={0.8}
          >
            <Ionicons name={applied ? 'checkmark-circle' : 'send-outline'} size={16} color={applied ? GREEN : '#ffffff'} />
            <Text style={[jc.applyTxt, applied && { color: GREEN }]}>
              {applied ? 'Applied · Withdraw' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const jc = StyleSheet.create({
  card:        { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  postedBy:    { color: DARK, fontSize: 13, fontWeight: '700' },
  time:        { color: '#9ca3af', fontSize: 11, marginTop: 1 },
  statusPill:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt:   { fontSize: 11, fontWeight: '700' },
  title:       { color: DARK, fontSize: 16, fontWeight: '800', marginBottom: 6, lineHeight: 22 },
  desc:        { color: '#6b7280', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagTxt:      { color: '#6b7280', fontSize: 11, fontWeight: '600' },
  footRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', marginBottom: 12 },
  budgetLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  budget:      { color: DARK, fontSize: 16, fontWeight: '800' },
  footRight:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  applicantsTxt:{ color: '#9ca3af', fontSize: 12 },
  actionRow:   { flexDirection: 'row', gap: 8 },
  msgBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f3f4f6', borderRadius: 12, height: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  msgTxt:      { color: DARK, fontSize: 14, fontWeight: '600' },
  applyBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: DARK, borderRadius: 12, height: 44 },
  appliedBtn:  { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  applyTxt:    { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  doneBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#dcfce7', borderRadius: 12, height: 40, borderWidth: 1, borderColor: '#bbf7d0' },
  doneTxt:     { color: GREEN, fontSize: 13, fontWeight: '700' },
  deleteBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', borderRadius: 12, height: 40, borderWidth: 1, borderColor: '#fecaca' },
  deleteTxt:   { color: RED, fontSize: 13, fontWeight: '700' },
});

// ── Post Job sheet ────────────────────────────────────────────────────────────
function PostJobSheet({ visible, onClose, onSave, saving }) {
  const sheetY  = useRef(new Animated.Value(700)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  const [title,     setTitle]    = useState('');
  const [category,  setCategory] = useState(null);
  const [desc,      setDesc]     = useState('');
  const [budgetMin, setBudgetMin]= useState('');
  const [budgetMax, setBudgetMax]= useState('');
  const [location,  setLocation] = useState('');
  const [duration,  setDuration] = useState(null);
  const [error,     setError]    = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(''); setCategory(null); setDesc('');
      setBudgetMin(''); setBudgetMax(''); setLocation('');
      setDuration(null); setError('');
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlay, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY,  { toValue: 700, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSave = () => {
    if (!title.trim())  return setError('Enter a job title.');
    if (!category)      return setError('Select a category.');
    if (!duration)      return setError('Select an expected duration.');
    setError('');
    onSave({
      title:     title.trim(),
      category:  category.name,
      description: desc.trim(),
      budgetMin: budgetMin ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax ? parseFloat(budgetMax) : null,
      location:  location.trim(),
      duration,
      status:    'open',
      applicants: [],
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ps.overlay, { opacity: overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[ps.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={ps.handle} />
            <View style={ps.headRow}>
              <Text style={ps.sheetTitle}>Post a Job</Text>
              <TouchableOpacity onPress={onClose} style={ps.closeBtn}>
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Title */}
              <Text style={ps.label}>Job title *</Text>
              <TextInput
                style={ps.input}
                placeholder="e.g. Build a 3-bedroom house foundation…"
                placeholderTextColor="#c4c4c4"
                value={title}
                onChangeText={t => { setTitle(t); setError(''); }}
              />

              {/* Category */}
              <Text style={ps.label}>Category *</Text>
              <View style={ps.catGrid}>
                {CATEGORIES.map(cat => {
                  const active = category?.name === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[ps.catPill, { borderColor: cat.color, backgroundColor: active ? cat.color : `${cat.color}12` }]}
                      onPress={() => { setCategory(cat); setError(''); }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={cat.icon} size={13} color={active ? '#ffffff' : cat.color} />
                      <Text style={[ps.catTxt, { color: active ? '#ffffff' : cat.color }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description */}
              <Text style={ps.label}>Description</Text>
              <TextInput
                style={[ps.input, { height: 90, textAlignVertical: 'top', paddingTop: 13 }]}
                placeholder="Describe the job, requirements, expectations…"
                placeholderTextColor="#c4c4c4"
                value={desc}
                onChangeText={setDesc}
                multiline
              />

              {/* Budget */}
              <Text style={ps.label}>Budget range (¢)</Text>
              <View style={ps.budgetRow}>
                <View style={[ps.amtWrap, { flex: 1 }]}>
                  <Text style={ps.cedi}>¢</Text>
                  <TextInput
                    style={ps.amtInput}
                    placeholder="Min"
                    placeholderTextColor="#c4c4c4"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={ps.budgetDash}>—</Text>
                <View style={[ps.amtWrap, { flex: 1 }]}>
                  <Text style={ps.cedi}>¢</Text>
                  <TextInput
                    style={ps.amtInput}
                    placeholder="Max"
                    placeholderTextColor="#c4c4c4"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Location */}
              <Text style={ps.label}>Location</Text>
              <View style={ps.inputRow}>
                <Ionicons name="location-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={[ps.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Accra, East Legon"
                  placeholderTextColor="#c4c4c4"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              {/* Duration */}
              <Text style={[ps.label, { marginTop: 16 }]}>Expected duration *</Text>
              <View style={ps.durGrid}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[ps.durPill, duration === d && ps.durPillActive]}
                    onPress={() => { setDuration(d); setError(''); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[ps.durTxt, duration === d && ps.durTxtActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Error */}
              {!!error && (
                <View style={ps.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={RED} />
                  <Text style={ps.errorTxt}>{error}</Text>
                </View>
              )}

              <View style={{ height: 16 }} />

              <TouchableOpacity
                style={[ps.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <><Ionicons name="briefcase-outline" size={18} color="#ffffff" /><Text style={ps.saveTxt}>Post Job</Text></>}
              </TouchableOpacity>

              <View style={{ height: 28 }} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14, maxHeight: '93%' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 20 },
  headRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { color: DARK, fontSize: 22, fontWeight: '800' },
  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  label:      { color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  input:      { backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: DARK, marginBottom: 16 },
  catGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  catPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5 },
  catTxt:     { fontSize: 12, fontWeight: '700' },
  budgetRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  budgetDash: { color: '#9ca3af', fontSize: 18, fontWeight: '600' },
  amtWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10 },
  cedi:       { color: RED, fontSize: 16, fontWeight: '800', marginRight: 4 },
  amtInput:   { flex: 1, fontSize: 15, fontWeight: '700', color: DARK, padding: 0 },
  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16 },
  durGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  durPill:    { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 50, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent' },
  durPillActive:{ backgroundColor: DARK, borderColor: DARK },
  durTxt:     { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  durTxtActive: { color: '#ffffff' },
  errorBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorTxt:   { color: RED, fontSize: 13, flex: 1 },
  saveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: RED, borderRadius: 16, height: 54 },
  saveTxt:    { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function JobsScreen({ navigation }) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const { profile }  = useUserData();

  const [jobs,       setJobs]      = useState([]);
  const [postOpen,   setPostOpen]  = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [loading,    setLoading]   = useState(true);

  const a0 = useEntrance(0);
  const a1 = useEntrance(80);
  const a2 = useEntrance(160);

  const name = profile?.displayName ?? user?.displayName ?? 'User';

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'jobs'), orderBy('createdAt', 'desc')),
      snap => {
        setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const browseJobs   = jobs.filter(j => j.postedBy !== user?.uid && j.status === 'open');
  const appliedCount = browseJobs.filter(j => (j.applicants ?? []).includes(user?.uid)).length;

  const handlePost = async (data) => {
    setSaving(true);
    try {
      await addDoc(collection(db, 'jobs'), {
        ...data,
        postedBy:     user.uid,
        postedByName: name,
        createdAt:    serverTimestamp(),
      });
      setPostOpen(false);
    } catch (e) {
      console.warn('Post job error:', e?.code, e?.message);
      Alert.alert('Error', e?.code === 'permission-denied'
        ? 'Permission denied. Firestore rules need updating.'
        : 'Could not post job. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async (job) => {
    try {
      await updateDoc(doc(db, 'jobs', job.id), { applicants: arrayUnion(user.uid) });
      // Notify the job poster
      await addDoc(collection(db, 'users', job.postedBy, 'notifications'), {
        type:          'job_application',
        jobId:         job.id,
        jobTitle:      job.title,
        applicantUid:  user.uid,
        applicantName: name,
        message:       `${name} applied for your job "${job.title}"`,
        read:          false,
        createdAt:     serverTimestamp(),
      });
    } catch (e) {
      console.warn('Apply error:', e?.code, e?.message);
      Alert.alert('Error', 'Could not apply. Try again.');
    }
  };

  const handleWithdraw = async (job) => {
    try {
      await updateDoc(doc(db, 'jobs', job.id), { applicants: arrayRemove(user.uid) });
    } catch {
      Alert.alert('Error', 'Could not withdraw application.');
    }
  };

  const handleMarkDone = (job) => {
    Alert.alert(
      'Mark as Complete',
      `Mark "${job.title}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'jobs', job.id), { status: 'completed' });
            } catch {
              Alert.alert('Error', 'Could not update job.');
            }
          },
        },
      ],
    );
  };

  const handleDelete = (job) => {
    Alert.alert(
      'Delete Job',
      `Delete "${job.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'jobs', job.id));
            } catch {
              Alert.alert('Error', 'Could not delete job.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.header, a0]}>
          <View>
            <Text style={st.headerTitle}>Jobs</Text>
            <Text style={st.headerSub}>Find work or hire talent</Text>
          </View>
          <TouchableOpacity style={st.postBtn} onPress={() => setPostOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={st.postBtnTxt}>Post Job</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Stats strip ── */}
        <Animated.View style={[st.ph, a0]}>
          <View style={st.statsStrip}>
            <View style={st.stripItem}>
              <Text style={st.stripVal}>{browseJobs.length}</Text>
              <Text style={st.stripLabel}>Open Jobs</Text>
            </View>
            <View style={st.stripDivider} />
            <View style={st.stripItem}>
              <Text style={[st.stripVal, appliedCount > 0 && { color: RED }]}>{appliedCount}</Text>
              <Text style={st.stripLabel}>Applied</Text>
            </View>
            <View style={st.stripDivider} />
            <View style={st.stripItem}>
              <Text style={st.stripVal}>{CATEGORIES.length - 1}</Text>
              <Text style={st.stripLabel}>Categories</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Job list ── */}
        <Animated.View style={[st.ph, { marginTop: 16 }, a1]}>
          {loading ? (
            <View style={st.centerWrap}>
              <ActivityIndicator size="large" color={RED} />
            </View>
          ) : browseJobs.length === 0 ? (
            <View style={st.emptyBox}>
              <View style={st.emptyIconWrap}>
                <Ionicons name="briefcase-outline" size={38} color={RED} />
              </View>
              <Text style={st.emptyTitle}>No open jobs yet</Text>
              <Text style={st.emptySub}>Check back later or be the first to post a job</Text>
              <TouchableOpacity style={st.emptyBtn} onPress={() => setPostOpen(true)} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={st.emptyBtnTxt}>Post a Job</Text>
              </TouchableOpacity>
            </View>
          ) : (
            browseJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                currentUid={user?.uid}
                currentName={name}
                navigation={navigation}
                onApply={handleApply}
                onWithdraw={handleWithdraw}
                onMarkDone={handleMarkDone}
                onDelete={handleDelete}
              />
            ))
          )}
        </Animated.View>

      </ScrollView>

      <BottomNav activeTab="home" navigation={navigation} bottomInset={insets.bottom || 10} />

      <PostJobSheet
        visible={postOpen}
        onClose={() => setPostOpen(false)}
        onSave={handlePost}
        saving={saving}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  headerSub:   { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  postBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DARK, borderRadius: 50, paddingHorizontal: 16, paddingVertical: 10 },
  postBtnTxt:  { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  statsStrip:   { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  stripItem:    { flex: 1, alignItems: 'center' },
  stripVal:     { color: DARK, fontSize: 20, fontWeight: '800', marginBottom: 3 },
  stripLabel:   { color: '#9ca3af', fontSize: 11, fontWeight: '600' },
  stripDivider: { width: 1, backgroundColor: '#f3f4f6', marginHorizontal: 8 },

  centerWrap:   { paddingTop: 60, alignItems: 'center' },
  emptyBox:     { backgroundColor: '#ffffff', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { color: DARK, fontSize: 16, fontWeight: '700' },
  emptySub:     { color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: RED, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  emptyBtnTxt:  { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
