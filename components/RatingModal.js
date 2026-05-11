import { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
  TextInput, ScrollView, ActivityIndicator, Animated,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const DARK   = '#0f0f0e';
const SHEET  = '#181716';
const CARD   = '#221f1d';
const GOLD   = '#f59e0b';
const GREEN  = '#22c55e';
const MUTED  = 'rgba(255,255,255,0.38)';
const WHITE  = '#ffffff';
const BORDER = 'rgba(255,255,255,0.07)';

const AVATAR_PALETTE = ['#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];
function avatarColor(str = '') {
  return AVATAR_PALETTE[(str.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length];
}
function initials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const POSITIVE_TAGS = ['Professional', 'On time', 'Good communication', 'Quality work', 'Clean job'];
const NEGATIVE_TAGS = ['Late arrival', 'Poor workmanship', 'Unprofessional', 'Overcharged', 'Incomplete job'];

export default function RatingModal({ visible, notif, onClose }) {
  const insets = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();

  const [rating,     setRating]     = useState(0);
  const [tags,       setTags]       = useState([]);
  const [feedback,   setFeedback]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);

  const starScales  = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale   = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (visible) {
      setRating(0);
      setTags([]);
      setFeedback('');
      setSubmitting(false);
      setDone(false);
      doneOpacity.setValue(0);
      doneScale.setValue(0.7);
      starScales.forEach(s => s.setValue(1));
    }
  }, [visible]);

  const availableTags = rating >= 4 ? POSITIVE_TAGS : rating >= 1 ? NEGATIVE_TAGS : [];

  const handleStar = (num) => {
    setRating(num);
    setTags([]); // reset tags when rating changes

    // Cascade scale animation across selected stars
    for (let i = 0; i < num; i++) {
      Animated.sequence([
        Animated.delay(i * 40),
        Animated.spring(starScales[i], { toValue: 1.35, tension: 280, friction: 6, useNativeDriver: true }),
        Animated.spring(starScales[i], { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  };

  const toggleTag = (tag) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const showDone = () => {
    setDone(true);
    Animated.parallel([
      Animated.timing(doneOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(doneScale,   { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(onClose, 1600);
    });
  };

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const expertId   = notif?.expertId;
      const clientName = profile?.displayName ?? user?.displayName ?? 'Anonymous';

      if (expertId) {
        await addDoc(collection(db, 'experts', expertId, 'reviews'), {
          rating,
          tags,
          review:    feedback.trim(),
          clientId:  user.uid,
          clientName,
          jobId:     notif?.jobId,
          createdAt: serverTimestamp(),
        });
      }

      if (notif?.id && user?.uid) {
        updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true }).catch(() => {});
      }

      showDone();
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    if (notif?.id && user?.uid) {
      updateDoc(doc(db, 'users', user.uid, 'notifications', notif.id), { read: true }).catch(() => {});
    }
    onClose?.();
  };

  const expertName = notif?.expertName ?? 'Expert';
  const service    = notif?.profession ?? notif?.category ?? 'Service';
  const avatarBg   = avatarColor(expertName);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={st.overlay}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={handleSkip}>
            <View style={st.backdrop} />
          </TouchableWithoutFeedback>

          {/* Bottom sheet */}
          <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>

            {/* Handle */}
            <View style={st.handle} />

            {/* ── Success overlay ── */}
            {done && (
              <Animated.View
                style={[st.doneOverlay, { opacity: doneOpacity }]}
                pointerEvents="none"
              >
                <Animated.View style={[st.doneBox, { transform: [{ scale: doneScale }] }]}>
                  <View style={st.doneIconRing}>
                    <Ionicons name="checkmark-circle" size={52} color={GREEN} />
                  </View>
                  <Text style={st.doneTxt}>Thanks for your review!</Text>
                </Animated.View>
              </Animated.View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={st.scroll}
            >
              {/* ── Header ── */}
              <View style={st.header}>
                <Text style={st.title}>Rate Your Service</Text>
                <Text style={st.subtitle}>
                  How was your experience with{' '}
                  <Text style={{ color: GOLD, fontWeight: '700' }}>{expertName}</Text>?
                </Text>
              </View>

              {/* ── Worker info card ── */}
              <View style={st.workerCard}>
                <View style={[st.workerAvatar, { backgroundColor: avatarBg }]}>
                  <Text style={st.workerInitials}>{initials(expertName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.workerName}>{expertName}</Text>
                  <Text style={st.workerService}>{service}</Text>
                  {!!notif?.jobId && (
                    <Text style={st.workerJob} numberOfLines={1}>
                      Job #{notif.jobId.slice(0, 8).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={st.completedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                  <Text style={st.completedTxt}>Completed</Text>
                </View>
              </View>

              {/* ── Star rating ── */}
              <View style={st.starsSection}>
                <Text style={st.starsHint}>
                  {rating === 0 ? 'Tap a star to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                </Text>
                <View style={st.starsRow}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <TouchableOpacity key={num} onPress={() => handleStar(num)} activeOpacity={0.7}>
                      <Animated.View style={{ transform: [{ scale: starScales[num - 1] }] }}>
                        <Ionicons
                          name={num <= rating ? 'star' : 'star-outline'}
                          size={42}
                          color={num <= rating ? GOLD : 'rgba(255,255,255,0.2)'}
                        />
                      </Animated.View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── Dynamic tags ── */}
              {rating > 0 && (
                <View style={st.tagsSection}>
                  <Text style={st.tagsLabel}>
                    {rating >= 4 ? 'What went well?' : 'What went wrong?'}
                  </Text>
                  <View style={st.tagsRow}>
                    {availableTags.map(tag => {
                      const selected = tags.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            st.tag,
                            selected && (rating >= 4 ? st.tagPositiveActive : st.tagNegativeActive),
                          ]}
                          onPress={() => toggleTag(tag)}
                          activeOpacity={0.75}
                        >
                          <Text style={[st.tagTxt, selected && st.tagTxtActive]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Text review ── */}
              {rating > 0 && (
                <TextInput
                  style={st.input}
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="Share more details about your experience (optional)"
                  placeholderTextColor={MUTED}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  textAlignVertical="top"
                />
              )}

              {/* ── Actions ── */}
              <View style={st.actions}>
                <TouchableOpacity style={st.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
                  <Text style={st.skipTxt}>Skip</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[st.submitBtn, (rating === 0 || submitting) && st.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={rating === 0 || submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color={WHITE} />
                    : <Text style={st.submitTxt}>Submit Review</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },

  sheet: {
    backgroundColor:      SHEET,
    borderTopLeftRadius:  30,
    borderTopRightRadius: 30,
    paddingTop:           10,
    borderWidth:          1,
    borderColor:          BORDER,
    elevation:            28,
    maxHeight:            '92%',
  },

  handle: {
    alignSelf:       'center',
    width:           42,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom:    4,
  },

  // Done overlay
  doneOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          99,
    borderTopLeftRadius:  30,
    borderTopRightRadius: 30,
    backgroundColor: 'rgba(15,15,14,0.92)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBox:     { alignItems: 'center', gap: 14 },
  doneIconRing:{ width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  doneTxt:     { color: WHITE, fontSize: 20, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 20 },

  // Header
  header:   { gap: 6 },
  title:    { color: WHITE, fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 20 },

  // Worker card
  workerCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: BORDER },
  workerAvatar:   { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  workerInitials: { color: WHITE, fontSize: 20, fontWeight: '800' },
  workerName:     { color: WHITE, fontSize: 16, fontWeight: '800', marginBottom: 3 },
  workerService:  { color: GOLD, fontSize: 12, fontWeight: '600' },
  workerJob:      { color: MUTED, fontSize: 11, marginTop: 2 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  completedTxt:   { color: GREEN, fontSize: 11, fontWeight: '700' },

  // Stars
  starsSection: { alignItems: 'center', gap: 12 },
  starsHint:    { color: MUTED, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  starsRow:     { flexDirection: 'row', gap: 6 },

  // Tags
  tagsSection: { gap: 10 },
  tagsLabel:   { color: MUTED, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.14)',
    backgroundColor:   'rgba(255,255,255,0.04)',
  },
  tagPositiveActive: { backgroundColor: 'rgba(34,197,94,0.15)',  borderColor: GREEN },
  tagNegativeActive: { backgroundColor: 'rgba(230,57,70,0.15)',  borderColor: '#e63946' },
  tagTxt:       { color: MUTED, fontSize: 13, fontWeight: '600' },
  tagTxtActive: { color: WHITE },

  // Input
  input: {
    backgroundColor: CARD,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     BORDER,
    padding:         16,
    color:           WHITE,
    fontSize:        14,
    lineHeight:      21,
    minHeight:       90,
  },

  // Actions
  actions:    { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex:            1,
    height:          52,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     BORDER,
  },
  skipTxt:    { color: MUTED, fontSize: 15, fontWeight: '700' },
  submitBtn: {
    flex:            2,
    height:          52,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: GOLD,
  },
  submitDisabled: { opacity: 0.35 },
  submitTxt:  { color: WHITE, fontSize: 15, fontWeight: '800' },
});
