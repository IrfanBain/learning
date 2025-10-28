"use client"; // Context perlu interaksi client

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User, signOut, Auth } from 'firebase/auth'; // Impor tipe Auth
import { doc, getDoc } from 'firebase/firestore';
// 1. Impor 'getClientAuth' (Sudah Benar)
import { db, getClientAuth } from '@/lib/firebaseConfig'; 

const INACTIVITY_TIMEOUT_MS = 3600 * 1000; 
const LAST_ACTIVITY_KEY = 'lastActivityTime';

// Definisikan tipe untuk data pengguna yang disimpan
interface AuthUser {
  uid: string;
  email: string | null;
  name: string;
  role: 'admin' | 'teacher' | 'student' | null; 
  photoURL: string | null;
}

// Tipe untuk nilai Context
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// Buat Context
const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

// Buat Provider Komponen
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    setLoading(true); 
    try {
      // 2. Panggil getClientAuth() (Sudah Benar)
      const auth = getClientAuth();
      await signOut(auth);
      localStorage.removeItem(LAST_ACTIVITY_KEY); 
      console.log("User logged out manually.");
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
      setLoading(false); 
    }
  };

  useEffect(() => {
    // 3. Panggil getClientAuth() (Sudah Benar)
    const auth = getClientAuth();

    // Listener untuk perubahan status login Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const now = Date.now();
        const lastActivityTime = localStorage.getItem(LAST_ACTIVITY_KEY);

        if (lastActivityTime && (now - parseInt(lastActivityTime) > INACTIVITY_TIMEOUT_MS)) {
          console.log("Sesi berakhir karena tidak aktif. Harap login kembali.");
          logout(); 
          return; 
        }

        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name || 'No Name', 
              role: userData.role || null, 
              photoURL: firebaseUser.photoURL || null,
            });
          } else {
            console.error("User data not found in Firestore for UID:", firebaseUser.uid);
            // --- KODE BERSIH (MASALAH #1 DIPERBAIKI) ---
            setUser({ 
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || 'No Name',
                role: null, 
                photoURL: firebaseUser.photoURL || null,
            });
          }
        } catch (error) {
           console.error("Error fetching user data from Firestore:", error);
           // --- KODE BERSIH (MASALAH #2 DIPERBAIKI) ---
           setUser({ 
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName || 'No Name',
                role: null,
                photoURL: firebaseUser.photoURL || null,
            });
        }
      } else {
        setUser(null);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }
      setLoading(false); // <-- (MASALAH #3 'end' DIHAPUS)
    });

    // Cleanup listener saat komponen unmount
    return () => unsubscribe();
  }, []); 

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Buat custom hook untuk menggunakan Context
export const useAuth = () => useContext(AuthContext);

