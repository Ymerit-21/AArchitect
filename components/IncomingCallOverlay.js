import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, Easing, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserData } from '../context/UserDataContext';

function initials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function IncomingCallOverlay({ navRef }) {
  const { incomingCall, clearIncomingCall } = useUserData();

  const [localCall, setLocalCall] = useState(null);
  const [visible,   setVisible]   = useState(false);

  const pulse1     = useRef(new Animated.Value(1)).current;
  const pulse2     = useRef(new Animated.Value(1)).current;
  const slideY     = useRef(new Animated.Value(300)).current;
  const pulseAnim  = useRef(null);

  const slideOut = (cb) => {
    pulseAnim.current?.stop();
    Animated.timing(slideY, {
      toValue:  300,
      duration: 260,
      easing:   Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setLocalCall(null);
      clearIncomingCall();
      cb?.();
    });
  };

  useEffect(() => {
    if (!incomingCall) {
      if (localCall) slideOut();
      return;
    }

    setLocalCall(incomingCall);
    setVisible(true);
    slideY.setValue(300);
    pulse1.setValue(1);
    pulse2.setValue(1);

    Animated.spring(slideY, {
      toValue:  0,
      tension:  65,
      friction: 11,
      useNativeDriver: true,
    }).start();

    const anim = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1.7, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(val, { toValue: 1,   duration: 0,    useNativeDriver: true }),
      ]),
    );
    const a1 = anim(pulse1, 0);
    const a2 = anim(pulse2, 600);
    pulseAnim.current = { stop: () => { a1.stop(); a2.stop(); } };
    a1.start(); a2.start();
  }, [incomingCall?.id]);

  const accept = async () => {
    const call = localCall;
    if (!call) return;
    try {
      await updateDoc(doc(db, 'calls', call.id), { status: 'accepted' });
    } catch {}
    slideOut(() => {
      navRef?.current?.navigate('Call', {
        callId:    call.id,
        isCaller:  false,
        type:      call.type ?? 'voice',
        otherName: call.callerName ?? 'Caller',
        otherUid:  call.callerId,
        avatarBg:  call.callerAvatarBg ?? '#e63946',
      });
    });
  };

  const reject = async () => {
    const call = localCall;
    if (!call) return;
    try {
      await updateDoc(doc(db, 'calls', call.id), { status: 'rejected' });
    } catch {}
    slideOut();
  };

  if (!localCall) return null;

  const bg = localCall.callerAvatarBg ?? '#e63946';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={reject}
    >
      <View style={st.overlay} pointerEvents="box-none">
        <Animated.View style={[st.sheet, { transform: [{ translateY: slideY }] }]}>

          {/* Call type label */}
          <View style={st.typeRow}>
            <Ionicons
              name={localCall.type === 'video' ? 'videocam-outline' : 'call-outline'}
              size={14}
              color="rgba(255,255,255,0.6)"
            />
            <Text style={st.typeTxt}>
              Incoming {localCall.type === 'video' ? 'video' : 'voice'} call
            </Text>
          </View>

          {/* Avatar with pulsing rings */}
          <View style={st.avatarWrap}>
            <Animated.View style={[st.ring, {
              transform: [{ scale: pulse1 }],
              opacity: pulse1.interpolate({ inputRange: [1, 1.7], outputRange: [0.3, 0] }),
              backgroundColor: bg,
            }]} />
            <Animated.View style={[st.ring, {
              transform: [{ scale: pulse2 }],
              opacity: pulse2.interpolate({ inputRange: [1, 1.7], outputRange: [0.18, 0] }),
              backgroundColor: bg,
            }]} />
            <View style={[st.avatar, { backgroundColor: bg }]}>
              <Text style={st.avatarTxt}>{initials(localCall.callerName)}</Text>
            </View>
          </View>

          <Text style={st.name}>{localCall.callerName ?? 'Someone'}</Text>
          <Text style={st.sub}>is calling you…</Text>

          {/* Action buttons */}
          <View style={st.btnRow}>
            {/* Reject */}
            <View style={st.btnWrap}>
              <TouchableOpacity style={[st.btn, st.btnReject]} onPress={reject} activeOpacity={0.85}>
                <Ionicons name="call" size={28} color="#ffffff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={st.btnLbl}>Decline</Text>
            </View>

            {/* Accept */}
            <View style={st.btnWrap}>
              <TouchableOpacity style={[st.btn, st.btnAccept]} onPress={accept} activeOpacity={0.85}>
                <Ionicons name="call" size={28} color="#ffffff" />
              </TouchableOpacity>
              <Text style={st.btnLbl}>Accept</Text>
            </View>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor:  '#111110',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:    32,
    paddingBottom: 52,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor:    '#000',
    shadowOpacity:  0.5,
    shadowRadius:   24,
    shadowOffset:   { width: 0, height: -8 },
    elevation:      32,
  },
  typeRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    backgroundColor:  'rgba(255,255,255,0.08)',
    borderRadius:     20,
    paddingHorizontal: 12,
    paddingVertical:   5,
    marginBottom:     8,
  },
  typeTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },

  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  ring:       { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  avatar:     { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.14)' },
  avatarTxt:  { color: '#ffffff', fontSize: 34, fontWeight: '800' },

  name: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  sub:  { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: '500', marginBottom: 8 },

  btnRow:  { flexDirection: 'row', gap: 64, marginTop: 16 },
  btnWrap: { alignItems: 'center', gap: 10 },
  btn: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  btnReject: { backgroundColor: '#e63946', shadowColor: '#e63946' },
  btnAccept: { backgroundColor: '#22c55e', shadowColor: '#22c55e' },
  btnLbl:    { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
});
