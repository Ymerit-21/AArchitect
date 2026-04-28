import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const ADMIN_EMAIL = 'admin1234@test.com';

const ITEMS = [
  { tab: 'home',     iconOn: 'home',       iconOff: 'home-outline',       route: 'Home'        },
  { tab: 'messages', iconOn: 'chatbubble', iconOff: 'chatbubble-outline', route: 'Messages'    },
  { tab: 'saved',    iconOn: 'storefront', iconOff: 'storefront-outline', route: 'Marketplace' },
  { tab: 'grid',     iconOn: 'stats-chart', iconOff: 'stats-chart-outline', route: 'FinancialHub'},
  { tab: 'profile',  iconOn: 'person',     iconOff: 'person-outline',     route: 'Profile'     },
];

export default function BottomNav({ activeTab, navigation, bottomInset = 10 }) {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <View style={[st.nav, { paddingBottom: bottomInset }]}>
      {ITEMS.map(item => {
        const active = item.tab === activeTab;
        // Grid → FinancialHub for users, AdminHome for admin
        const route = item.tab === 'grid'
          ? (isAdmin ? 'AdminHome' : 'FinancialHub')
          : item.route;

        return (
          <TouchableOpacity
            key={item.tab}
            style={st.item}
            activeOpacity={0.7}
            onPress={() => {
              if (!route || active) return;
              navigation.navigate(route);
            }}
          >
            <Ionicons
              name={active ? item.iconOn : item.iconOff}
              size={24}
              color={active ? '#e63946' : '#9ca3af'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  nav:  { flexDirection: 'row', backgroundColor: '#ffffff', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  item: { flex: 1, alignItems: 'center' },
});
