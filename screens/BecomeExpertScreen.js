import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
// ── Cloudinary config ─────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD  = 'dfklr2rwy';
const CLOUDINARY_PRESET = 'architect_upload';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const DARK = '#111110';

// ── Ghana Card auto-formatter ──────────────────────────────────────────────────
function formatGhanaCard(raw) {
  // Keep only alphanumeric, uppercase
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // GHA (3) + 9 digits + 1 check digit = 13 chars raw → "GHA-000000000-0" = 15 displayed
  const letters = clean.slice(0, 3);
  const digits1 = clean.slice(3, 12);
  const digit2  = clean.slice(12, 13);
  let result = letters;
  if (clean.length > 3)  result += '-' + digits1;
  if (clean.length > 12) result += '-' + digit2;
  return result;
}

function isValidGhanaCard(v) {
  return /^GHA-\d{9}-\d$/.test(v);
}

// ── Upload a local URI to Cloudinary, return secure URL ──────────────────────
// FormData with { uri, type, name } is handled natively by React Native —
// no Blob or ArrayBuffer ever enters JS, so Hermes has no issue with it.
async function uploadToStorage(uri, folder) {
  const ext  = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';

  const form = new FormData();
  form.append('file',           { uri, type, name: `upload.${ext}` });
  form.append('upload_preset',  CLOUDINARY_PRESET);
  form.append('folder',         `architect/${folder}`);

  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: form },
  );
  const json = await res.json();
  if (!json.secure_url) throw new Error(json.error?.message ?? 'Cloudinary upload failed');
  return json.secure_url;
}

// ── Avatar color ──────────────────────────────────────────────────────────────
const COLORS = ['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'];
function pickColor(uid = '') { return COLORS[uid.charCodeAt(0) % COLORS.length]; }

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <View style={st.section}>
      <View style={st.sectionHdr}>
        <Ionicons name={icon} size={15} color="rgba(255,255,255,0.5)" />
        <Text style={st.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Labeled text input ────────────────────────────────────────────────────────
function Field({ label, required, hint, placeholder, value, onChange, keyboard, multiline, maxLength }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={st.fieldWrap}>
      <View style={st.labelRow}>
        <Text style={st.label}>{label}</Text>
        </View>
      {hint && <Text style={st.hint}>{hint}</Text>}
      <TextInput
        style={[st.input, focused && st.inputFocused, multiline && st.inputMulti]}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={keyboard ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxLength={maxLength}
        autoCapitalize={keyboard === 'numeric' ? 'none' : 'words'}
      />
    </View>
  );
}

// ── Image upload tile ─────────────────────────────────────────────────────────
function PhotoTile({ label, hint, uri, onPick, aspect }) {
  return (
    <View style={st.photoTileWrap}>
      <Text style={st.label}>{label}</Text>
      {hint && <Text style={st.hint}>{hint}</Text>}
      <TouchableOpacity style={st.photoTile} onPress={onPick} activeOpacity={0.8}>
        {uri ? (
          <Image source={{ uri }} style={st.photoPreview} resizeMode="cover" />
        ) : (
          <View style={st.photoEmpty}>
            <View style={st.photoIconWrap}>
              <Ionicons name="cloud-upload-outline" size={26} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={st.photoEmptyTxt}>Tap to upload</Text>
            <Text style={st.photoEmptySub}>JPG or PNG</Text>
          </View>
        )}
        {uri && (
          <View style={st.photoEditBadge}>
            <Ionicons name="pencil" size={12} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Skills tag input ──────────────────────────────────────────────────────────
function SkillsInput({ skills, onAdd, onRemove }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    if (t && !skills.map(s => s.toLowerCase()).includes(t.toLowerCase())) onAdd(t);
    setInput('');
  };
  return (
    <View style={st.fieldWrap}>
      <Text style={st.label}>Skills</Text>
      <Text style={st.hint}>Add skills that describe your expertise</Text>
      <View style={st.skillInputRow}>
        <TextInput
          style={[st.input, { flex: 1, marginBottom: 0 }]}
          placeholder="e.g. Pipe fitting, Drainage..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <TouchableOpacity style={st.skillAddBtn} onPress={add} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
      {skills.length > 0 && (
        <View style={st.skillsWrap}>
          {skills.map(s => (
            <View key={s} style={st.skillChip}>
              <Text style={st.skillChipTxt}>{s}</Text>
              <TouchableOpacity onPress={() => onRemove(s)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={13} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function BecomeExpertScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  // Basic info
  const [profession, setProfession] = useState('');
  const [price,      setPrice]      = useState(null);   // number | null
  const [bio,        setBio]        = useState('');

  // Location
  const [locationLabel,  setLocationLabel]  = useState('');
  const [locationCoords, setLocationCoords] = useState(null); // { latitude, longitude }
  const [locating,       setLocating]       = useState(false);
  const [geocoding,      setGeocoding]      = useState(false);
  const [locTyped,       setLocTyped]       = useState('');

  // Skills
  const [skills, setSkills] = useState([]);

  // Identity
  const [ghanaCard,      setGhanaCard]      = useState('GHA-');
  const [ghanaCardFront, setGhanaCardFront] = useState(null);
  const [ghanaCardBack,  setGhanaCardBack]  = useState(null);

  // Passport photo
  const [passportPhoto, setPassportPhoto] = useState(null);

  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const hdrOpacity = useRef(new Animated.Value(0)).current;
  const hdrY       = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(hdrY,       { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Ghana card input handler ─────────────────────────────────────────────
  const handleGhanaCard = (raw) => {
    // Always keep GHA- prefix
    if (!raw.startsWith('GHA')) { setGhanaCard('GHA-'); return; }
    const formatted = formatGhanaCard(raw);
    setGhanaCard(formatted);
    setError('');
  };

  // ── Image picker helper ─────────────────────────────────────────────────
  const pickImage = async (setter, aspectRatio, maxMB = 5) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: aspectRatio,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > maxMB * 1024 * 1024) {
      Alert.alert('File too large', `Please select a photo under ${maxMB}MB.`);
      return;
    }
    setter(asset.uri);
    setError('');
  };

  // ── Location helpers ─────────────────────────────────────────────────────
  const useGpsLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed to detect your position.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = place
        ? [[place.district ?? place.subregion, place.city ?? place.region].filter(Boolean).join(', ')]
            .filter(Boolean)[0] ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setLocationCoords({ latitude, longitude });
      setLocationLabel(label);
      setLocTyped(label);
      setError('');
    } catch {
      Alert.alert('Error', 'Could not fetch your location.');
    } finally {
      setLocating(false);
    }
  };

  const searchTypedLocation = async () => {
    if (!locTyped.trim()) return;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(locTyped.trim());
      if (!results.length) { setError('Location not found. Try a more specific address.'); return; }
      const { latitude, longitude } = results[0];
      setLocationCoords({ latitude, longitude });
      setLocationLabel(locTyped.trim());
      setError('');
    } catch {
      setError('Could not find that location. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (!profession.trim())        return setError('Profession is required.');
    if (!price)                    return setError('Please select a starting price.');
    if (!locationCoords)           return setError('Please set your location (use GPS or search an address).');
    if (!isValidGhanaCard(ghanaCard))
                                   return setError('Enter a valid Ghana Card number (GHA-000000000-0).');
    if (!ghanaCardFront)           return setError('Ghana Card front photo is required.');
    if (!ghanaCardBack)            return setError('Ghana Card back photo is required.');
    if (!passportPhoto)            return setError('Passport-style photo is required.');

    setLoading(true);
    try {
      setUploadProgress('Uploading Ghana Card front…');
      const frontUrl = await uploadToStorage(ghanaCardFront, `${user.uid}/ghana_front`);

      setUploadProgress('Uploading Ghana Card back…');
      const backUrl  = await uploadToStorage(ghanaCardBack,  `${user.uid}/ghana_back`);

      setUploadProgress('Uploading profile photo…');
      const photoUrl = await uploadToStorage(passportPhoto,  `${user.uid}/passport`);

      setUploadProgress('Saving profile…');

      const displayName = user.displayName || user.email.split('@')[0];
      const initials    = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

      await setDoc(doc(db, 'experts', user.uid), {
        uid:               user.uid,
        displayName,
        initials,
        profession:        profession.trim(),
        from:              price,
        bio:               bio.trim(),
        location:          { label: locationLabel, ...locationCoords },
        skills,
        ghanaCard,
        ghanaCardFrontUrl: frontUrl,
        ghanaCardBackUrl:  backUrl,
        passportPhotoUrl:  photoUrl,
        bg:                pickColor(user.uid),
        rating:            0,
        reviews:           0,
        isActive:          true,
        verified:          false,
        createdAt:         serverTimestamp(),
      });

      navigation.goBack();
    } catch (e) {
      console.error(e);
      setError('Upload failed. Check your connection and try again.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <View style={st.root}>
      {/* Back button */}
      <View style={[st.backRow, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.6)" />
          <Text style={st.backTxt}>Back</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.View style={{ opacity: hdrOpacity, transform: [{ translateY: hdrY }] }}>
            <Text style={st.title}>Become an Expert</Text>
            <Text style={st.subtitle}>
              Set up your profile and start appearing in the Marketplace.
            </Text>
          </Animated.View>

          <View style={{ height: 28 }} />

          {/* ── Basic Info ──────────────────────────────────────────────── */}
          <Section icon="briefcase-outline" title="Basic Info">
            <Field
              label="Profession" required
              placeholder="e.g. Plumber, Electrician, Designer"
              value={profession}
              onChange={t => { setProfession(t); setError(''); }}
            />
            {/* Starting price pills */}
            <View style={st.fieldWrap}>
              <Text style={st.label}>Starting Price</Text>
              <Text style={st.hint}>¢50 – ¢100 per visit · select one</Text>
              <View style={st.priceGrid}>
                {[50, 60, 70, 80, 90, 100].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[st.pricePill, price === p && st.pricePillActive]}
                    onPress={() => { setPrice(p); setError(''); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.pricePillTxt, price === p && st.pricePillTxtActive]}>
                      ¢{p}
                    </Text>
                    <Text style={[st.pricePillSub, price === p && st.pricePillSubActive]}>
                      /visit
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Field
              label="Short Bio"
              placeholder="Tell clients a bit about yourself…"
              value={bio}
              onChange={t => { setBio(t); setError(''); }}
              multiline
            />
          </Section>

          {/* ── Location ────────────────────────────────────────────────── */}
          <Section icon="location-outline" title="Location">
            <View style={st.fieldWrap}>
              <Text style={st.label}>Your service area</Text>
              <Text style={st.hint}>This pins you on the Marketplace map so clients can find you nearby</Text>

              {/* GPS button */}
              <TouchableOpacity
                style={[st.gpsBtn, locating && { opacity: 0.7 }]}
                onPress={useGpsLocation}
                disabled={locating}
                activeOpacity={0.85}
              >
                <View style={st.gpsIconWrap}>
                  {locating
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <Ionicons name="navigate" size={18} color="#ffffff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.gpsBtnTxt}>Use my current location</Text>
                  <Text style={st.gpsBtnSub}>Auto-detect via GPS</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>

              {/* OR divider */}
              <View style={st.orRow}>
                <View style={st.orLine} />
                <Text style={st.orTxt}>or type an address</Text>
                <View style={st.orLine} />
              </View>

              {/* Manual address input + Search */}
              <View style={st.locSearchRow}>
                <TextInput
                  style={[st.input, st.locInput, locationCoords && st.inputValid]}
                  placeholder="e.g. Osu, Accra"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={locTyped}
                  onChangeText={t => { setLocTyped(t); setError(''); }}
                  returnKeyType="search"
                  onSubmitEditing={searchTypedLocation}
                />
                <TouchableOpacity
                  style={[st.locSearchBtn, (!locTyped.trim() || geocoding) && { opacity: 0.45 }]}
                  onPress={searchTypedLocation}
                  disabled={!locTyped.trim() || geocoding}
                  activeOpacity={0.85}
                >
                  {geocoding
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <Ionicons name="search" size={18} color="#ffffff" />}
                </TouchableOpacity>
              </View>

              {/* Confirmed location pill */}
              {locationCoords && (
                <View style={st.locConfirmed}>
                  <Ionicons name="checkmark-circle" size={15} color="#22c55e" />
                  <Text style={st.locConfirmedTxt} numberOfLines={1}>{locationLabel}</Text>
                  <TouchableOpacity onPress={() => { setLocationCoords(null); setLocationLabel(''); setLocTyped(''); }}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Section>

          {/* ── Skills ──────────────────────────────────────────────────── */}
          <Section icon="flash-outline" title="Skills">
            <SkillsInput
              skills={skills}
              onAdd={s => setSkills(prev => [...prev, s])}
              onRemove={s => setSkills(prev => prev.filter(x => x !== s))}
            />
          </Section>

          {/* ── Identity Verification ───────────────────────────────────── */}
          <Section icon="shield-checkmark-outline" title="Identity Verification">
            <View style={st.fieldWrap}>
              <View style={st.labelRow}>
                <Text style={st.label}>Ghana Card Number</Text>
              </View>
              <Text style={st.hint}>Format: GHA-000000000-0</Text>
              <TextInput
                style={[
                  st.input, st.monoInput,
                  isValidGhanaCard(ghanaCard) && st.inputValid,
                ]}
                value={ghanaCard}
                onChangeText={handleGhanaCard}
                placeholder="GHA-000000000-0"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="characters"
                maxLength={15}
                keyboardType="default"
              />
              {isValidGhanaCard(ghanaCard) && (
                <View style={st.validRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                  <Text style={st.validTxt}>Valid format</Text>
                </View>
              )}
            </View>

            {/* Front + Back side by side */}
            <View style={st.cardPhotoRow}>
              <View style={{ flex: 1 }}>
                <PhotoTile
                  label="Ghana Card — Front"
                  aspect={[16, 10]}
                  uri={ghanaCardFront}
                  onPick={() => pickImage(setGhanaCardFront, [16, 10])}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PhotoTile
                  label="Ghana Card — Back"
                  aspect={[16, 10]}
                  uri={ghanaCardBack}
                  onPick={() => pickImage(setGhanaCardBack, [16, 10])}
                />
              </View>
            </View>
          </Section>

          {/* ── Profile Photo ────────────────────────────────────────────── */}
          <Section icon="camera-outline" title="Profile Photo">
            <PhotoTile
              label="Passport-style photograph"
              hint={"Clear headshot · neutral expression · plain background · no filters\nAccepted: JPG or PNG · Max size: 1 MB"}
              aspect={[1, 1]}
              uri={passportPhoto}
              onPick={() => pickImage(setPassportPhoto, [1, 1], 1)}
            />
          </Section>

          {/* Error */}
          {!!error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#ff6b6b" />
              <Text style={st.errorTxt}>{error}</Text>
            </View>
          )}

          <View style={{ height: 24 }} />

          {/* Submit */}
          <TouchableOpacity
            style={[st.btn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color={DARK} />
                <Text style={st.btnTxt}>{uploadProgress || 'Saving…'}</Text>
              </View>
            ) : (
              <Text style={st.btnTxt}>Create Expert Profile</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: DARK },
  backRow: { paddingHorizontal: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, alignSelf: 'flex-start' },
  backTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 15 },
  scroll:  { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },

  title:    { color: '#ffffff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 22 },

  // Section
  section:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sectionHdr:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  sectionTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },

  // Field
  fieldWrap: { marginBottom: 14 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  label:     { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  req:       { color: '#e63946', fontSize: 11, fontWeight: '600' },
  hint:      { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 8, lineHeight: 17 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputFocused: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' },
  inputValid:   { borderColor: '#22c55e' },
  inputMulti:   { height: 90, textAlignVertical: 'top' },
  monoInput:    { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', letterSpacing: 1 },
  validRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  validTxt:     { color: '#22c55e', fontSize: 12, fontWeight: '500' },

  // Skills
  skillInputRow: { flexDirection: 'row', gap: 8 },
  skillAddBtn:   { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },
  skillsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  skillChip:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  skillChipTxt:  { color: '#ffffff', fontSize: 13, fontWeight: '500' },

  // Ghana card photos row
  cardPhotoRow: { flexDirection: 'row', gap: 10 },

  // Photo tile
  photoTileWrap: { marginBottom: 14 },
  photoTile:     { height: 110, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', overflow: 'hidden' },
  photoEmpty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  photoEmptyTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  photoEmptySub: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  photoPreview:  { width: '100%', height: '100%' },
  photoEditBadge:{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  // Price pills
  priceGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  pricePill:          { flexDirection: 'row', alignItems: 'baseline', gap: 2, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pricePillActive:    { backgroundColor: '#e63946', borderColor: '#e63946' },
  pricePillTxt:       { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  pricePillTxtActive: { color: '#ffffff' },
  pricePillSub:       { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  pricePillSubActive: { color: 'rgba(255,255,255,0.8)' },

  // Error
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)', marginBottom: 8 },
  errorTxt: { flex: 1, color: '#ff6b6b', fontSize: 13, lineHeight: 18 },

  // Submit
  btn:    { backgroundColor: '#ffffff', borderRadius: 50, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: DARK, fontSize: 16, fontWeight: '700' },

  // Location picker
  gpsBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#e63946', borderRadius: 14, padding: 14, marginBottom: 4 },
  gpsIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  gpsBtnTxt:   { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  gpsBtnSub:   { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  orRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine:      { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  orTxt:       { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600' },
  locSearchRow:   { flexDirection: 'row', gap: 8 },
  locInput:       { flex: 1, marginBottom: 0 },
  locSearchBtn:   { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1c1917', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  locConfirmed:   { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  locConfirmedTxt:{ flex: 1, color: '#22c55e', fontSize: 13, fontWeight: '600' },
});
