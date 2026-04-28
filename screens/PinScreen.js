import { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, addDoc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const KEYPAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinScreen({ navigation, route }) {
  const insets       = useSafeAreaInsets();
  const { user }     = useAuth();
  const { amount, method, type } = route.params || {};

  const [pin,        setPin]        = useState('');
  const [processing, setProcessing] = useState(false);
  const shakeAnim    = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start(() => setPin(''));
  };

  const handleKey = (key) => {
    if (processing) return;
    if (key === '') return;
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    setPin(p => p + key);
  };

  const handleConfirm = async () => {
    if (pin.length < 4) { shake(); return; }
    if (processing) return;

    const isSend    = type === 'send';
    const txAmount  = isSend ? -Math.abs(amount ?? 0) : Math.abs(amount ?? 0);
    const txType    = isSend ? 'send' : 'deposit';

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        balance: increment(txAmount),
      });
      await addDoc(collection(db, 'users', user.uid, 'transactions'), {
        amount:    txAmount,
        type:      txType,
        method:    method ?? 'Unknown',
        createdAt: serverTimestamp(),
      });
      navigation.popToTop();
    } catch {
      Alert.alert('Error', 'Transaction failed. Please try again.');
      setPin('');
    } finally {
      setProcessing(false);
    }
  };

  const isDeposit = type !== 'send';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { marginLeft: 20, marginTop: 8 }]}>
        <Ionicons name="arrow-back" size={20} color="#ffffff" />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: isDeposit ? 'rgba(74,222,128,0.12)' : 'rgba(230,57,70,0.12)' }]}>
          <Ionicons
            name={isDeposit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
            size={32}
            color={isDeposit ? '#4ade80' : '#e63946'}
          />
        </View>

        <Text style={styles.title}>Authorise Payment</Text>
        <Text style={styles.subtitle}>
          {isDeposit ? 'Adding' : 'Sending'} ¢{Number(amount ?? 0).toFixed(2)}{'\n'}via {method ?? 'Mobile Money'}
        </Text>

        <Text style={styles.hint}>Enter your 4-digit PIN</Text>

        {/* PIN dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </Animated.View>

        {/* Keypad */}
        <View style={styles.keypadGrid}>
          {KEYPAD.map((k, i) => (
            k === '' ? (
              <View key={i} style={styles.keyBtn} />
            ) : (
              <TouchableOpacity key={i} style={styles.keyBtn} onPress={() => handleKey(k)} activeOpacity={0.6} disabled={processing}>
                {k === '⌫' ? (
                  <Ionicons name="backspace-outline" size={24} color="rgba(255,255,255,0.65)" />
                ) : (
                  <Text style={styles.keyText}>{k}</Text>
                )}
              </TouchableOpacity>
            )
          ))}
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, (pin.length < 4 || processing) && styles.confirmBtnDim]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={processing}
        >
          {processing
            ? <ActivityIndicator size="small" color="#ffffff" />
            : <Text style={styles.confirmText}>Confirm</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#111110' },
  backBtn: { padding: 8, alignSelf: 'flex-start' },

  body:     { flex: 1, alignItems: 'center', paddingTop: 12, paddingHorizontal: 24 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title:    { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 32 },
  hint:     { color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 24 },

  dotsRow:   { flexDirection: 'row', gap: 22, marginBottom: 44 },
  dot:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)' },
  dotFilled: { backgroundColor: '#e63946', borderColor: '#e63946' },

  keypadGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 300 },
  keyBtn:     { width: '33.33%', paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  keyText:    { color: '#ffffff', fontSize: 28, fontWeight: '300' },

  confirmBtn:    { marginTop: 16, backgroundColor: '#e63946', borderRadius: 50, paddingVertical: 16, width: '100%', alignItems: 'center' },
  confirmBtnDim: { backgroundColor: 'rgba(255,255,255,0.1)' },
  confirmText:   { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
