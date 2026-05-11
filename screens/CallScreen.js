import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Easing, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function initials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen({ navigation, route }) {
  const params    = route.params ?? {};
  const callId    = params.callId;
  const isCaller  = params.isCaller  ?? false;
  const otherName = params.otherName ?? params.name ?? 'User';
  const avatarBg  = params.avatarBg  ?? '#e63946';
  const callType  = params.type      ?? 'voice';

  const insets = useSafeAreaInsets();

  // Callee starts connected (they accepted before arriving here)
  const [status,   setStatus]   = useState(isCaller ? 'calling' : 'connected');
  const [duration, setDuration] = useState(0);
  const [muted,    setMuted]    = useState(false);
  const [speaker,  setSpeaker]  = useState(false);
  const [cameraOn, setCameraOn] = useState(callType === 'video');

  const pulse1     = useRef(new Animated.Value(1)).current;
  const pulse2     = useRef(new Animated.Value(1)).current;
  const timerRef   = useRef(null);
  const timeoutRef = useRef(null);
  const endedRef   = useRef(false);  // guard against double-end

  // ── Pulsing rings ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const anim = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1.8, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(val, { toValue: 1,   duration: 0,    useNativeDriver: true }),
      ]),
    );
    const a1 = anim(pulse1, 0);
    const a2 = anim(pulse2, 700);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  // ── Listen to call doc for status changes ─────────────────────────────────────
  useEffect(() => {
    if (!callId) return;
    const unsub = onSnapshot(doc(db, 'calls', callId), snap => {
      if (!snap.exists()) return;
      const s = snap.data().status;

      if (s === 'accepted' && status !== 'connected') {
        setStatus('connected');
      }
      if ((s === 'ended' || s === 'rejected' || s === 'missed') && !endedRef.current) {
        endedRef.current = true;
        clearInterval(timerRef.current);
        clearTimeout(timeoutRef.current);
        setStatus(s === 'rejected' ? 'declined' : 'ended');
        setTimeout(() => navigation.goBack(), 1800);
      }
    }, () => {});
    return unsub;
  }, [callId, status]);

  // ── Start timer when connected ────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'connected') {
      clearTimeout(timeoutRef.current);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  // ── 30-second ring timeout for caller ────────────────────────────────────────
  useEffect(() => {
    if (!isCaller || status !== 'calling') return;
    timeoutRef.current = setTimeout(async () => {
      if (callId && !endedRef.current) {
        endedRef.current = true;
        await updateDoc(doc(db, 'calls', callId), { status: 'missed' }).catch(() => {});
        setStatus('ended');
        setTimeout(() => navigation.goBack(), 1500);
      }
    }, 30000);
    return () => clearTimeout(timeoutRef.current);
  }, [isCaller, status]);

  // ── Hang up ───────────────────────────────────────────────────────────────────
  const hangUp = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    clearTimeout(timeoutRef.current);
    if (callId) {
      await updateDoc(doc(db, 'calls', callId), { status: 'ended' }).catch(() => {});
    }
    navigation.goBack();
  };

  const statusLabel =
    status === 'calling'   ? 'Ringing…'
    : status === 'connected' ? fmtDuration(duration)
    : status === 'declined'  ? 'Call declined'
    : 'Call ended';

  const showPulse = status === 'calling';

  return (
    <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#111110" />

      {/* Top info */}
      <View style={st.topSection}>
        <View style={st.callTypePill}>
          <Ionicons
            name={callType === 'video' ? 'videocam-outline' : 'call-outline'}
            size={13}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={st.callTypeTxt}>{callType === 'video' ? 'Video call' : 'Voice call'}</Text>
        </View>
        <Text style={st.nameTxt}>{otherName}</Text>
        <Text style={[st.statusTxt, status === 'declined' && { color: '#e63946' }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Avatar with pulsing rings */}
      <View style={st.avatarSection}>
        {showPulse && (
          <>
            <Animated.View style={[st.pulseRing, {
              transform: [{ scale: pulse1 }],
              opacity: pulse1.interpolate({ inputRange: [1, 1.8], outputRange: [0.35, 0] }),
            }]} />
            <Animated.View style={[st.pulseRing, {
              transform: [{ scale: pulse2 }],
              opacity: pulse2.interpolate({ inputRange: [1, 1.8], outputRange: [0.22, 0] }),
            }]} />
          </>
        )}
        <View style={[st.avatar, { backgroundColor: avatarBg }]}>
          <Text style={st.avatarTxt}>{initials(otherName)}</Text>
        </View>
        {status === 'connected' && (
          <View style={st.connectedBadge}>
            <View style={st.connectedDot} />
            <Text style={st.connectedTxt}>Connected</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={st.controls}>
        <View style={st.controlRow}>

          {/* Mute */}
          <View style={st.ctrlWrap}>
            <TouchableOpacity
              style={[st.ctrlBtn, muted && st.ctrlBtnActive]}
              onPress={() => setMuted(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={muted ? 'mic-off' : 'mic-outline'}
                size={24}
                color={muted ? '#111110' : '#ffffff'}
              />
            </TouchableOpacity>
            <Text style={st.ctrlLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
          </View>

          {/* Speaker / Camera */}
          {callType === 'video' ? (
            <View style={st.ctrlWrap}>
              <TouchableOpacity
                style={[st.ctrlBtn, !cameraOn && st.ctrlBtnActive]}
                onPress={() => setCameraOn(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cameraOn ? 'videocam-outline' : 'videocam-off-outline'}
                  size={24}
                  color={!cameraOn ? '#111110' : '#ffffff'}
                />
              </TouchableOpacity>
              <Text style={st.ctrlLabel}>{cameraOn ? 'Cam off' : 'Cam on'}</Text>
            </View>
          ) : (
            <View style={st.ctrlWrap}>
              <TouchableOpacity
                style={[st.ctrlBtn, speaker && st.ctrlBtnActive]}
                onPress={() => setSpeaker(v => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={speaker ? 'volume-high-outline' : 'volume-low-outline'}
                  size={24}
                  color={speaker ? '#111110' : '#ffffff'}
                />
              </TouchableOpacity>
              <Text style={st.ctrlLabel}>{speaker ? 'Earpiece' : 'Speaker'}</Text>
            </View>
          )}

          {/* Flip / Add */}
          <View style={st.ctrlWrap}>
            <TouchableOpacity style={st.ctrlBtn} activeOpacity={0.8}>
              <Ionicons
                name={callType === 'video' ? 'camera-reverse-outline' : 'person-add-outline'}
                size={24}
                color="#ffffff"
              />
            </TouchableOpacity>
            <Text style={st.ctrlLabel}>{callType === 'video' ? 'Flip' : 'Add'}</Text>
          </View>

        </View>

        {/* Hang up */}
        <TouchableOpacity style={st.hangUpBtn} onPress={hangUp} activeOpacity={0.85}>
          <Ionicons name="call" size={28} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#111110', alignItems: 'center', justifyContent: 'space-between' },
  topSection:    { alignItems: 'center', paddingTop: 32, gap: 8 },
  callTypePill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  callTypeTxt:   { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  nameTxt:       { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  statusTxt:     { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500' },

  avatarSection: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  pulseRing:     { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#e63946' },
  avatar:        { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)' },
  avatarTxt:     { color: '#ffffff', fontSize: 38, fontWeight: '800' },

  connectedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  connectedDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  connectedTxt:  { color: '#22c55e', fontSize: 13, fontWeight: '700' },

  controls:      { width: '100%', alignItems: 'center', gap: 32, paddingHorizontal: 24 },
  controlRow:    { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  ctrlWrap:      { alignItems: 'center', gap: 8 },
  ctrlBtn:       { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  ctrlBtnActive: { backgroundColor: '#ffffff' },
  ctrlLabel:     { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },

  hangUpBtn:     { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center', shadowColor: '#e63946', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
