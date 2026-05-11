import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, Easing, PanResponder, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserData } from '../context/UserDataContext';

const AUTO_DISMISS_MS = 4500;

function initials(name = '') {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

const AVATAR_PALETTE = [
  '#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#0891b2','#65a30d',
];
function avatarColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export default function InAppMessageToast({ navRef }) {
  const insets = useSafeAreaInsets();
  const { incomingMessage, clearIncomingMessage } = useUserData();

  const queueRef = useRef([]);
  const busyRef  = useRef(false);
  const timerRef = useRef(null);

  const translateY = useRef(new Animated.Value(-200)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(1)).current;
  const progAnim   = useRef(null);
  const scaleAnim  = useRef(new Animated.Value(0.92)).current;

  const [current, setCurrent] = useState(null);

  // ── Slide out ────────────────────────────────────────────────────────────────
  const slideOut = (cb) => {
    clearTimeout(timerRef.current);
    progAnim.current?.stop();

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200, duration: 300,
        easing: Easing.in(Easing.back(1.2)), useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.92, duration: 280, useNativeDriver: true,
      }),
    ]).start(() => {
      translateX.setValue(0);
      busyRef.current = false;
      clearIncomingMessage();
      setCurrent(null);
      cb?.();
      // Show next queued message after a small gap
      setTimeout(showNext, 150);
    });
  };

  const dismiss = () => slideOut();

  // ── Slide in ─────────────────────────────────────────────────────────────────
  const showMsg = (msg) => {
    busyRef.current = true;
    setCurrent(msg);

    translateY.setValue(-200);
    translateX.setValue(0);
    opacity.setValue(0);
    scaleAnim.setValue(0.92);
    progress.setValue(1);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0, tension: 70, friction: 11, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 80, friction: 10, useNativeDriver: true,
      }),
    ]).start();

    progAnim.current = Animated.timing(progress, {
      toValue: 0, duration: AUTO_DISMISS_MS, easing: Easing.linear, useNativeDriver: false,
    });
    progAnim.current.start();

    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  };

  const showNext = () => {
    if (busyRef.current || queueRef.current.length === 0) return;
    showMsg(queueRef.current.shift());
  };

  // ── Enqueue incoming messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!incomingMessage) return;
    queueRef.current.push({ ...incomingMessage });
    if (!busyRef.current) showNext();
  }, [incomingMessage?.ts]);

  // ── Swipe to dismiss ──────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, g) =>
        Math.abs(g.dy) > 6 && g.dy < 0, // only upward swipe
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40 || g.vy < -0.6) {
          // Fling up
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -200, duration: 220,
              easing: Easing.in(Easing.ease), useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0, duration: 180, useNativeDriver: true,
            }),
          ]).start(() => {
            busyRef.current = false;
            clearIncomingMessage();
            setCurrent(null);
            translateX.setValue(0);
            setTimeout(showNext, 150);
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0, tension: 120, friction: 10, useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Top position: sit right below the status bar / notch
  const topOffset = Platform.OS === 'android'
    ? (insets.top > 0 ? insets.top + 6 : 30)
    : insets.top + 4;

  return (
    <Animated.View
      pointerEvents={current ? 'box-none' : 'none'}
      style={[
        st.wrapper,
        { top: topOffset, opacity, transform: [{ translateY }, { scale: scaleAnim }] },
      ]}
      {...panResponder.panHandlers}
    >
      {current && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            const msg = current;
            slideOut(() => {
              if (msg && navRef?.current) {
                navRef.current.navigate('Conversation', {
                  conversationId: msg.conversationId,
                  name:           msg.senderName,
                  otherUid:       msg.senderUid,
                  avatarBg:       msg.avatarBg ?? avatarColor(msg.senderName),
                });
              }
            });
          }}
          style={st.card}
        >
          {/* Avatar */}
          <View style={[st.avatar, { backgroundColor: current.avatarBg ?? avatarColor(current.senderName) }]}>
            <Text style={st.avatarTxt}>{initials(current.senderName)}</Text>
          </View>

          {/* Text content */}
          <View style={st.textCol}>
            <Text style={st.name} numberOfLines={1}>{current.senderName}</Text>
            <Text style={st.preview} numberOfLines={2}>{current.text}</Text>
          </View>

          {/* Dismiss X */}
          <TouchableOpacity
            onPress={dismiss}
            style={st.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 8 }}
          >
            <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Progress bar draining at bottom edge */}
      {current && (
        <Animated.View
          style={[
            st.progressBar,
            {
              width: progress.interpolate({
                inputRange: [0, 1], outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrapper: {
    position:      'absolute',
    left:          10,
    right:         10,
    zIndex:        9999,
    elevation:     30,
    // No background here — card below carries it
  },

  card: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(28,27,25,0.96)',
    borderRadius:      22,
    paddingVertical:   14,
    paddingHorizontal: 14,
    gap:               12,
    shadowColor:       '#000000',
    shadowOpacity:     0.55,
    shadowRadius:      28,
    shadowOffset:      { width: 0, height: 12 },
    // Subtle border for depth
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.07)',
    overflow:          'hidden',
  },

  avatar: {
    width:          50,
    height:         50,
    borderRadius:   25,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  avatarTxt: {
    color:      '#ffffff',
    fontSize:   18,
    fontWeight: '800',
  },

  textCol: { flex: 1 },

  name: {
    color:      '#ffffff',
    fontSize:   15,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  preview: {
    color:      'rgba(255,255,255,0.58)',
    fontSize:   13,
    lineHeight: 18,
  },

  closeBtn: {
    width:          26,
    height:         26,
    borderRadius:   13,
    backgroundColor:'rgba(255,255,255,0.1)',
    alignItems:     'center',
    justifyContent: 'center',
    alignSelf:      'flex-start',
    marginTop:      1,
  },

  progressBar: {
    height:          3,
    backgroundColor: '#e63946',
    borderRadius:    2,
    marginTop:       4,
    alignSelf:       'flex-start',
  },
});
