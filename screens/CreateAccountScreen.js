// CreateAccountScreen.js — New user registration form.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Animated, useWindowDimensions, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import AnimatedButton from '../components/AnimatedButton';

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// Animated form field — fades and slides up on mount.
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


export default function CreateAccountScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets    = useSafeAreaInsets();

  const isTablet = width >= 768;
  const padH     = isTablet ? 64 : 28;

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
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

  // ── Email/password registration ───────────────────────────────────────────
  const handleCreateAccount = async () => {
    setError('');
    if (!name.trim())              return setError('Please enter your name.');
    if (!email.trim())             return setError('Please enter your email.');
    if (!password)                 return setError('Please enter a password.');
    if (password !== confirm)      return setError('Passwords do not match.');

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', user.uid), {
        displayName:    name.trim(),
        email:          email.trim(),
        balance:        0,
        totalAvailable: 0,
        status:         'Active',
        tier:           'ARCHITECT ELITE',
        monthlyBudget:  0,
        monthlySpent:   0,
        createdAt:      serverTimestamp(),
      });
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
            <Text style={[styles.title, { fontSize: isTablet ? 40 : 32 }]}>Create account</Text>
            <Text style={styles.subtitle}>Join Architect — it's free to get started</Text>
          </Animated.View>

          <View style={{ height: 28 }} />

          <Field label="Full Name"        placeholder="Jane Doe"          value={name}     onChange={t => { setName(t);     setError(''); }} delay={150} />
          <Field label="Email"            placeholder="you@example.com"   value={email}    onChange={t => { setEmail(t);    setError(''); }} delay={250} keyboard="email-address" />
          <Field label="Password"         placeholder="Min. 8 characters" secure value={password} onChange={t => { setPassword(t); setError(''); }} delay={350} />
          <Field label="Confirm Password" placeholder="Re-enter password"  secure value={confirm}  onChange={t => { setConfirm(t);  setError(''); }} delay={450} />

          <View style={{ height: 32 }} />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={{ height: 8 }} />

          <AnimatedButton
            label="Create account"
            style={styles.btnPrimary}
            textStyle={styles.btnPrimaryText}
            onPress={handleCreateAccount}
            loading={loading}
          />

          <View style={{ height: 28 }} />

          {/* Navigation link */}
          <TouchableOpacity style={styles.switchRow} onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Text style={styles.switchLink}>Sign in</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111110',
  },
  backRow: {
    paddingTop: 4,
  },
  backBtn: {
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  backInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    lineHeight: 20,
  },
  backText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 20,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 40,
  },
  title: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
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
  inputFocused: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 50,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#111110',
    fontSize: 16,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  switchText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  switchLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
});
