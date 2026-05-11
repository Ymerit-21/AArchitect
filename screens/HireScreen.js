import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Animated, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const DARK   = '#111110';
const CARD   = '#1c1917';
const INPUT  = '#141412';
const ACCENT = '#e63946';
const GREEN  = '#22c55e';
const MUTED  = 'rgba(255,255,255,0.4)';

const STEPS      = ['Job', 'Schedule', 'Location', 'Confirm'];
const CATEGORIES = ['Installation', 'Repair', 'Inspection', 'Consultation', 'Maintenance', 'Other'];
const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];

function SummaryRow({ label, value }) {
  return (
    <View style={st.summaryRow}>
      <Text style={st.summaryLabel}>{label}</Text>
      <Text style={st.summaryValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}
function SummaryDivider() {
  return <View style={st.summaryDivider} />;
}

// ── Animated success overlay ───────────────────────────────────────────────────
function SuccessOverlay({ visible, expert, booking, onHome, onJobs }) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const checkScale     = useRef(new Animated.Value(0)).current;
  const contentY       = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const ring1          = useRef(new Animated.Value(1)).current;
  const ring2          = useRef(new Animated.Value(1)).current;
  const pulseRef       = useRef(null);

  useEffect(() => {
    if (!visible) return;

    // Reset
    overlayOpacity.setValue(0);
    checkScale.setValue(0);
    contentY.setValue(40);
    contentOpacity.setValue(0);
    ring1.setValue(1);
    ring2.setValue(1);

    Animated.sequence([
      // 1. Fade in overlay
      Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      // 2. Bounce in checkmark
      Animated.spring(checkScale, { toValue: 1, tension: 70, friction: 5, useNativeDriver: true }),
      // 3. Slide + fade in content
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(contentY,       { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // 4. Pulsing rings
      const pulse = (val, delay) => Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1.9, duration: 1300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
      );
      const a1 = pulse(ring1, 0);
      const a2 = pulse(ring2, 650);
      pulseRef.current = { stop: () => { a1.stop(); a2.stop(); } };
      a1.start(); a2.start();
    });

    return () => pulseRef.current?.stop();
  }, [visible]);

  if (!visible) return null;

  const initials = (expert.displayName ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'EX';

  return (
    <Animated.View style={[st.successOverlay, { opacity: overlayOpacity }]}>
      <ScrollView contentContainerStyle={st.successScroll} showsVerticalScrollIndicator={false}>

        {/* Pulsing rings + checkmark */}
        <View style={st.checkWrap}>
          <Animated.View style={[st.ring, {
            transform: [{ scale: ring1 }],
            opacity: ring1.interpolate({ inputRange: [1, 1.9], outputRange: [0.25, 0] }),
          }]} />
          <Animated.View style={[st.ring, {
            transform: [{ scale: ring2 }],
            opacity: ring2.interpolate({ inputRange: [1, 1.9], outputRange: [0.14, 0] }),
          }]} />
          <Animated.View style={[st.checkCircle, { transform: [{ scale: checkScale }] }]}>
            <Ionicons name="checkmark" size={52} color="#ffffff" />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }], alignItems: 'center', gap: 8 }}>
          <Text style={st.successTitle}>Booking Confirmed!</Text>
          <Text style={st.successSub}>
            {expert.displayName} has been notified and will confirm your booking shortly.
          </Text>
        </Animated.View>

        {/* Booking details card */}
        <Animated.View style={[st.successCard, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}>

          {/* Expert row */}
          <View style={st.successExpertRow}>
            <View style={[st.successAvatar, { backgroundColor: expert.bg ?? ACCENT }]}>
              <Text style={st.successAvatarTxt}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.successExpertName}>{expert.displayName}</Text>
              <Text style={st.successExpertRole}>{expert.profession}</Text>
            </View>
            <View style={st.pendingBadge}>
              <View style={st.pendingDot} />
              <Text style={st.pendingTxt}>Pending</Text>
            </View>
          </View>

          <View style={st.successDivider} />

          {/* Detail rows */}
          {[
            { icon: 'calendar-outline',   color: '#6366f1', label: 'Date',     value: booking?.date },
            { icon: 'time-outline',       color: '#f59e0b', label: 'Time',     value: booking?.time },
            { icon: 'location-outline',   color: '#ec4899', label: 'Address',  value: booking?.address },
            { icon: 'construct-outline',  color: ACCENT,    label: 'Category', value: booking?.category },
            { icon: 'cash-outline',       color: GREEN,     label: 'Amount',   value: `¢${(booking?.cost ?? 0).toFixed(2)} — Pay on-site` },
          ].map(({ icon, color, label, value }) => (
            <View key={label} style={st.successDetailRow}>
              <View style={[st.successDetailIcon, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={16} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.successDetailLabel}>{label}</Text>
                <Text style={st.successDetailValue} numberOfLines={2}>{value}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[st.successBtns, { opacity: contentOpacity }]}>
          <TouchableOpacity style={st.successBtnOutline} onPress={onJobs} activeOpacity={0.85}>
            <Ionicons name="briefcase-outline" size={17} color="#ffffff" />
            <Text style={st.successBtnOutlineTxt}>View Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.successBtnSolid} onPress={onHome} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={17} color="#ffffff" />
            <Text style={st.successBtnSolidTxt}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HireScreen({ navigation, route }) {
  const { expert }  = route.params;
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();

  const [step,        setStep]        = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [booking,     setBooking]     = useState(null);

  // Step 0 – Job
  const [category,    setCategory]    = useState('');
  const [description, setDescription] = useState('');
  const [budget,      setBudget]      = useState(expert.from ? String(expert.from) : '');

  // Step 1 – Schedule
  const [dateOffset, setDateOffset] = useState(0);
  const [timeSlot,   setTimeSlot]   = useState('');

  // Step 2 – Location
  const [address,  setAddress]  = useState('');
  const [note,     setNote]     = useState('');
  const [locating, setLocating] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue:  (step + 1) / STEPS.length,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  const canContinue = () => {
    if (step === 0) return !!category && description.trim().length >= 10;
    if (step === 1) return !!timeSlot;
    if (step === 2) return address.trim().length > 4;
    return true;
  };

  const goNext = () => { if (step < STEPS.length - 1) setStep(s => s + 1); };
  const goBack = () => { if (step > 0) setStep(s => s - 1); else navigation.goBack(); };

  const handleUseLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed to auto-fill your address.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) {
        const parts = [place.name, place.street, place.district ?? place.subregion, place.city, place.region].filter(Boolean);
        setAddress([...new Set(parts)].join(', '));
      }
    } catch {
      Alert.alert('Error', 'Could not fetch your location. Please enter it manually.');
    } finally {
      setLocating(false);
    }
  };

  const confirm = async () => {
    if (submitting || !user) return;
    const cost       = parseFloat(budget) || expert.from || 0;
    const clientName = profile?.displayName ?? user.displayName ?? 'Client';

    setSubmitting(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + dateOffset);
      const dateStr = dateOffset === 0 ? 'Today'
        : dateOffset === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

      // Create job document
      const jobRef = await addDoc(collection(db, 'jobs'), {
        clientId:    user.uid,
        clientName,
        expertId:    expert.uid,
        expertName:  expert.displayName,
        profession:  expert.profession,
        category,
        description,
        date:        dateStr,
        time:        timeSlot,
        address,
        note:        note.trim(),
        budget:      cost,
        paymentMode: 'on-site',
        status:      'pending',
        createdAt:   serverTimestamp(),
      });

      // Notify the expert via their notifications subcollection
      await addDoc(collection(db, 'users', expert.uid, 'notifications'), {
        type:      'booking',
        title:     'New Booking Request',
        body:      `${clientName} has booked you for ${category} on ${dateStr} at ${timeSlot}.`,
        clientId:  user.uid,
        clientName,
        jobId:     jobRef.id,
        read:      false,
        createdAt: serverTimestamp(),
      });

      // Show animated success screen
      setBooking({ date: dateStr, time: timeSlot, address, category, cost });
      setShowSuccess(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not complete booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cost         = parseFloat(budget) || expert.from || 0;
  const selectedDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return dateOffset === 0 ? 'Today'
      : dateOffset === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  })();

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={st.header}>
        <TouchableOpacity style={st.headerBack} onPress={goBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
        </TouchableOpacity>
        <View style={st.headerMid}>
          <Text style={st.headerTitle}>Book Expert</Text>
          <Text style={st.headerSub}>Step {step + 1} of {STEPS.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <View style={st.progressTrack}>
        <Animated.View style={[st.progressFill, {
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>

      {/* ── Step indicators ──────────────────────────────────────────────── */}
      <View style={st.stepsRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={st.stepItem}>
            <View style={[st.stepDot, i < step && st.stepDotDone, i === step && st.stepDotActive]}>
              {i < step
                ? <Ionicons name="checkmark" size={13} color="#ffffff" />
                : <Text style={[st.stepDotNum, i === step && { color: '#ffffff' }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[st.stepLabel, i === step && st.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Expert mini card */}
          <View style={st.expertCard}>
            <View style={[st.expertAvatar, { backgroundColor: expert.bg ?? ACCENT }]}>
              <Text style={st.expertInitials}>
                {expert.initials ?? expert.displayName?.slice(0, 2).toUpperCase() ?? 'EX'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.expertName}>{expert.displayName}</Text>
              <Text style={st.expertRole}>{expert.profession}</Text>
            </View>
            <View style={st.expertPriceBadge}>
              <Text style={st.expertPriceTxt}>From ¢{expert.from ?? 0}</Text>
            </View>
          </View>

          {/* ── STEP 0: Job Details ──────────────────────────────────────── */}
          {step === 0 && (
            <>
              <Text style={st.stepHeading}>What do you need?</Text>
              <View style={st.card}>
                <Text style={st.cardLabel}>Service category</Text>
                <View style={st.chipsRow}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity key={c} style={[st.chip, category === c && st.chipActive]} onPress={() => setCategory(c)} activeOpacity={0.8}>
                      <Text style={[st.chipTxt, category === c && st.chipTxtActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={st.card}>
                <Text style={st.cardLabel}>Describe the job</Text>
                <TextInput
                  style={st.textArea}
                  placeholder="Describe what needs to be done in detail (min 10 chars)…"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={st.charCount}>{description.length} / 500</Text>
              </View>
              <View style={st.card}>
                <Text style={st.cardLabel}>Your budget</Text>
                <View style={st.budgetBox}>
                  <Text style={st.budgetSymbol}>¢</Text>
                  <TextInput
                    style={st.budgetInput}
                    placeholder={String(expert.from ?? '0')}
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="numeric"
                    maxLength={8}
                  />
                </View>
                {expert.from && (
                  <Text style={st.budgetHint}>Expert starts from ¢{expert.from}</Text>
                )}
              </View>
            </>
          )}

          {/* ── STEP 1: Schedule ─────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Text style={st.stepHeading}>When do you need it?</Text>
              <View style={st.card}>
                <Text style={st.cardLabel}>Select date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.dateScroll}>
                  {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                    const d    = new Date();
                    d.setDate(d.getDate() + offset);
                    const name = offset === 0 ? 'Today' : offset === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <TouchableOpacity key={offset} style={[st.dateCard, dateOffset === offset && st.dateCardActive]} onPress={() => setDateOffset(offset)} activeOpacity={0.8}>
                        <Text style={[st.dateName, dateOffset === offset && st.dateNameActive]}>{name}</Text>
                        <Text style={[st.dateNum, dateOffset === offset && st.dateNumActive]}>{d.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={st.card}>
                <Text style={st.cardLabel}>Select time</Text>
                <View style={st.timeGrid}>
                  {TIME_SLOTS.map(t => (
                    <TouchableOpacity key={t} style={[st.timeChip, timeSlot === t && st.timeChipActive]} onPress={() => setTimeSlot(t)} activeOpacity={0.8}>
                      <Text style={[st.timeChipTxt, timeSlot === t && st.timeChipTxtActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* ── STEP 2: Location ─────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Text style={st.stepHeading}>Where should they come?</Text>
              <TouchableOpacity style={[st.gpsBtn, locating && { opacity: 0.7 }]} onPress={handleUseLocation} disabled={locating} activeOpacity={0.85}>
                {locating ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={st.gpsBtnTxt}>Detecting location…</Text>
                  </>
                ) : (
                  <>
                    <View style={st.gpsIconWrap}>
                      <Ionicons name="navigate" size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.gpsBtnTxt}>Use my current location</Text>
                      <Text style={st.gpsBtnSub}>Auto-fill address via GPS</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                  </>
                )}
              </TouchableOpacity>
              <View style={st.orRow}>
                <View style={st.orLine} />
                <Text style={st.orTxt}>or enter manually</Text>
                <View style={st.orLine} />
              </View>
              <View style={st.card}>
                <View style={st.cardLabelRow}>
                  <View style={[st.cardIconBox, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
                    <Ionicons name="location-outline" size={16} color="#ec4899" />
                  </View>
                  <Text style={st.cardLabel}>Service address</Text>
                </View>
                <TextInput
                  style={st.inputField}
                  placeholder="e.g. 12 Independence Ave, Accra"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={address}
                  onChangeText={setAddress}
                  maxLength={250}
                />
                {!!address && (
                  <TouchableOpacity style={st.clearBtn} onPress={() => setAddress('')}>
                    <Ionicons name="close-circle" size={16} color={MUTED} />
                    <Text style={st.clearTxt}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={st.card}>
                <View style={st.cardLabelRow}>
                  <View style={[st.cardIconBox, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                    <Ionicons name="document-text-outline" size={16} color="#6366f1" />
                  </View>
                  <Text style={st.cardLabel}>Additional notes <Text style={st.optional}>(optional)</Text></Text>
                </View>
                <TextInput
                  style={[st.textArea, { minHeight: 90 }]}
                  placeholder="Gate code, landmark, special instructions…"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={250}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          {/* ── STEP 3: Review & Confirm ──────────────────────────────────── */}
          {step === 3 && (
            <>
              <Text style={st.stepHeading}>Review & confirm</Text>
              <View style={st.card}>
                <Text style={st.cardLabel}>Expert</Text>
                <SummaryRow label="Name"     value={expert.displayName} />
                <SummaryDivider />
                <SummaryRow label="Service"  value={expert.profession} />
                <SummaryDivider />
                <SummaryRow label="Category" value={category} />
              </View>
              <View style={st.card}>
                <Text style={st.cardLabel}>Job details</Text>
                <Text style={st.reviewDesc}>{description}</Text>
              </View>
              <View style={st.card}>
                <Text style={st.cardLabel}>Schedule</Text>
                <SummaryRow label="Date"    value={selectedDate} />
                <SummaryDivider />
                <SummaryRow label="Time"    value={timeSlot} />
                <SummaryDivider />
                <SummaryRow label="Address" value={address} />
                {!!note && <><SummaryDivider /><SummaryRow label="Note" value={note} /></>}
              </View>
              <View style={[st.card, { gap: 0 }]}>
                <View style={st.payRow}>
                  <Text style={st.payLabel}>Agreed amount</Text>
                  <Text style={st.payAmount}>¢{cost.toFixed(2)}</Text>
                </View>
                <View style={st.payDivider} />
                <View style={st.onSiteRow}>
                  <View style={st.onSiteIconWrap}>
                    <Ionicons name="cash-outline" size={16} color={GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.onSiteTitle}>Pay on-site</Text>
                    <Text style={st.onSiteSub}>Payment is made directly to the expert when they arrive</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      <View style={[st.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step > 0 && (
          <TouchableOpacity style={st.backBarBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={[st.nextBtn, !canContinue() && st.nextBtnDisabled]} onPress={goNext} disabled={!canContinue()} activeOpacity={0.85}>
            <Text style={st.nextBtnTxt}>Continue</Text>
            <Ionicons name="arrow-forward" size={17} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[st.confirmBtn, submitting && { opacity: 0.6 }]} onPress={confirm} disabled={submitting} activeOpacity={0.85}>
            {submitting
              ? <ActivityIndicator size="small" color="#ffffff" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                  <Text style={st.confirmBtnTxt}>Confirm Booking</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Animated success overlay ──────────────────────────────────────── */}
      <SuccessOverlay
        visible={showSuccess}
        expert={expert}
        booking={booking}
        onHome={() => navigation.navigate('Home')}
        onJobs={() => navigation.navigate('Jobs')}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerBack:  { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerMid:   { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  headerSub:   { color: MUTED, fontSize: 12, marginTop: 2 },

  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 16, borderRadius: 2 },
  progressFill:  { height: 3, backgroundColor: ACCENT, borderRadius: 2 },

  stepsRow:       { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  stepItem:       { alignItems: 'center', gap: 6 },
  stepDot:        { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  stepDotActive:  { backgroundColor: ACCENT, borderColor: ACCENT },
  stepDotDone:    { backgroundColor: GREEN, borderColor: GREEN },
  stepDotNum:     { color: MUTED, fontSize: 12, fontWeight: '700' },
  stepLabel:      { color: MUTED, fontSize: 10, fontWeight: '600' },
  stepLabelActive:{ color: '#ffffff' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  expertCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 20 },
  expertAvatar:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  expertInitials:  { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  expertName:      { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  expertRole:      { color: MUTED, fontSize: 12, marginTop: 2 },
  expertPriceBadge:{ backgroundColor: 'rgba(230,57,70,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(230,57,70,0.3)' },
  expertPriceTxt:  { color: ACCENT, fontSize: 12, fontWeight: '700' },

  stepHeading: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },

  card:         { backgroundColor: CARD, borderRadius: 18, padding: 18, marginBottom: 14, gap: 14 },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel:    { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardIconBox:  { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optional:     { color: 'rgba(255,255,255,0.25)', fontWeight: '400', textTransform: 'none' },

  chipsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive:   { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTxt:      { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },
  chipTxtActive:{ color: '#ffffff' },

  textArea:  { backgroundColor: INPUT, borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 14, lineHeight: 22, minHeight: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  charCount: { color: MUTED, fontSize: 11, textAlign: 'right' },

  budgetBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  budgetSymbol: { color: ACCENT, fontSize: 22, fontWeight: '800', marginRight: 6 },
  budgetInput:  { flex: 1, color: '#ffffff', fontSize: 28, fontWeight: '800', paddingVertical: 14 },
  budgetHint:   { color: MUTED, fontSize: 12, marginTop: -6 },

  dateScroll:     { marginHorizontal: -4 },
  dateCard:       { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginHorizontal: 4, backgroundColor: INPUT, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', minWidth: 66 },
  dateCardActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  dateName:       { color: MUTED, fontSize: 11, fontWeight: '700' },
  dateNameActive: { color: '#ffffff' },
  dateNum:        { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  dateNumActive:  { color: '#ffffff' },

  timeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: INPUT, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  timeChipActive:   { backgroundColor: ACCENT, borderColor: ACCENT },
  timeChipTxt:      { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  timeChipTxtActive:{ color: '#ffffff' },

  gpsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: ACCENT, borderRadius: 16, padding: 16, marginBottom: 6 },
  gpsIconWrap:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  gpsBtnTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  gpsBtnSub:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  orRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  orTxt:  { color: MUTED, fontSize: 12, fontWeight: '600' },

  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: -6 },
  clearTxt: { color: MUTED, fontSize: 12 },

  inputField: { backgroundColor: INPUT, borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  summaryRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  summaryLabel:   { color: MUTED, fontSize: 13, fontWeight: '500', flex: 1 },
  summaryValue:   { color: '#ffffff', fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  reviewDesc:     { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 22 },

  payRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  payDivider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  payLabel:     { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  payAmount:    { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  onSiteRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', marginTop: 4 },
  onSiteIconWrap:{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  onSiteTitle:  { color: GREEN, fontSize: 14, fontWeight: '700' },
  onSiteSub:    { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2, lineHeight: 17 },

  bottomBar:   { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#161614', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  backBarBtn:  { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  nextBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: ACCENT },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnTxt:  { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  confirmBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, backgroundColor: GREEN },
  confirmBtnTxt:{ color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // ── Success overlay ──────────────────────────────────────────────────────────
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0c0c0a',
    zIndex: 999,
  },
  successScroll: {
    flexGrow: 1, alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48,
  },

  checkWrap:   { alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  ring:        { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: GREEN },
  checkCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 8 }, elevation: 16 },

  successTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  successSub:   { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  successCard: { width: '100%', backgroundColor: CARD, borderRadius: 20, padding: 18, marginTop: 28, gap: 14 },

  successExpertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  successAvatar:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  successAvatarTxt: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  successExpertName:{ color: '#ffffff', fontSize: 15, fontWeight: '700' },
  successExpertRole:{ color: MUTED, fontSize: 12, marginTop: 2 },
  pendingBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  pendingDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  pendingTxt:       { color: '#f59e0b', fontSize: 11, fontWeight: '700' },

  successDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  successDetailRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  successDetailIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  successDetailLabel: { color: MUTED, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  successDetailValue: { color: '#ffffff', fontSize: 13, fontWeight: '600', lineHeight: 19 },

  successBtns:        { width: '100%', flexDirection: 'row', gap: 10, marginTop: 28 },
  successBtnOutline:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 52, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' },
  successBtnOutlineTxt:{ color: '#ffffff', fontSize: 14, fontWeight: '700' },
  successBtnSolid:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 52, borderRadius: 14, backgroundColor: GREEN },
  successBtnSolidTxt: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
