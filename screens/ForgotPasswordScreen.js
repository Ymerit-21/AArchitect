import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import AnimatedButton from '../components/AnimatedButton';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const fieldAnim  = useRef(new Animated.Value(0)).current;
  const fieldY     = useRef(new Animated.Value(20)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerY,    { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(fieldAnim, { toValue: 1, duration: 500, delay: 180, useNativeDriver: true }),
      Animated.spring(fieldY,    { toValue: 0, delay: 180, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const showSuccess = () => {
    setSent(true);
    Animated.parallel([
      Animated.timing(successAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(successScale, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const handleSend = async () => {
    setError('');
    if (!email.trim()) return setError('Please enter your email address.');

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showSuccess();
    } catch (e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email') {
        setError('No account found with that email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.backRow, { paddingHorizontal: 28, paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backInner}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerY }] }}>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a reset link.
            </Text>
          </Animated.View>

          <View style={{ height: 40 }} />

          {sent ? (
            <Animated.View style={[styles.successBox, { opacity: successAnim, transform: [{ scale: successScale }] }]}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successBody}>
                We sent a reset link to{'\n'}
                <Text style={styles.successEmail}>{email.trim()}</Text>
              </Text>
              <View style={{ height: 24 }} />
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
                <Text style={styles.backToSignIn}>Back to Sign in →</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: fieldAnim, transform: [{ translateY: fieldY }] }}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, focused && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <View style={{ height: 24 }} />

              <AnimatedButton
                label="Send reset link"
                style={styles.btn}
                textStyle={styles.btnText}
                onPress={handleSend}
                loading={loading}
              />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#111110' },
  backRow:   { paddingTop: 4 },
  backBtn:   { paddingVertical: 10, alignSelf: 'flex-start' },
  backInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 20 },
  backText:  { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 20 },
  scroll:    { flexGrow: 1, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 40 },
  title:     { color: '#ffffff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle:  { color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 22 },
  label:     { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  inputFocused: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' },
  errorText: { color: '#ff6b6b', fontSize: 13, marginTop: 10, textAlign: 'center' },
  btn:       { backgroundColor: '#ffffff', borderRadius: 50, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnText:   { color: '#111110', fontSize: 16, fontWeight: '600' },
  successBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 32,
    alignItems: 'center',
  },
  successIcon:  { fontSize: 44, marginBottom: 16 },
  successTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  successBody:  { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  successEmail: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  backToSignIn: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
});
