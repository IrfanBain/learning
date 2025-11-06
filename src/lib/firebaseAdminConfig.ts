import * as admin from 'firebase-admin';

// Ganti dengan nama file .json yang Anda download
const serviceAccount = require('../../e-learning-firebase-adminsdk.json'); 

// Cek agar tidak menginisialisasi ulang
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

export { adminAuth, adminDb };