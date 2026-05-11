import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const ADMIN_EMAIL = 'admin1234@test.com';

const ITEMS = [
  { tab: 'home',     iconOn: 'home',        iconOff: 'home-outline',        route: 'Home'        },
  { tab: 'messages', iconOn: 'chatbox',     iconOff: 'chatbox-outline',     route: 'Messages'    },
  { tab: 'saved',    iconOn: 'storefront',  iconOff: 'storefront-outline',  route: 'Marketplace' },
  { tab: 'grid',     iconOn: 'stats-chart', iconOff: 'stats-chart-outline', route: 'FinancialHub'},
  { tab: 'profile',  iconOn: 'person',      iconOff: 'person-outline',      route: 'Profile'     },
];

// Animated badge that pops when count changes
function AnimatedBadge({ count }) {
  const scale   = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const prevRef = useRef(count);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = count;

    if (count > 0 && prev === 0) {
      // Pop in
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }).start();
    } else if (count === 0 && prev > 0) {
      // Shrink out
      Animated.spring(scale, { toValue: 0, tension: 180, friction: 8, useNativeDriver: true }).start();
    } else if (count > 0 && count !== prev) {
      // Bump on count change
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.4, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1,   tension: 200, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [count]);

  const label = count > 99 ? '99+' : String(count);

  return (
    <Animated.View
      style={[
        st.badge,
        label.length > 1 && st.badgeWide,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={st.badgeTxt}>{label}</Text>
    </Animated.View>
  );
}

export default function BottomNav({ activeTab, navigation, bottomInset = 10 }) {
  const { user }           = useAuth();
  const { unreadMessages } = useUserData();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <View style={[st.nav, { paddingBottom: bottomInset }]}>
      {ITEMS.map(item => {
        const active     = item.tab === activeTab;
        const route      = item.tab === 'grid' ? (isAdmin ? 'AdminHome' : 'FinancialHub') : item.route;
        const badgeCount = item.tab === 'messages' ? (unreadMessages ?? 0) : 0;

        return (
          <TouchableOpacity
            key={item.tab}
            style={st.item}
            activeOpacity={0.7}
            onPress={() => { if (!route || active) return; navigation.navigate(route); }}
          >
            <View style={st.iconContainer}>
              <Ionicons
                name={active ? item.iconOn : item.iconOff}
                size={24}
                color={active ? '#e63946' : '#9ca3af'}
              />
              {item.tab === 'messages' && (
                <AnimatedBadge count={badgeCount} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  nav:  {
    flexDirection:  'row',
    backgroundColor: '#ffffff',
    paddingTop:     14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  item: { flex: 1, alignItems: 'center' },

  // Fixed-size container so the badge never shifts the icon or clips
  iconContainer: {
    width:           34,
    height:          34,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },

  badge: {
    position:          'absolute',
    top:               -6,
    right:             -10,
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   '#e63946',
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
    borderWidth:       2,
    borderColor:       '#ffffff',
  },
  badgeWide: { right: -16, minWidth: 24, borderRadius: 10 },
  badgeTxt:  { color: '#ffffff', fontSize: 10, fontWeight: '900', lineHeight: 13 },
});
