import { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';

const BG   = '#f0ede6';
const DARK = '#111110';
const RED  = '#e63946';

const TYPE_META = {
  job_application: { icon: 'briefcase-outline',   color: '#3b82f6', bg: '#eff6ff' },
  payment:         { icon: 'cash-outline',          color: '#10b981', bg: '#f0fdf4' },
  hire:            { icon: 'person-add-outline',    color: '#a855f7', bg: '#faf5ff' },
  default:         { icon: 'notifications-outline', color: '#9ca3af', bg: '#f3f4f6' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotifRow({ notif, onRead }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.default;

  return (
    <TouchableOpacity
      style={[nr.row, !notif.read && nr.rowUnread]}
      onPress={() => !notif.read && onRead(notif.id)}
      activeOpacity={0.75}
    >
      <View style={[nr.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={nr.message}>{notif.message}</Text>
        <Text style={nr.time}>{timeAgo(notif.createdAt)}</Text>
      </View>

      {!notif.read && <View style={nr.dot} />}
    </TouchableOpacity>
  );
}

const nr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowUnread: { backgroundColor: '#fef9f9' },
  iconWrap:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  message:   { color: DARK, fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 3 },
  time:      { color: '#9ca3af', fontSize: 12 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
});

export default function NotificationsScreen({ navigation }) {
  const insets              = useSafeAreaInsets();
  const { user }            = useAuth();
  const { notifications, unreadCount } = useUserData();

  const markRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), { read: true });
    } catch {}
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      const batch   = writeBatch(db);
      notifications
        .filter(n => !n.read)
        .forEach(n => batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch {}
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.8}>
            <Text style={st.markAll}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <View style={st.unreadBanner}>
          <View style={st.unreadDot} />
          <Text style={st.unreadTxt}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {notifications.length === 0 ? (
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={40} color="#d1d5db" />
            </View>
            <Text style={st.emptyTitle}>No notifications yet</Text>
            <Text style={st.emptySub}>You'll be notified when someone applies to your job or sends you a payment</Text>
          </View>
        ) : (
          <View style={st.list}>
            {notifications.map(n => (
              <NotifRow key={n.id} notif={n} onRead={markRead} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { color: DARK, fontSize: 20, fontWeight: '800' },
  markAll:      { color: RED, fontSize: 13, fontWeight: '600', width: 80, textAlign: 'right' },

  unreadBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, backgroundColor: '#fef2f2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  unreadTxt:    { color: RED, fontSize: 13, fontWeight: '600' },

  list:         { backgroundColor: '#ffffff', borderRadius: 20, marginHorizontal: 20, overflow: 'hidden' },

  emptyWrap:    { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { color: DARK, fontSize: 17, fontWeight: '700' },
  emptySub:     { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
