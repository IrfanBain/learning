import * as admin from 'firebase-admin';

// 1. Ambil string JSON dari Environment Variable Vercel
const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;

// 2. Cek apakah variabelnya ada
if (!serviceAccountJson) {
  throw new Error('Variabel FIREBASE_ADMIN_SERVICE_ACCOUNT belum diatur di Vercel.');
}

// 3. Parse (ubah) string JSON tadi menjadi objek JavaScript
let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error('Error parsing FIREBASE_ADMIN_SERVICE_ACCOUNT:', e);
  throw new Error('Gagal mem-parsing FIREBASE_ADMIN_SERVICE_ACCOUNT. Pastikan format JSON-nya benar.');
}

// 4. Inisialisasi Firebase Admin
// Cek agar tidak menginisialisasi ulang
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

export { adminAuth, adminDb };
