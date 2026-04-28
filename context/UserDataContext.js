import { createContext, useContext, useEffect, useState } from 'react';
import {
  doc, collection, query, orderBy, limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const UserDataContext = createContext(null);

export function UserDataProvider({ children }) {
  const { user } = useAuth();

  const [profile,       setProfile]       = useState(null);
  const [goals,         setGoals]         = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setGoals([]);
      setTransactions([]);
      setNotifications([]);
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
    ];

    return () => unsubs.forEach(fn => fn());
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <UserDataContext.Provider value={{ profile, goals, transactions, notifications, unreadCount }}>
      {children}
    </UserDataContext.Provider>
  );
}

export const useUserData = () => useContext(UserDataContext);
