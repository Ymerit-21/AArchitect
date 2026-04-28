import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, StatusBar,
  Alert, Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

const BG = '#f0ede6';

const EMOJIS = [
  '😀','😂','🥰','😍','🤔','😢','😮','🤣','😊','😎',
  '🥳','😤','❤️','💔','🔥','💯','🎉','👍','👎','🙏',
  '👋','💪','🤝','👀','✅','❌','🚀','💡','⭐','🎵',
  '😁','😆','🤩','😏','🥺','😅','😇','🤗','🤭','😬',
];

const WAVE_HEIGHTS = [8, 14, 6, 18, 10, 16, 8, 20, 12, 8, 16, 10];

function initials(name = '') {
  return (name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDateLabel(ts) {
  if (!ts) return '';
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  const month = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (diff === 0) return `Today  ${month}`;
  if (diff === 1) return `Yesterday  ${month}`;
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function buildItems(messages) {
  const items = [];
  let lastDate = null;
  for (const msg of messages) {
    const d   = msg.createdAt?.toDate?.() ?? new Date();
    const key = d.toDateString();
    if (key !== lastDate) {
      items.push({ _sep: true, id: `sep-${key}`, ts: msg.createdAt });
      lastDate = key;
    }
    items.push(msg);
  }
  return items;
}

function isClustered(a, b) {
  if (!a || !b || a.senderId !== b.senderId) return false;
  const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
  const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
  return Math.abs(ta - tb) < 5 * 60 * 1000;
}

function HeaderAvatar({ name, bg, online }) {
  return (
    <View style={{ width: 40, height: 40 }}>
      <View style={[cs.hAvatar, { backgroundColor: bg }]}>
        <Text style={cs.hAvatarTxt}>{initials(name)}</Text>
      </View>
      {online && <View style={cs.hOnlineDot} />}
    </View>
  );
}

const AVATAR_COLORS = ['#e63946','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];
function avatarColor(uid = '') {
  return AVATAR_COLORS[(uid?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function ConversationScreen({ navigation, route }) {
  const params         = route.params ?? {};
  const conversationId = params.conversationId;
  const otherName      = params.name ?? params.otherName ?? 'User';
  const otherUid       = params.otherUid;
  const avatarBg       = params.avatarBg ?? avatarColor(otherUid ?? '');

  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [myAvailable, setMyAvailable] = useState(false);
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);

  const listRef      = useRef(null);
  const recordingRef = useRef(null);
  const recTimerRef  = useRef(null);
  const soundRef     = useRef(null);

  // Set self online on enter, offline on leave
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        setMyAvailable(snap.data().available ?? false);
        updateDoc(userRef, { online: true }).catch(() => {});
      }
    });
    return () => { updateDoc(userRef, { online: false }).catch(() => {}); };
  }, [user]);

  // Listen to other user's online status
  useEffect(() => {
    if (!otherUid) return;
    const unsub = onSnapshot(doc(db, 'users', otherUid), snap => {
      if (snap.exists()) setOtherOnline(snap.data().online === true);
    }, () => {});
    return unsub;
  }, [otherUid]);

  // Load messages
  useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    });
    return unsub;
  }, [conversationId]);

  // Mark as read
  useEffect(() => {
    if (!conversationId || !user) return;
    updateDoc(doc(db, 'conversations', conversationId), {
      [`unread.${user.uid}`]: 0,
    }).catch(() => {});
  }, [conversationId, user]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  // Toggle availability
  const toggleAvailable = async () => {
    if (!user) return;
    const next = !myAvailable;
    setMyAvailable(next);
    try { await updateDoc(doc(db, 'users', user.uid), { available: next }); } catch {}
  };

  // ── Upload helper ────────────────────────────────────────────────────────────
  const uploadFile = async (uri, path) => {
    const res     = await fetch(uri);
    const blob    = await res.blob();
    const fileRef = sRef(storage, path);
    await uploadBytes(fileRef, blob);
    return getDownloadURL(fileRef);
  };

  // ── Generic message sender ───────────────────────────────────────────────────
  const sendMsg = async (payload) => {
    if (!conversationId || !user) return;
    const preview =
      payload.text        ? payload.text
      : payload.type === 'image' ? '📷 Photo'
      : payload.type === 'file'  ? `📎 ${payload.fileName}`
      : '🎤 Voice message';
    await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
      senderId: user.uid, createdAt: serverTimestamp(), ...payload,
    });
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: preview, lastMessageAt: serverTimestamp(),
      [`unread.${otherUid}`]: 1, [`unread.${user.uid}`]: 0,
    });
  };

  // ── Send text ────────────────────────────────────────────────────────────────
  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    setShowEmoji(false);
    try { await sendMsg({ text: trimmed }); } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  // ── Camera / Gallery ─────────────────────────────────────────────────────────
  const handleCamera = () => {
    Alert.alert('Send photo', '', [
      {
        text: 'Take photo', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission required', 'Camera access is required.');
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (result.canceled) return;
          setUploading(true);
          try {
            const url = await uploadFile(result.assets[0].uri, `chat/${conversationId}/${Date.now()}.jpg`);
            await sendMsg({ type: 'image', imageUrl: url });
          } catch { Alert.alert('Upload failed', 'Could not upload photo.'); }
          finally { setUploading(false); }
        },
      },
      {
        text: 'Choose from gallery', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission required', 'Gallery access is required.');
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
          if (result.canceled) return;
          setUploading(true);
          try {
            const url = await uploadFile(result.assets[0].uri, `chat/${conversationId}/${Date.now()}.jpg`);
            await sendMsg({ type: 'image', imageUrl: url });
          } catch { Alert.alert('Upload failed', 'Could not upload photo.'); }
          finally { setUploading(false); }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── File attachment ───────────────────────────────────────────────────────────
  const handleAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading(true);
      const url = await uploadFile(asset.uri, `chat/${conversationId}/${Date.now()}_${asset.name}`);
      await sendMsg({ type: 'file', fileUrl: url, fileName: asset.name, fileSize: asset.size });
    } catch { Alert.alert('Error', 'Could not attach file.'); }
    finally { setUploading(false); }
  };

  // ── Voice recording ───────────────────────────────────────────────────────────
  const handleMic = async () => {
    if (isRecording) {
      // Stop and send
      clearInterval(recTimerRef.current);
      setIsRecording(false);
      if (!recordingRef.current) return;
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        const dur = recDuration;
        setRecDuration(0);
        setUploading(true);
        const url = await uploadFile(uri, `chat/${conversationId}/${Date.now()}.m4a`);
        await sendMsg({ type: 'audio', audioUrl: url, duration: dur });
      } catch { Alert.alert('Error', 'Could not send voice message.'); }
      finally { setUploading(false); }
    } else {
      // Start recording
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Permission required', 'Microphone access is required.');
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
        setRecDuration(0);
        recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);
      } catch { Alert.alert('Error', 'Could not start recording.'); }
    }
  };

  const cancelRecording = async () => {
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    setRecDuration(0);
  };

  // ── Play audio message ────────────────────────────────────────────────────────
  const playAudio = async (url) => {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) { sound.unloadAsync(); soundRef.current = null; }
      });
    } catch { Alert.alert('Error', 'Could not play audio.'); }
  };

  // ── Bubble content ────────────────────────────────────────────────────────────
  const renderBubbleContent = (item, isMine) => {
    if (item.type === 'image') {
      return (
        <Image source={{ uri: item.imageUrl }} style={cs.imgBubble} resizeMode="cover" />
      );
    }
    if (item.type === 'file') {
      return (
        <View style={[cs.fileCard, isMine && cs.fileCardMine]}>
          <View style={[cs.fileIconWrap, isMine && cs.fileIconWrapMine]}>
            <Ionicons name="document-outline" size={22} color={isMine ? '#1c1917' : '#e63946'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.fileName, isMine && cs.fileNameMine]} numberOfLines={1}>{item.fileName}</Text>
            <Text style={[cs.fileSize, isMine && cs.fileSizeMine]}>
              {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : 'File'}
            </Text>
          </View>
          <Ionicons name="download-outline" size={18} color={isMine ? 'rgba(255,255,255,0.6)' : '#9ca3af'} />
        </View>
      );
    }
    if (item.type === 'audio') {
      return (
        <TouchableOpacity
          style={[cs.audioCard, isMine && cs.audioCardMine]}
          onPress={() => playAudio(item.audioUrl)}
          activeOpacity={0.8}
        >
          <View style={[cs.audioPlayBtn, isMine && cs.audioPlayBtnMine]}>
            <Ionicons name="play" size={14} color={isMine ? '#1c1917' : '#ffffff'} />
          </View>
          <View style={cs.audioWave}>
            {WAVE_HEIGHTS.map((h, i) => (
              <View key={i} style={[cs.audioBar, { height: h }, isMine && cs.audioBarMine]} />
            ))}
          </View>
          <Text style={[cs.audioDur, isMine && cs.audioDurMine]}>
            {fmtDuration(item.duration ?? 0)}
          </Text>
        </TouchableOpacity>
      );
    }
    return <Text style={[cs.bubbleTxt, isMine && cs.bubbleTxtMine]}>{item.text}</Text>;
  };

  // ── renderItem ───────────────────────────────────────────────────────────────
  const items = buildItems(messages);

  const renderItem = ({ item, index }) => {
    if (item._sep) {
      return (
        <View style={cs.sepRow}>
          <Text style={cs.sepTxt}>{fmtDateLabel(item.ts)}</Text>
        </View>
      );
    }

    const isMine  = item.senderId === user?.uid;
    const prevMsg = items[index - 1];
    const nextMsg = items[index + 1];
    const isFirst = !prevMsg || prevMsg._sep || prevMsg.senderId !== item.senderId;
    const isLast  = !nextMsg || nextMsg._sep || nextMsg.senderId !== item.senderId;
    const gap     = isClustered(prevMsg, item) ? 2 : 10;
    const isMedia = item.type === 'image' || item.type === 'file' || item.type === 'audio';

    return (
      <View style={[cs.msgWrap, isMine && cs.msgWrapMine, { marginTop: gap }]}>
        {!isMine && (
          <View style={{ width: 32, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
            {isLast && (
              <View style={[cs.bubbleAvatar, { backgroundColor: avatarBg }]}>
                <Text style={cs.bubbleAvatarTxt}>{initials(otherName)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={[cs.bubbleCol, isMine && cs.bubbleColMine]}>
          <View style={[
            cs.bubble,
            isMine ? cs.bubbleMine : cs.bubbleTheirs,
            isFirst && !isMine && cs.bubbleFirstTheirs,
            isFirst && isMine  && cs.bubbleFirstMine,
            isLast  && !isMine && cs.bubbleLastTheirs,
            isLast  && isMine  && cs.bubbleLastMine,
            isMedia && cs.bubbleMedia,
          ]}>
            {renderBubbleContent(item, isMine)}
          </View>
          {isLast && (
            <Text style={[cs.timeTxt, isMine && cs.timeTxtMine]}>{fmtTime(item.createdAt)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[cs.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={cs.header}>
        <TouchableOpacity style={cs.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#111110" />
        </TouchableOpacity>

        <HeaderAvatar name={otherName} bg={avatarBg} online={otherOnline} />

        <View style={cs.headerMid}>
          <Text style={cs.headerName} numberOfLines={1}>{otherName}</Text>
          <View style={cs.statusRow}>
            <View style={[cs.statusDot, { backgroundColor: otherOnline ? '#22c55e' : '#d1d5db' }]} />
            <Text style={cs.headerStatus}>{otherOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Available toggle */}
        <TouchableOpacity
          style={[cs.availBtn, myAvailable && cs.availBtnActive]}
          onPress={toggleAvailable}
          activeOpacity={0.8}
        >
          <View style={[cs.availDot, { backgroundColor: myAvailable ? '#22c55e' : '#d1d5db' }]} />
          <Text style={[cs.availTxt, myAvailable && cs.availTxtActive]}>
            {myAvailable ? 'Available' : 'Unavail.'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={cs.iconBtn}
          onPress={() => navigation.navigate('Call', { conversationId, otherName, otherUid, avatarBg, type: 'video' })}
        >
          <Ionicons name="videocam-outline" size={22} color="#111110" />
        </TouchableOpacity>
        <TouchableOpacity
          style={cs.iconBtn}
          onPress={() => navigation.navigate('Call', { conversationId, otherName, otherUid, avatarBg, type: 'voice' })}
        >
          <Ionicons name="call-outline" size={20} color="#111110" />
        </TouchableOpacity>
      </View>

      {/* Upload indicator */}
      {uploading && (
        <View style={cs.uploadBanner}>
          <ActivityIndicator size="small" color="#e63946" />
          <Text style={cs.uploadTxt}>Uploading…</Text>
        </View>
      )}

      {/* ── Messages ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={cs.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={() => (
            <View style={cs.emptyWrap}>
              <View style={cs.emptyIcon}>
                <Ionicons name="chatbubble-outline" size={32} color="#d1d5db" />
              </View>
              <Text style={cs.emptyTxt}>No messages yet</Text>
              <Text style={cs.emptySub}>Say hello to {otherName} 👋</Text>
            </View>
          )}
          renderItem={renderItem}
        />

        {/* Emoji picker panel */}
        {showEmoji && (
          <View style={cs.emojiPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 2, paddingHorizontal: 8, paddingVertical: 6 }}
            >
              {EMOJIS.map(em => (
                <TouchableOpacity key={em} style={cs.emojiBtn} onPress={() => setText(t => t + em)}>
                  <Text style={{ fontSize: 26 }}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Input bar ── */}
        {isRecording ? (
          /* Recording state */
          <View style={[cs.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={cs.cancelRecBtn} onPress={cancelRecording}>
              <Ionicons name="trash-outline" size={20} color="#e63946" />
            </TouchableOpacity>
            <View style={cs.recBar}>
              <View style={cs.recDot} />
              <Text style={cs.recTxt}>Recording  {fmtDuration(recDuration)}</Text>
            </View>
            <TouchableOpacity style={cs.sendBtn} onPress={handleMic} activeOpacity={0.8}>
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Normal input */
          <View style={[cs.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={cs.inputIcon} onPress={() => setShowEmoji(v => !v)}>
              <Ionicons name="happy-outline" size={24} color={showEmoji ? '#e63946' : '#9ca3af'} />
            </TouchableOpacity>

            <TextInput
              style={cs.input}
              placeholder="Enter message…"
              placeholderTextColor="#9ca3af"
              value={text}
              onChangeText={v => { setText(v); if (showEmoji) setShowEmoji(false); }}
              multiline
              maxLength={1000}
              returnKeyType="default"
              onFocus={() => setShowEmoji(false)}
            />

            {text.trim().length > 0 ? (
              <TouchableOpacity style={cs.sendBtn} onPress={send} disabled={sending} activeOpacity={0.8}>
                <Ionicons name="send" size={18} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={cs.inputIcon} onPress={handleAttachment}>
                  <Ionicons name="attach-outline" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity style={cs.inputIcon} onPress={handleCamera}>
                  <Ionicons name="camera-outline" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <TouchableOpacity style={cs.inputIcon} onPress={handleMic}>
                  <Ionicons name="mic-outline" size={24} color="#9ca3af" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const RADIUS = 20;
const SMALL  = 6;

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f3ef', alignItems: 'center', justifyContent: 'center' },
  hAvatar:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hAvatarTxt:   { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  hOnlineDot:   { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#ffffff' },
  headerMid:    { flex: 1 },
  headerName:   { color: '#111110', fontSize: 15, fontWeight: '700' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  headerStatus: { color: '#9ca3af', fontSize: 11 },
  iconBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f3ef', alignItems: 'center', justifyContent: 'center' },

  // Available toggle
  availBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  availBtnActive: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  availDot:       { width: 7, height: 7, borderRadius: 4 },
  availTxt:       { color: '#9ca3af', fontSize: 11, fontWeight: '700' },
  availTxtActive: { color: '#16a34a' },

  // Upload banner
  uploadBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7f7', paddingHorizontal: 16, paddingVertical: 8 },
  uploadTxt:    { color: '#e63946', fontSize: 13, fontWeight: '600' },

  // List
  listContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },

  // Date separator
  sepRow: { alignItems: 'center', marginVertical: 16 },
  sepTxt: { color: '#9ca3af', fontSize: 12, fontWeight: '500', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },

  // Message wrapper
  msgWrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4 },
  msgWrapMine: { flexDirection: 'row-reverse' },

  // Bubble col
  bubbleCol:     { maxWidth: '72%', alignItems: 'flex-start' },
  bubbleColMine: { alignItems: 'flex-end' },

  // Bubble
  bubble:            { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS },
  bubbleMedia:       { padding: 0, overflow: 'hidden' },
  bubbleTheirs:      { backgroundColor: '#ffffff' },
  bubbleMine:        { backgroundColor: '#1c1917' },
  bubbleTxt:         { color: '#111110', fontSize: 14, lineHeight: 20 },
  bubbleTxtMine:     { color: '#ffffff' },
  bubbleFirstTheirs: { borderTopLeftRadius: RADIUS },
  bubbleLastTheirs:  { borderBottomLeftRadius: SMALL },
  bubbleFirstMine:   { borderTopRightRadius: RADIUS },
  bubbleLastMine:    { borderBottomRightRadius: SMALL },

  // Bubble avatar
  bubbleAvatar:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarTxt: { color: '#ffffff', fontSize: 10, fontWeight: '800' },

  // Timestamps
  timeTxt:     { color: '#9ca3af', fontSize: 11, marginTop: 4, marginLeft: 2 },
  timeTxtMine: { marginLeft: 0, marginRight: 2 },

  // Image bubble
  imgBubble: { width: 220, height: 180, borderRadius: RADIUS },

  // File card
  fileCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minWidth: 180, maxWidth: 220 },
  fileCardMine:    {},
  fileIconWrap:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  fileIconWrapMine:{ backgroundColor: 'rgba(255,255,255,0.15)' },
  fileName:        { color: '#111110', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  fileNameMine:    { color: '#ffffff' },
  fileSize:        { color: '#9ca3af', fontSize: 11 },
  fileSizeMine:    { color: 'rgba(255,255,255,0.55)' },

  // Audio card
  audioCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minWidth: 180 },
  audioCardMine:    {},
  audioPlayBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },
  audioPlayBtnMine: { backgroundColor: '#ffffff' },
  audioWave:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  audioBar:         { width: 3, borderRadius: 2, backgroundColor: 'rgba(60,60,60,0.25)' },
  audioBarMine:     { backgroundColor: 'rgba(255,255,255,0.4)' },
  audioDur:         { color: '#9ca3af', fontSize: 11, minWidth: 34 },
  audioDurMine:     { color: 'rgba(255,255,255,0.6)' },

  // Emoji panel
  emojiPanel: { backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6', height: 56 },
  emojiBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Input bar
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 6 },
  inputIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input:        { flex: 1, backgroundColor: '#f5f3ef', borderRadius: 20, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 14, color: '#111110', maxHeight: 120, lineHeight: 20 },
  sendBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e63946', alignItems: 'center', justifyContent: 'center' },

  // Recording bar
  cancelRecBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  recBar:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff0f0', borderRadius: 20, paddingHorizontal: 14, height: 36 },
  recDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e63946' },
  recTxt:       { color: '#e63946', fontSize: 14, fontWeight: '600' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTxt:  { color: '#111110', fontSize: 16, fontWeight: '700' },
  emptySub:  { color: '#9ca3af', fontSize: 14 },
});
