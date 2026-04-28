import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { tab: 'overview', iconOn: 'bar-chart',        iconOff: 'bar-chart-outline',        label: 'Overview', route: 'AdminHome'    },
  { tab: 'experts',  iconOn: 'shield-checkmark', iconOff: 'shield-checkmark-outline', label: 'Experts',  route: 'AdminExperts' },
  { tab: 'users',    iconOn: 'people',           iconOff: 'people-outline',           label: 'Users',    route: 'AdminUsers'   },
];

export default function AdminBottomNav({ activeTab, navigation, bottomInset = 10, pendingCount = 0 }) {
  return (
    <View style={[st.nav, { paddingBottom: bottomInset }]}>
      {TABS.map(item => {
        const active = item.tab === activeTab;
        return (
          <TouchableOpacity
            key={item.tab}
            style={st.item}
            activeOpacity={0.7}
            onPress={() => { if (!active) navigation.navigate(item.route); }}
          >
            <View style={st.iconWrap}>
              <Ionicons
                name={active ? item.iconOn : item.iconOff}
                size={24}
                color={active ? '#e63946' : '#9ca3af'}
              />
              {item.tab === 'experts' && pendingCount > 0 && (
                <View style={st.badge}>
                  <Text style={st.badgeTxt}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                </View>
              )}
            </View>
            <Text style={[st.label, active && st.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  nav:       { flexDirection: 'row', backgroundColor: '#ffffff', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  item:      { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap:  { position: 'relative' },
  label:     { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  labelActive:{ color: '#e63946', fontWeight: '700' },
  badge:     { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt:  { color: '#ffffff', fontSize: 9, fontWeight: '800' },
});
