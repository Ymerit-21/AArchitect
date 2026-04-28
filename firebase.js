// firebase.js — Firebase app + auth initialisation.
// Fill in your config from: Firebase Console → Project Settings → Your Apps → Web App → Config

import { getApps, initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyBs58hyVXaKqKpQuNK574f6M2JQ9V5OWLo',
  authDomain:        'architect-6315d.firebaseapp.com',
  projectId:         'architect-6315d',
  storageBucket:     'architect-6315d.firebasestorage.app',
  messagingSenderId: '181608541181',
  appId:             '1:181608541181:web:523cfd0d730ce9b2bec794',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = (() => {
  try {
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app, 'gs://architect-6315d.firebasestorage.app');

export default app;
