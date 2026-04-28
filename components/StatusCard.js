import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StatusCard({ balance = '¢40.00', status = 'Active', onLocationPress }) {
  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <Text style={styles.label}>BALANCE</Text>
        <Text style={styles.balance}>{balance}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.label}>EXPERT STATUS</Text>
        <Text style={styles.status}>{status}</Text>
      </View>

      <TouchableOpacity style={styles.locationBtn} onPress={onLocationPress} activeOpacity={0.8}>
        <Ionicons name="location-sharp" size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingLeft: 22,
    paddingRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  section: {
    flex: 1,
    gap: 5,
  },
  label: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  balance: {
    color: '#111110',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  status: {
    color: '#dc2626',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 18,
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
