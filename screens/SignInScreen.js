// SignInScreen.js — Email/password sign-in with Google and Apple options.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TouchableOpacity, Animated, useWindowDimensions,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import AnimatedButton from '../components/AnimatedButton';

// Maps Firebase error codes to readable messages.
function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// Animated form field with focus highlight.
function Field({ label, placeholder, secure, value, onChange, delay, keyboard }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        secureTextEntry={secure}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        keyboardType={keyboard || 'default'}
      />
    </Animated.View>
  );
}


export default function SignInScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets    = useSafeAreaInsets();

  const isTablet = width >= 768;
  const padH     = isTablet ? 64 : 28;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerY,    { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Email/password sign-in ────────────────────────────────────────────────
  const handleSignIn = async () => {
    setError('');
    if (!email.trim())    return setError('Please enter your email.');
    if (!password)        return setError('Please enter your password.');

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // AuthContext detects the new user and App.js switches to AppNavigator automatically.
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.backRow, { paddingHorizontal: padH, paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={styles.backInner}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>Back</Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: padH }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerY }] }}>
            <Text style={[styles.title, { fontSize: isTablet ? 40 : 32 }]}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your Architect account</Text>
          </Animated.View>

          <View style={{ height: 40 }} />

          <Field label="Email"    placeholder="you@example.com" value={email}    onChange={t => { setEmail(t); setError(''); }}    delay={150} keyboard="email-address" />
          <Field label="Password" placeholder="••••••••"        secure value={password} onChange={t => { setPassword(t); setError(''); }} delay={280} />

          <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Inline error message */}
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={{ height: 16 }} />

          <AnimatedButton
            label="Sign in"
            style={styles.btnPrimary}
            textStyle={styles.btnPrimaryText}
            onPress={handleSignIn}
            loading={loading}
          />

          <View style={{ height: 28 }} />

          <TouchableOpacity style={styles.switchRow} onPress={() => navigation.navigate('CreateAccount')}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <Text style={styles.switchLink}>Create one</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#111110' },
  backRow:     { paddingTop: 4 },
  backBtn:     { paddingVertical: 10, alignSelf: 'flex-start' },
  backInner:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow:   { color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 20 },
  backText:    { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 20 },
  scroll:      { flexGrow: 1, paddingTop: 12, paddingBottom: 40 },
  title:       { color: '#ffffff', fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle:    { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  label:       { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
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
  forgotRow:   { alignSelf: 'flex-end', marginTop: 4 },
  forgotText:  { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  errorText:   { color: '#ff6b6b', fontSize: 13, marginTop: 8, textAlign: 'center' },
  btnPrimary:  { backgroundColor: '#ffffff', borderRadius: 50, height: 54, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#111110', fontSize: 16, fontWeight: '600' },
  switchRow:   { flexDirection: 'row', justifyContent: 'center' },
  switchText:  { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  switchLink:  { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
});
