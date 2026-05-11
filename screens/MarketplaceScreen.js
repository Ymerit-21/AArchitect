import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, StatusBar, Animated,
  ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import BottomNav from '../components/BottomNav';

const BG = '#f0ede6';

const DEFAULT_REGION = {
  latitude:       5.6372,
  longitude:     -0.1807,
  latitudeDelta:  0.04,
  longitudeDelta: 0.04,
};

const PROFESSIONS = [
  { id: 'all',         label: 'All',         icon: 'apps-outline',          color: '#e63946' },
  { id: 'plumber',     label: 'Plumber',     icon: 'water-outline',         color: '#6366f1' },
  { id: 'electrician', label: 'Electrician', icon: 'flash-outline',         color: '#f59e0b' },
  { id: 'carpenter',   label: 'Carpenter',   icon: 'hammer-outline',        color: '#d97706' },
  { id: 'painter',     label: 'Painter',     icon: 'color-palette-outline', color: '#ec4899' },
  { id: 'cleaner',     label: 'Cleaner',     icon: 'sparkles-outline',      color: '#10b981' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name = '') {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

function profColor(professionStr) {
  const match = PROFESSIONS.find(p =>
    p.id !== 'all' && (professionStr ?? '').toLowerCase().includes(p.id)
  );
  return match?.color ?? '#e63946';
}

function profIcon(professionStr) {
  const match = PROFESSIONS.find(p =>
    p.id !== 'all' && (professionStr ?? '').toLowerCase().includes(p.id)
  );
  return match?.icon ?? 'briefcase-outline';
}

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function useSlideIn(delay = 0) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 430, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 58, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

// ── Location picker ───────────────────────────────────────────────────────────
function LocationPicker({ visible, onClose, onCurrentLocation, onManual, loading }) {
  const sheetY  = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [typed, setTyped] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setTyped(''); setErr('');
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start(() => inputRef.current?.focus());
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY,  { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleManual = async () => {
    if (!typed.trim()) return;
    setBusy(true); setErr('');
    try {
      const results = await Location.geocodeAsync(typed.trim());
      if (!results.length) { setErr('Location not found.'); setBusy(false); return; }
      const { latitude, longitude } = results[0];
      onManual({ latitude, longitude }, typed.trim());
      onClose();
    } catch {
      setErr('Could not find that location.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[st.pickerOverlay, { opacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[st.pickerSheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Set your location</Text>
            <Text style={st.sheetSub}>Find experts near you</Text>
            <TouchableOpacity style={st.currentLocBtn} onPress={() => { onCurrentLocation(); onClose(); }} activeOpacity={0.8} disabled={loading}>
              <View style={st.currentLocIcon}>
                {loading ? <ActivityIndicator size="small" color="#e63946" /> : <Ionicons name="locate" size={20} color="#e63946" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.currentLocTitle}>Use current location</Text>
                <Text style={st.currentLocSub}>Automatically detect via GPS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
            <View style={st.orRow}>
              <View style={st.orLine} /><Text style={st.orTxt}>or type an address</Text><View style={st.orLine} />
            </View>
            <View style={[st.locInput, err && { borderColor: '#e63946' }]}>
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput ref={inputRef} style={st.locInputTxt} placeholder="e.g. Osu, Accra" placeholderTextColor="#c4c4c4"
                value={typed} onChangeText={t => { setTyped(t); setErr(''); }} returnKeyType="search" onSubmitEditing={handleManual} />
              {typed.length > 0 && <TouchableOpacity onPress={() => setTyped('')}><Ionicons name="close-circle" size={16} color="#9ca3af" /></TouchableOpacity>}
            </View>
            {err ? <Text style={st.errTxt}>{err}</Text> : null}
            <TouchableOpacity style={[st.searchLocBtn, (!typed.trim() || busy) && { opacity: 0.5 }]} onPress={handleManual} disabled={!typed.trim() || busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={st.searchLocBtnTxt}>Search this location</Text>}
            </TouchableOpacity>
            <View style={{ height: 12 }} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Expert card ───────────────────────────────────────────────────────────────
function ExpertCard({ expert, isNearest, onPress }) {
  const scale    = useRef(new Animated.Value(1)).current;
  const down     = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  const up       = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 120, friction: 6  }).start();
  const avatarBg = expert.bg ?? profColor(expert.profession);
  const distStr  = fmtDist(expert.distance);

  return (
    <Animated.View style={[
      st.expertCard,
      { transform: [{ scale }] },
      isNearest && st.expertCardNearest,
    ]}>
      <TouchableOpacity style={st.expertInner} onPressIn={down} onPressOut={up} onPress={onPress} activeOpacity={1}>
        {/* Avatar + badges row */}
        <View style={st.cardTopRow}>
          <View style={[st.expertAvatar, { backgroundColor: avatarBg }]}>
            <Text style={st.expertInitial}>{getInitials(expert.displayName)}</Text>
          </View>
          {distStr && (
            <View style={[st.distBadge, isNearest && st.distBadgeNearest]}>
              <Ionicons name="location" size={10} color={isNearest ? '#ffffff' : '#e63946'} />
              <Text style={[st.distBadgeTxt, isNearest && { color: '#ffffff' }]}>{distStr}</Text>
            </View>
          )}
        </View>

        {/* Name + verified */}
        <View style={st.expertNameRow}>
          <Text style={st.expertName} numberOfLines={1}>{expert.displayName ?? expert.profession}</Text>
          <Ionicons name="checkmark-circle" size={15} color="#e63946" />
        </View>
        <Text style={st.expertRole} numberOfLines={1}>{expert.profession}</Text>

        {/* Rating */}
        <View style={st.ratingRow}>
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text style={st.ratingTxt}>{(expert.rating ?? 0).toFixed(1)}</Text>
          <Text style={st.reviewCount}>({expert.reviews ?? 0})</Text>
        </View>

        {/* Price */}
        <Text style={st.expertRate}>From ¢{expert.from ?? 0}/hr</Text>

        {isNearest && (
          <View style={st.nearestBadge}>
            <Text style={st.nearestBadgeTxt}>Nearest</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Map marker with initials + rate ───────────────────────────────────────────
function ExpertMarker({ expert, isNearest }) {
  const size = isNearest ? 44 : 36;
  return (
    <View style={[st.markerWrap, isNearest && st.markerWrapNearest]}>
      <View style={[
        st.markerPin,
        { width: size, height: size, borderRadius: size / 2 },
        isNearest && st.markerPinNearest,
      ]}>
        <Text style={[st.markerInitial, isNearest && { fontSize: 11 }]}>
          {getInitials(expert.displayName)}
        </Text>
      </View>
      <View style={st.markerRate}>
        <Text style={st.markerRateTxt}>¢{expert.from ?? 0}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MarketplaceScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const { profile } = useUserData();
  const mapRef      = useRef(null);

  const [experts,    setExperts]    = useState([]);
  const [isExpert,   setIsExpert]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [activeProf, setProf]       = useState('all');
  const [userCoords, setUserCoords] = useState(null);
  const [locLabel,   setLocLabel]   = useState('East Legon, Accra');
  const [locLoading, setLocLoading] = useState(true);
  const [region,     setRegion]     = useState(DEFAULT_REGION);
  const [pickerOpen, setPickerOpen] = useState(false);

  const firstName = profile?.displayName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'there';
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const a0 = useSlideIn(0);
  const a1 = useSlideIn(80);
  const a2 = useSlideIn(155);
  const a3 = useSlideIn(230);
  const a4 = useSlideIn(305);
  const a5 = useSlideIn(380);

  // ── Location ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchCurrentLocation(); }, []);
  useEffect(() => {
    if (userCoords && mapRef.current) {
      mapRef.current.animateToRegion({ ...userCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
    }
  }, [userCoords]);

  // ── Firestore ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'experts'), snap => {
      setExperts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'experts'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => setIsExpert(!snap.empty), () => {});
    return unsub;
  }, [user]);

  // ── Filtered + sorted by distance ─────────────────────────────────────────
  const filteredWithDist = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = experts.filter(e => {
      if (e.uid === user?.uid || e.id === user?.uid) return false;
      const matchProf = activeProf === 'all' ||
        (e.profession ?? '').toLowerCase().includes(activeProf);
      const matchSearch = !q ||
        (e.displayName ?? '').toLowerCase().includes(q) ||
        (e.profession  ?? '').toLowerCase().includes(q) ||
        (e.skills ?? []).some(s => s.toLowerCase().includes(q));
      return matchProf && matchSearch;
    });

    return base
      .map(e => ({
        ...e,
        distance: (userCoords && e.location?.latitude && e.location?.longitude)
          ? haversine(userCoords.latitude, userCoords.longitude, e.location.latitude, e.location.longitude)
          : null,
      }))
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  }, [experts, user, activeProf, search, userCoords]);

  // Map markers — filtered by active profession, sorted by distance
  const mappableFiltered = useMemo(() => {
    return filteredWithDist.filter(e => e.location?.latitude && e.location?.longitude);
  }, [filteredWithDist]);

  const activeProfLabel = PROFESSIONS.find(p => p.id === activeProf)?.label ?? '';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleManualLocation = useCallback((coords, label) => {
    setUserCoords(coords);
    setLocLabel(label);
    const r = { ...coords, latitudeDelta: 0.03, longitudeDelta: 0.03 };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 800);
  }, []);

  const fetchCurrentLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setUserCoords({ latitude, longitude });
      const r = { latitude, longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 800);
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const label = [place.district ?? place.subregion, place.city ?? place.region].filter(Boolean).join(', ');
        if (label) setLocLabel(label);
      }
    } catch (e) {
      console.warn('Location error:', e);
    } finally {
      setLocLoading(false);
    }
  }, []);

  const recenterMap = useCallback(() => {
    if (userCoords && mapRef.current) {
      mapRef.current.animateToRegion({ ...userCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 600);
    }
  }, [userCoords]);

  // Inline: update both search text and active chip together (no useEffect lag)
  const handleSearch = (text) => {
    setSearch(text);
    const t = text.trim().toLowerCase();
    if (!t) { setProf('all'); return; }
    const match = PROFESSIONS.find(p =>
      p.id !== 'all' && p.label.toLowerCase().startsWith(t)
    );
    if (match) setProf(match.id);
  };

  const handleChipPress = (profId) => {
    setProf(profId);
    if (profId === 'all') setSearch('');
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <Animated.View style={[st.header, a0]}>
          <View style={st.headerAvatar}>
            <Text style={st.headerAvatarTxt}>{getInitials(profile?.displayName ?? user?.displayName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.greetLine}>{greeting}, {firstName} 👋</Text>
            <Text style={st.greetSub}>Who do you need today?</Text>
          </View>
          <TouchableOpacity style={st.bellBtn}>
            <Ionicons name="notifications" size={20} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Search ────────────────────────────────────────────────────── */}
        <Animated.View style={[st.ph, a1]}>
          <View style={st.searchBar}>
            <Ionicons name="search-outline" size={18} color="#e63946" />
            <TextInput
              style={st.searchInput}
              placeholder="Search for a skill..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={search}
              onChangeText={handleSearch}
              selectionColor="#e63946"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setProf('all'); }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Location bar ──────────────────────────────────────────────── */}
        <Animated.View style={[st.ph, { marginTop: 10 }, a2]}>
          <TouchableOpacity style={st.locBar} activeOpacity={0.8} onPress={() => setPickerOpen(true)}>
            {locLoading
              ? <ActivityIndicator size="small" color="#e63946" style={{ marginRight: 4 }} />
              : <View style={st.locDot} />}
            <Text style={st.locTxt} numberOfLines={1}>{locLabel}</Text>
            <Ionicons name="chevron-down" size={15} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Map ───────────────────────────────────────────────────────── */}
        <Animated.View style={[st.ph, { marginTop: 16 }, a3]}>
          <View style={st.mapWrapper}>
            <MapView
              ref={mapRef}
              style={st.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={region}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass={false}
              toolbarEnabled={false}
              customMapStyle={mapStyle}
            >
              {mappableFiltered.map((e, i) => (
                <Marker
                  key={e.id}
                  coordinate={{ latitude: e.location.latitude, longitude: e.location.longitude }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <ExpertMarker expert={e} isNearest={i === 0} />
                  <Callout tooltip>
                    <View style={st.callout}>
                      <Text style={st.calloutName}>{e.displayName}</Text>
                      <Text style={st.calloutProf}>{e.profession}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={st.calloutRate}>¢{e.from}/hr</Text>
                        {e.distance != null && <Text style={st.calloutDist}>{fmtDist(e.distance)}</Text>}
                      </View>
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>

            {/* Re-center */}
            <TouchableOpacity style={st.recenterBtn} onPress={recenterMap} activeOpacity={0.85}>
              <Ionicons name="locate-outline" size={20} color="#111110" />
            </TouchableOpacity>

            {/* Active filter pill on map */}
            {activeProf !== 'all' && (
              <View style={st.mapFilterPill}>
                <Ionicons name={PROFESSIONS.find(p => p.id === activeProf)?.icon ?? 'briefcase-outline'} size={12} color="#ffffff" />
                <Text style={st.mapFilterPillTxt}>{activeProfLabel}s only</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={st.viewAllBtn} onPress={() => handleChipPress('all')} activeOpacity={0.8}>
            <Text style={st.viewAllTxt}>View all</Text>
            <Ionicons name="arrow-forward" size={13} color="#e63946" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Profession chips ──────────────────────────────────────────── */}
        <Animated.View style={[{ marginTop: 20 }, a4]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.profScroll}>
            {PROFESSIONS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[st.profChip, activeProf === p.id && { backgroundColor: p.color, borderColor: p.color }]}
                onPress={() => handleChipPress(p.id)}
                activeOpacity={0.75}
              >
                <Ionicons name={p.icon} size={14} color={activeProf === p.id ? '#ffffff' : '#6b7280'} />
                <Text style={[st.profChipTxt, activeProf === p.id && { color: '#ffffff' }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Context banner ────────────────────────────────────────────── */}
        {(activeProf !== 'all' || search.trim()) && filteredWithDist.length > 0 && (
          <Animated.View style={[st.ph, { marginTop: 12 }, a4]}>
            <View style={st.contextBanner}>
              <Ionicons name="information-circle-outline" size={15} color="#6366f1" />
              <Text style={st.contextBannerTxt}>
                <Text style={{ fontWeight: '700' }}>
                  {filteredWithDist.length}{' '}
                  {activeProf !== 'all' ? `${activeProfLabel}${filteredWithDist.length !== 1 ? 's' : ''}` : 'result' + (filteredWithDist.length !== 1 ? 's' : '')}
                </Text>
                {' '}nearby · sorted by distance
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Section heading ───────────────────────────────────────────── */}
        <Animated.View style={[st.ph, { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, a5]}>
          <Text style={st.sectionTitle}>
            {activeProf === 'all' ? 'All Experts' : `${activeProfLabel}s`}
            {filteredWithDist.length > 0 && <Text style={st.sectionCount}> · {filteredWithDist.length}</Text>}
          </Text>
          {!isExpert && (
            <TouchableOpacity onPress={() => navigation.navigate('BecomeExpert')}>
              <Text style={st.joinLink}>+ Join</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Expert cards ──────────────────────────────────────────────── */}
        {filteredWithDist.length === 0 ? (
          <Animated.View style={[st.emptyWrap, a5]}>
            <View style={st.emptyIcon}>
              <Ionicons name="people-outline" size={36} color="#d1d5db" />
            </View>
            <Text style={st.emptyTitle}>
              {activeProf !== 'all'
                ? `No ${activeProfLabel}s near you yet`
                : isExpert ? 'No other experts yet' : 'No experts found'}
            </Text>
            <Text style={st.emptySub}>
              {activeProf !== 'all'
                ? `Be the first ${activeProfLabel} on Architect — tap "+ Join" to list yourself and start getting hired.`
                : isExpert
                  ? "You're listed! Clients can find and hire you."
                  : 'Be the first to offer your skills on Architect.'}
            </Text>
            {!isExpert && !search && (
              <TouchableOpacity style={st.joinBtn} onPress={() => navigation.navigate('BecomeExpert')} activeOpacity={0.85}>
                <Text style={st.joinBtnTxt}>Become an Expert</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[st.cardsGrid, a5]}>
            {filteredWithDist.map((e, i) => (
              <ExpertCard
                key={e.id}
                expert={e}
                isNearest={i === 0 && e.distance != null}
                onPress={() => navigation.navigate('ExpertProfile', { expert: e })}
              />
            ))}
          </Animated.View>
        )}

      </ScrollView>

      <BottomNav activeTab="saved" navigation={navigation} bottomInset={insets.bottom || 10} />

      <LocationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onCurrentLocation={fetchCurrentLocation}
        onManual={handleManualLocation}
        loading={locLoading}
      />
    </View>
  );
}

// ── Map style ─────────────────────────────────────────────────────────────────
const mapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#eae6df' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f0ede6' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road',               elementType: 'geometry',        stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',               elementType: 'geometry.stroke', stylers: [{ color: '#e8e5de' }] },
  { featureType: 'road.highway',       elementType: 'geometry',        stylers: [{ color: '#f0ede6' }] },
  { featureType: 'water',              elementType: 'geometry',        stylers: [{ color: '#c9dbe0' }] },
  { featureType: 'poi.park',           elementType: 'geometry',        stylers: [{ color: '#d4e8d1' }] },
  { featureType: 'poi',                elementType: 'labels',          stylers: [{ visibility: 'off'  }] },
  { featureType: 'transit',            elementType: 'labels',          stylers: [{ visibility: 'off'  }] },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  ph:   { paddingHorizontal: 20 },

  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16, gap: 12 },
  headerAvatar:    { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  greetLine:       { color: '#111110', fontSize: 16, fontWeight: '700' },
  greetSub:        { color: '#9ca3af', fontSize: 13, marginTop: 1 },
  bellBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111110', alignItems: 'center', justifyContent: 'center' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1917', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14, padding: 0 },

  locBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1917', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  locDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' },
  locTxt: { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: '500' },

  mapWrapper:  { height: 200, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  map:         { flex: 1 },
  recenterBtn: { position: 'absolute', bottom: 12, right: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },

  mapFilterPill:    { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#6366f1', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  mapFilterPillTxt: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  // Marker
  markerWrap:       { alignItems: 'center' },
  markerWrapNearest:{ },
  markerPin:        { backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#ffffff', shadowColor: '#e63946', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  markerPinNearest: { backgroundColor: '#111110', borderColor: '#e63946', borderWidth: 3 },
  markerInitial:    { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  markerRate:       { backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  markerRateTxt:    { color: '#111110', fontSize: 9, fontWeight: '800' },

  callout:      { backgroundColor: '#ffffff', borderRadius: 12, padding: 10, minWidth: 130, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  calloutName:  { color: '#111110', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  calloutProf:  { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  calloutRate:  { color: '#e63946', fontSize: 13, fontWeight: '700' },
  calloutDist:  { color: '#6b7280', fontSize: 11 },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 8 },
  viewAllTxt: { color: '#e63946', fontSize: 13, fontWeight: '700' },

  profScroll:  { paddingHorizontal: 20, gap: 8 },
  profChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: '#e8e5de', borderWidth: 1, borderColor: 'transparent' },
  profChipTxt: { color: '#6b7280', fontSize: 13, fontWeight: '600' },

  // Context banner
  contextBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  contextBannerTxt: { color: '#4b5563', fontSize: 13, flex: 1 },

  sectionTitle: { color: '#111110', fontSize: 18, fontWeight: '800' },
  sectionCount: { color: '#9ca3af', fontWeight: '500' },
  joinLink:     { color: '#e63946', fontSize: 14, fontWeight: '600' },

  cardsGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginTop: 14 },

  expertCard:         { width: '47%', backgroundColor: '#ffffff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  expertCardNearest:  { borderLeftWidth: 3, borderLeftColor: '#e63946' },
  expertInner:        { padding: 14 },
  cardTopRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  expertAvatar:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  expertInitial:      { color: '#ffffff', fontSize: 20, fontWeight: '800' },

  distBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef2f2', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 4 },
  distBadgeNearest: { backgroundColor: '#e63946' },
  distBadgeTxt:     { color: '#e63946', fontSize: 10, fontWeight: '700' },

  expertNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  expertName:    { color: '#111110', fontSize: 13, fontWeight: '700', flex: 1 },
  expertRole:    { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  ratingTxt:     { color: '#f59e0b', fontSize: 12, fontWeight: '700' },
  reviewCount:   { color: '#9ca3af', fontSize: 11 },
  expertRate:    { color: '#e63946', fontSize: 12, fontWeight: '700' },

  nearestBadge:    { marginTop: 8, backgroundColor: '#fff1f2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  nearestBadgeTxt: { color: '#e63946', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  emptyWrap:  { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 10 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: '#111110', fontSize: 17, fontWeight: '700' },
  emptySub:   { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  joinBtn:    { backgroundColor: '#e63946', borderRadius: 50, paddingHorizontal: 28, paddingVertical: 13, marginTop: 4 },
  joinBtnTxt: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  pickerOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet:     { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14 },
  sheetHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 20 },
  sheetTitle:      { color: '#111110', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSub:        { color: '#9ca3af', fontSize: 14, marginBottom: 20 },
  currentLocBtn:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fef2f2', borderRadius: 16, padding: 16, marginBottom: 20 },
  currentLocIcon:  { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#e63946', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  currentLocTitle: { color: '#111110', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  currentLocSub:   { color: '#9ca3af', fontSize: 12 },
  orRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  orLine:          { flex: 1, height: 1, backgroundColor: '#f3f4f6' },
  orTxt:           { color: '#9ca3af', fontSize: 13 },
  locInput:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f3ef', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: 'transparent', marginBottom: 8 },
  locInputTxt:     { flex: 1, color: '#111110', fontSize: 14, padding: 0 },
  errTxt:          { color: '#e63946', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  searchLocBtn:    { backgroundColor: '#111110', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  searchLocBtnTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
