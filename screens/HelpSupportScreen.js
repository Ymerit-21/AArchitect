import { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Animated, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const BG   = '#f0ede6';
const DARK = '#111110';
const RED  = '#e63946';

const SUPPORT_EMAIL  = 'EnochAnn12@gmail.com';
const SUPPORT_PHONE1 = '+233505864510';
const SUPPORT_PHONE2 = '+233257978622';

const FAQS = [
  {
    q: 'How do I add funds to my wallet?',
    a: 'Tap the "Add Funds" button on your home screen. Choose between Mobile Money (MTN, Vodafone, AirtelTigo) or a Debit/Credit card, enter your amount and confirm with your PIN.',
  },
  {
    q: 'How do I become a verified expert?',
    a: 'Go to your Profile and tap "Become an Expert". Fill in your details, upload your Ghana Card and passport photo. Our team reviews your application within 1–3 business days.',
  },
  {
    q: 'What is a milestone?',
    a: 'A milestone is a locked savings goal. You set a target amount and an optional time lock — funds saved inside cannot be withdrawn until the lock expires, helping you stay committed.',
  },
  {
    q: 'How do budgets work?',
    a: 'Budgets let you set a spending limit per category (Food, Transport, etc.) for a given period (Weekly, Monthly, Yearly). Your logged expenses are tracked against the limit automatically.',
  },
  {
    q: 'How do I hire an expert?',
    a: 'Browse experts on the Marketplace or Home screen. Tap an expert card to view their profile, then press "Hire Now" to begin the hiring process.',
  },
  {
    q: 'Is my personal data secure?',
    a: 'Yes. All data is encrypted and stored securely on Firebase. Your Ghana Card details are only visible to our admin team for verification purposes and are never shared.',
  },
  {
    q: 'How do I reset my PIN?',
    a: 'PIN reset is not yet self-serve. Please contact us via email or phone and we will help you reset it after verifying your identity.',
  },
];

function useEntrance(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Contact card ──────────────────────────────────────────────────────────────
function ContactCard({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity style={[ct.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[ct.iconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ct.label}>{label}</Text>
        <Text style={[ct.value, { color }]}>{value}</Text>
      </View>
      <View style={ct.actionChip}>
        <Ionicons name="arrow-forward" size={14} color={color} />
      </View>
    </TouchableOpacity>
  );
}

const ct = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  label:    { color: '#9ca3af', fontSize: 11, fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
  value:    { fontSize: 14, fontWeight: '700' },
  actionChip:{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
});

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a, index }) {
  const [open, setOpen]  = useState(false);
  const rotateAnim       = useRef(new Animated.Value(0)).current;
  const heightAnim       = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toOpen = !open;
    setOpen(toOpen);
    Animated.parallel([
      Animated.timing(rotateAnim, { toValue: toOpen ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(heightAnim, { toValue: toOpen ? 1 : 0, duration: 220, useNativeDriver: false }),
    ]).start();
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={fq.item}>
      <TouchableOpacity style={fq.question} onPress={toggle} activeOpacity={0.75}>
        <View style={fq.numWrap}>
          <Text style={fq.num}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <Text style={fq.qTxt}>{q}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color="#9ca3af" />
        </Animated.View>
      </TouchableOpacity>

      {open && (
        <View style={fq.answer}>
          <View style={fq.answerLine} />
          <Text style={fq.aTxt}>{a}</Text>
        </View>
      )}
    </View>
  );
}

const fq = StyleSheet.create({
  item:      { backgroundColor: '#ffffff', borderRadius: 16, marginBottom: 8, overflow: 'hidden' },
  question:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  numWrap:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  num:       { color: RED, fontSize: 11, fontWeight: '800' },
  qTxt:      { flex: 1, color: DARK, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  answer:    { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  answerLine:{ width: 3, borderRadius: 2, backgroundColor: '#fecaca' },
  aTxt:      { flex: 1, color: '#6b7280', fontSize: 13, lineHeight: 21 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HelpSupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const a0     = useEntrance(0);
  const a1     = useEntrance(80);
  const a2     = useEntrance(160);
  const a3     = useEntrance(240);

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Architect App Support`)
      .catch(() => Alert.alert('Error', 'Could not open email client.'));
  };

  const openPhone = (number) => {
    Linking.openURL(`tel:${number}`)
      .catch(() => Alert.alert('Error', 'Could not open phone dialer.'));
  };

  const openWhatsApp = (number) => {
    Linking.openURL(`https://wa.me/${number.replace('+', '')}`)
      .catch(() => Alert.alert('Error', 'WhatsApp is not installed.'));
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Header ── */}
        <Animated.View style={[st.headerRow, a0]}>
          <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={DARK} />
          </TouchableOpacity>
          <View>
            <Text style={st.headerTitle}>Help & Support</Text>
            <Text style={st.headerSub}>We're here to help</Text>
          </View>
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* ── Hero banner ── */}
        <Animated.View style={[st.ph, a0]}>
          <View style={st.banner}>
            <View style={st.bannerBlob} />
            <View style={st.bannerInner}>
              <View style={st.bannerIconWrap}>
                <Ionicons name="headset-outline" size={32} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.bannerTitle}>Got a question?</Text>
                <Text style={st.bannerSub}>Our support team is available Mon – Fri, 8am – 6pm</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Contact us ── */}
        <Animated.View style={[st.ph, { marginTop: 22 }, a1]}>
          <Text style={st.sectionLabel}>Contact Us</Text>

          <ContactCard
            icon="mail-outline"
            label="Email Support"
            value={SUPPORT_EMAIL}
            color={RED}
            onPress={openEmail}
          />

          <ContactCard
            icon="call-outline"
            label="Phone · Line 1"
            value="+233 50 586 4510"
            color="#3b82f6"
            onPress={() => openPhone(SUPPORT_PHONE1)}
          />

          <ContactCard
            icon="call-outline"
            label="Phone · Line 2"
            value="+233 25 797 8622"
            color="#10b981"
            onPress={() => openPhone(SUPPORT_PHONE2)}
          />
        </Animated.View>

        {/* ── WhatsApp shortcuts ── */}
        <Animated.View style={[st.ph, { marginTop: 4 }, a1]}>
          <Text style={st.sectionLabel}>WhatsApp</Text>
          <View style={st.waRow}>
            <TouchableOpacity
              style={st.waBtn}
              onPress={() => openWhatsApp(SUPPORT_PHONE1)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25d366" />
              <Text style={st.waTxt}>+233 50 586 4510</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.waBtn}
              onPress={() => openWhatsApp(SUPPORT_PHONE2)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25d366" />
              <Text style={st.waTxt}>+233 25 797 8622</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── FAQs ── */}
        <Animated.View style={[st.ph, { marginTop: 22 }, a2]}>
          <Text style={st.sectionLabel}>Frequently Asked Questions</Text>
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} index={i} />
          ))}
        </Animated.View>

        {/* ── Footer note ── */}
        <Animated.View style={[st.ph, { marginTop: 22 }, a3]}>
          <View style={st.footerCard}>
            <Ionicons name="information-circle-outline" size={20} color="#9ca3af" />
            <Text style={st.footerTxt}>
              Response time is typically within 24 hours on business days. For urgent matters please call directly.
            </Text>
          </View>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: DARK, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  headerSub:   { color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 2 },

  banner:       { backgroundColor: '#1c1917', borderRadius: 24, padding: 20, overflow: 'hidden' },
  bannerBlob:   { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#7f1d1d', top: -50, right: -30, opacity: 0.6 },
  bannerInner:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bannerIconWrap:{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(230,57,70,0.25)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle:  { color: '#ffffff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  bannerSub:    { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18 },

  sectionLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' },

  waRow: { flexDirection: 'row', gap: 10 },
  waBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: '#d1fae5' },
  waTxt: { color: '#059669', fontSize: 13, fontWeight: '700' },

  footerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#ffffff', borderRadius: 16, padding: 16 },
  footerTxt:  { flex: 1, color: '#9ca3af', fontSize: 13, lineHeight: 20 },
});
