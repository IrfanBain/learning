import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Konfigurasi Firebase Anda (ambil dari .env.local atau tulis langsung di sini)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// --- Inisialisasi Aplikasi (Aman untuk Server dan Client) ---
// Ini akan mencegah inisialisasi berulang kali di Next.js HMR
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- Layanan Sisi Server & Universal (Aman) ---
// Firestore (bisa di server, bisa di client)
const db: Firestore = getFirestore(app);

// --- Layanan KHUSUS Client-Side (Penyebab Error Anda) ---
// Kita akan buat "getter" agar tidak langsung dipanggil di server
let auth: Auth;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;
let analyticsInstance: Analytics | null = null;

/**
 * Mengambil instance Auth (client-side only).
 * WAJIB dijalankan di dalam useEffect() atau event handler.
 */
export const getClientAuth = (): Auth => {
  // Hanya jalankan di browser (walaupun getAuth() modern sudah cukup aman)
  if (typeof window === 'undefined') {
    // Jika di server, kembalikan instance "dummy" atau handle error
    // Tapi idealnya, panggil ini HANYA di client
    return getAuth(app); // getAuth() V9+ harusnya aman, tapi kita batasi panggilannya
  }
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

/**
 * Mengambil instance Storage (client-side only).
 * WAJIB dijalankan di dalam useEffect() atau event handler.
 */
export const getClientStorage = (): FirebaseStorage => {
  if (typeof window === 'undefined') {
    return getStorage(app); // Sama seperti getAuth
  }
  if (!storageInstance) {
    storageInstance = getStorage(app);
  }
  return storageInstance;
};

/**
 * Mengambil instance Analytics (client-side only).
 * WAJIB dijalankan di dalam useEffect() dan dicek ketersediaannya.
 */
export const getClientAnalytics = (): Analytics | null => {
  // Hanya jalankan di browser
  if (typeof window !== 'undefined') {
    if (!analyticsInstance) {
      // Gunakan isSupported() seperti yang disarankan log error Anda
      isSupported().then((supported) => {
        if (supported) {
          analyticsInstance = getAnalytics(app);
        }
      });
    }
    return analyticsInstance;
  }
  return null;
};

auth = getAuth(app);

// Ekspor app dan db (ini aman)
export { app, db, auth };

