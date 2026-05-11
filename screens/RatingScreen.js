import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, ScrollView, Animated, ActivityIndicator, Keyboard, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, addDoc, serverTimestamp,
  updateDoc, doc, getDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const DARK  = '#111110';
const CARD  = '#1c1917';
const GOLD  = '#f59e0b';
const GREEN = '#22c55e';
const RED   = '#e63946';
const MUTED = 'rgba(255,255,255,0.35)';
const WHITE = '#ffffff';

const POSITIVE_TAGS = ['Professional', 'On time', 'Good communication', 'Quality work', 'Clean job'];
const NEGATIVE_TAGS = ['Late arrival', 'Poor workmanship', 'Unprofessional', 'Overcharged', 'Incomplete job'];

const RATING_LABELS = ['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent!'];
const RATING_COLORS = ['', '#ef4444', '#f97316', GOLD, GREEN, GREEN];

// ── Star row ───────────────────────────────────────────────────────────────────
function StarRow({ stars, onSelect }) {
  const scales = useRef([...Array(5)].map(() => new Animated.Value(1))).current;

  const press = (n) => {
    onSelect(n);
    Animated.sequence([
      Animated.spring(scales[n - 1], { toValue: 0.65, tension: 350, friction: 7, useNativeDriver: true }),
      Animated.spring(scales[n - 1], { toValue: 1,    tension: 200, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={st.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => press(n)} activeOpacity={0.8}>
          <Animated.View style={{ transform: [{ scale: scales[n - 1] }] }}>
            <Ionicons
              name={n <= stars ? 'star' : 'star-outline'}
              size={44}
              color={n <= stars ? GOLD : 'rgba(255,255,255,0.18)'}
            />
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Inline stars (for confirmation card) ──────────────────────────────────────
function Stars({ value, size = 15 }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons
          key={n}
          name={n <= full ? 'star' : (n === full + 1 && half) ? 'star-half' : 'star-outline'}
          size={size}
          color={GOLD}
        />
      ))}
    </View>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function RatingModal({ visible, job, onClose }) {
  const insets = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();

  const sheetY     = useRef(new Animated.Value(700)).current;
  const overlayOp  = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const [phase,      setPhase]      = useState('rate');
  const [stars,      setStars]      = useState(0);
  const [selTags,    setSelTags]    = useState([]);
  const [review,     setReview]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newRating,  setNewRating]  = useState(0);
  const [newCount,   setNewCount]   = useState(0);

  // Reset on new job
  useEffect(() => {
    if (visible) {
      setPhase('rate');
      setStars(0);
      setSelTags([]);
      setReview('');
      setNewRating(0);
    }
  }, [visible, job?.id]);

  // Sheet slide in/out
  useEffect(() => {
    if (visible) {
      sheetY.setValue(700);
      overlayOp.setValue(0);
      Animated.parallel([
        Animated.timing(overlayOp, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,    { toValue: 0, tension: 62, friction: 11, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Checkmark pop when confirm phase starts
  useEffect(() => {
    if (phase === 'confirm') {
      checkScale.setValue(0);
      Animated.spring(checkScale, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }).start();
    }
  }, [phase]);

  const closeSheet = (cb) => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(overlayOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetY,    { toValue: 700, duration: 220, useNativeDriver: true }),
    ]).start(() => cb?.());
  };

  const handleStarSelect = (n) => {
    setStars(n);
    setSelTags([]); // reset tags when rating changes
  };

  const toggleTag = (t) => {
    setSelTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSkip = () => {
    closeSheet(() => {
      if (job?.id) {
        // Write to user's own doc — always writable
        updateDoc(doc(db, 'users', user.uid), {
          skippedRatingJobIds: arrayUnion(job.id),
        }).catch(() => {});
        // Best-effort sync to job doc
        updateDoc(doc(db, 'jobs', job.id), { ratingSkipped: true }).catch(() => {});
      }
      onClose();
    });
  };

  const handleDone = () => {
    closeSheet(onClose);
  };

  const handleSubmit = async () => {
    if (stars === 0 || submitting || !job) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const expertId   = job.expertId;
      const clientName = profile?.displayName ?? user?.displayName ?? 'Anonymous';

      // Read expert's current aggregate to recalculate
      let currentRating = 0;
      let currentCount  = 0;
      try {
        const snap = await getDoc(doc(db, 'experts', expertId));
        if (snap.exists()) {
          currentRating = snap.data().rating ?? 0;
          currentCount  = snap.data().reviewCount ?? 0;
        }
      } catch {}

      const nextCount  = currentCount + 1;
      const nextRating = parseFloat(
        ((currentRating * currentCount + stars) / nextCount).toFixed(2)
      );

      // Write review + record in user's own doc (both always permitted)
      await Promise.all([
        addDoc(collection(db, 'experts', expertId, 'reviews'), {
          rating:     stars,
          tags:       selTags,
          review:     review.trim(),
          clientId:   user.uid,
          clientName,
          jobId:      job.id,
          createdAt:  serverTimestamp(),
        }),
        // Write to user's own document — always writable, no permission issue
        updateDoc(doc(db, 'users', user.uid), {
          ratedJobIds: arrayUnion(job.id),
        }),
      ]);

      // Best-effort: sync flag to job doc + update expert aggregate
      updateDoc(doc(db, 'jobs', job.id), { hasRated: true }).catch(() => {});
      updateDoc(doc(db, 'experts', expertId), {
        rating: nextRating, reviewCount: nextCount,
      }).catch(e => console.warn('Expert rating update skipped:', e));

      setNewRating(nextRating);
      setNewCount(nextCount);
      setPhase('confirm');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!job) return null;

  const dynamicTags   = stars >= 4 ? POSITIVE_TAGS : stars > 0 ? NEGATIVE_TAGS : [];
  const ratingLabel   = RATING_LABELS[stars] ?? '';
  const ratingColor   = RATING_COLORS[stars] ?? GOLD;
  const canSubmit     = stars > 0 && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <Animated.View style={[st.overlay, { opacity: overlayOp }]}>

        {/* Dim backdrop */}
        <Pressable
          style={st.backdrop}
          onPress={phase === 'rate' ? handleSkip : handleDone}
        />

        {/* Bottom sheet */}
        <Animated.View style={[
          st.sheet,
          { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetY }] },
        ]}>
          <View style={st.handle} />

          {/* ── Rate phase ────────────────────────────────────────── */}
          {phase === 'rate' && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={st.scroll}
            >
              {/* Header */}
              <View style={st.header}>
                <View style={{ flex: 1 }}>
                  <Text style={st.title}>Rate & Review</Text>
                  <Text style={st.subtitle} numberOfLines={1}>
                    {job.expertName ?? 'Expert'}
                    {job.category ? ` · ${job.category}` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={st.skipBtn} onPress={handleSkip}>
                  <Text style={st.skipTxt}>Skip</Text>
                </TouchableOpacity>
              </View>

              {/* Stars */}
              <View style={st.starsCard}>
                <Text style={st.starsPrompt}>
                  How was your experience with{' '}
                  <Text style={{ color: GOLD }}>{job.expertName ?? 'this expert'}</Text>?
                </Text>
                <StarRow stars={stars} onSelect={handleStarSelect} />
                {stars > 0
                  ? <Text style={[st.ratingLabel, { color: ratingColor }]}>{ratingLabel}</Text>
                  : <Text style={st.tapHint}>Tap a star to begin</Text>
                }
              </View>

              {/* Dynamic tags */}
              {stars > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>
                    {stars >= 4 ? 'What went well?' : 'What could be better?'}
                    <Text style={st.optTxt}> (optional)</Text>
                  </Text>
                  <View style={st.tagsWrap}>
                    {dynamicTags.map(t => {
                      const on = selTags.includes(t);
                      const activeColor = stars >= 4 ? GREEN : RED;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[st.tag, on && { backgroundColor: `${activeColor}20`, borderColor: activeColor }]}
                          onPress={() => toggleTag(t)}
                          activeOpacity={0.75}
                        >
                          {on && <Ionicons name="checkmark" size={12} color={activeColor} />}
                          <Text style={[st.tagTxt, on && { color: activeColor, fontWeight: '700' }]}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Review text */}
              {stars > 0 && (
                <View style={st.section}>
                  <Text style={st.sectionTitle}>
                    Write a review<Text style={st.optTxt}> (optional)</Text>
                  </Text>
                  <TextInput
                    style={st.input}
                    value={review}
                    onChangeText={setReview}
                    placeholder="Share your experience…"
                    placeholderTextColor={MUTED}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={st.charCount}>{review.length}/500</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[st.submitBtn, !canSubmit && st.submitOff]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={WHITE} />
                  : <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color={canSubmit ? WHITE : 'rgba(255,255,255,0.25)'}
                      />
                      <Text style={[st.submitTxt, !canSubmit && st.submitTxtOff]}>
                        Submit review
                      </Text>
                    </>
                }
              </TouchableOpacity>

              {stars === 0 && (
                <Text style={st.validationHint}>Select a star rating to continue</Text>
              )}
            </ScrollView>
          )}

          {/* ── Confirm phase ──────────────────────────────────────── */}
          {phase === 'confirm' && (
            <View style={st.confirmWrap}>
              {/* Animated checkmark */}
              <Animated.View style={[st.checkRing, { transform: [{ scale: checkScale }] }]}>
                <Ionicons name="checkmark" size={42} color={WHITE} />
              </Animated.View>

              <Text style={st.confirmTitle}>Review submitted!</Text>
              <Text style={st.confirmSub}>Thanks for helping the Architect community</Text>

              {/* Expert updated card */}
              <View style={st.expertCard}>
                <Text style={st.expertName}>{job.expertName ?? 'Expert'}</Text>
                <View style={st.expertRatingRow}>
                  <Stars value={newRating} size={17} />
                  <Text style={st.expertRatingVal}>{newRating.toFixed(1)}</Text>
                  <Text style={st.reviewCount}>({newCount} review{newCount !== 1 ? 's' : ''})</Text>
                </View>

                {/* Your rating */}
                <View style={st.yourRatingRow}>
                  <Text style={st.yourRatingLabel}>Your rating</Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1,2,3,4,5].map(n => (
                      <Ionicons key={n} name={n <= stars ? 'star' : 'star-outline'} size={13} color={GOLD} />
                    ))}
                  </View>
                </View>

                {/* Tags */}
                {selTags.length > 0 && (
                  <View style={st.confirmTagsRow}>
                    {selTags.map(t => (
                      <View key={t} style={st.confirmTag}>
                        <Text style={st.confirmTagTxt}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity style={st.homeBtn} onPress={handleDone} activeOpacity={0.85}>
                <Ionicons name="home-outline" size={16} color={WHITE} />
                <Text style={st.homeBtnTxt}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },

  sheet: {
    backgroundColor:      DARK,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:           12,
    paddingHorizontal:    20,
    borderWidth:          1,
    borderColor:          'rgba(255,255,255,0.07)',
    elevation:            24,
    maxHeight:            '90%',
  },
  handle: {
    alignSelf:       'center',
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom:    20,
  },
  scroll: { gap: 14, paddingBottom: 4 },

  // Header
  header:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  title:    { color: WHITE, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: MUTED, fontSize: 13, marginTop: 3 },
  skipBtn:  { paddingVertical: 6, paddingHorizontal: 4, marginTop: 2 },
  skipTxt:  { color: MUTED, fontSize: 14, fontWeight: '600' },

  // Stars card
  starsCard:   { backgroundColor: CARD, borderRadius: 20, padding: 20, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  starsPrompt: { color: WHITE, fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  starRow:     { flexDirection: 'row', gap: 10 },
  ratingLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  tapHint:     { color: MUTED, fontSize: 13 },

  // Tags
  section:      { gap: 10 },
  sectionTitle: { color: WHITE, fontSize: 13, fontWeight: '700' },
  optTxt:       { color: MUTED, fontWeight: '400' },
  tagsWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      50,
    backgroundColor:   'rgba(255,255,255,0.05)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.12)',
  },
  tagTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },

  // Review input
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.1)',
    padding:         14,
    color:           WHITE,
    fontSize:        14,
    lineHeight:      21,
    minHeight:       90,
  },
  charCount: { color: MUTED, fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Submit
  submitBtn: {
    flexDirection:   'row',
    backgroundColor: '#22c55e',
    borderRadius:    16,
    height:          54,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    marginTop:       4,
  },
  submitOff:     { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitTxt:     { color: WHITE, fontSize: 16, fontWeight: '700' },
  submitTxtOff:  { color: 'rgba(255,255,255,0.25)' },
  validationHint:{ color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 6 },

  // Confirmation
  confirmWrap: { alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkRing: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: GREEN,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    6,
    shadowColor:     GREEN,
    shadowOpacity:   0.4,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       10,
  },
  confirmTitle: { color: WHITE, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  confirmSub:   { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  expertCard: {
    width:           '100%',
    backgroundColor: CARD,
    borderRadius:    20,
    padding:         18,
    gap:             10,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.07)',
  },
  expertName:      { color: WHITE, fontSize: 17, fontWeight: '800' },
  expertRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expertRatingVal: { color: GOLD, fontSize: 18, fontWeight: '800' },
  reviewCount:     { color: MUTED, fontSize: 13 },

  yourRatingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  yourRatingLabel:{ color: MUTED, fontSize: 13 },

  confirmTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  confirmTag:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  confirmTagTxt:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '500' },

  homeBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius:    50,
    paddingHorizontal: 28,
    paddingVertical:   14,
    marginTop:       8,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
  },
  homeBtnTxt: { color: WHITE, fontSize: 15, fontWeight: '700' },
});
