import { createContext, useContext, useEffect, useState } from 'react';
import {
  doc, collection, query, orderBy, limit, where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const UserDataContext = createContext(null);

export function UserDataProvider({ children }) {
  const { user } = useAuth();

  const [profile,          setProfile]          = useState(null);
  const [goals,            setGoals]            = useState([]);
  const [transactions,     setTransactions]     = useState([]);
  const [notifications,    setNotifications]    = useState([]);
  const [unreadMessages,   setUnreadMessages]   = useState(0);
  const [incomingMessage,  setIncomingMessage]  = useState(null);
  const [incomingCall,     setIncomingCall]     = useState(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setGoals([]);
      setTransactions([]);
      setNotifications([]);
      setUnreadMessages(0);
      setIncomingMessage(null);
      setIncomingCall(null);
      return;
    }

    const unsubs = [
      onSnapshot(doc(db, 'users', user.uid), snap => {
        if (snap.exists()) setProfile(snap.data());
      }),

      onSnapshot(collection(db, 'users', user.uid, 'goals'), snap => {
        setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }),

      onSnapshot(
        query(
          collection(db, 'users', user.uid, 'transactions'),
          orderBy('createdAt', 'desc'),
          limit(14),
        ),
        snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      ),

      onSnapshot(
        query(
          collection(db, 'users', user.uid, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(30),
        ),
        snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => {},
      ),

      // Live unread count + incoming message detection
      (() => {
        let initialized = false;
        const prevUnread = {};   // { [convId]: number }

        return onSnapshot(
          query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', user.uid),
          ),
          snap => {
            // Always update the badge count
            const total = snap.docs.reduce(
              (sum, d) => sum + (d.data().unread?.[user.uid] ?? 0), 0
            );
            setUnreadMessages(total);

            if (!initialized) {
              // Seed baseline so first-load unreads don't pop a toast
              snap.docs.forEach(d => {
                prevUnread[d.id] = d.data().unread?.[user.uid] ?? 0;
              });
              initialized = true;
              return;
            }

            // Detect which conversation got a new message
            for (const d of snap.docs) {
              const data    = d.data();
              const curr    = data.unread?.[user.uid] ?? 0;
              const prev    = prevUnread[d.id] ?? 0;

              if (curr > prev && data.lastMessage) {
                const otherUid = (data.participants ?? []).find(p => p !== user.uid);
                const meta     = data.participantMeta?.[otherUid] ?? {};
                setIncomingMessage({
                  conversationId: d.id,
                  senderName:     meta.name    ?? 'Someone',
                  senderUid:      otherUid,
                  avatarBg:       meta.avatarBg ?? '#e63946',
                  text:           data.lastMessage,
                  ts:             Date.now(),
                });
                break;
              }
            }

            // Update baseline
            snap.docs.forEach(d => {
              prevUnread[d.id] = d.data().unread?.[user.uid] ?? 0;
            });
          },
          () => {},
        );
      })(),

      // Incoming call listener
      onSnapshot(
        query(
          collection(db, 'calls'),
          where('calleeId', '==', user.uid),
        ),
        snap => {
          const ringing = snap.docs.find(d => d.data().status === 'ringing');
          if (ringing) {
            setIncomingCall({ id: ringing.id, ...ringing.data() });
          } else {
            setIncomingCall(null);
          }
        },
        () => {},
      ),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [user]);

  const unreadCount          = notifications.filter(n => !n.read).length;
  const pendingReview        = notifications.find(n => n.type === 'review_request' && !n.read) ?? null;
  const clearIncomingMessage = () => setIncomingMessage(null);
  const clearIncomingCall    = () => setIncomingCall(null);

  return (
    <UserDataContext.Provider value={{
      profile, goals, transactions,
      notifications, unreadCount,
      unreadMessages,
      incomingMessage, clearIncomingMessage,
      incomingCall,   clearIncomingCall,
      pendingReview,
    }}>
      {children}
    </UserDataContext.Provider>
  );
}

export const useUserData = () => useContext(UserDataContext);
