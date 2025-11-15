"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { db, getClientAuth } from "@/lib/firebaseConfig";

const INACTIVITY_TIMEOUT_MS = 3600 * 1000;
const LAST_ACTIVITY_KEY = "lastActivityTime";

// ------------------ TYPES ------------------
interface AuthUser {
  uid: string;
  email: string | null;
  name: string;
  role: "admin" | "teacher" | "student" | null;
  photoURL: string | null;
  foto_profil?: string | null;
  kelas_ref?: any;
  kelas_ref_id?: string | null;
  kelas_ref_path?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// ------------------ CONTEXT ------------------
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

// ------------------ PROVIDER ------------------
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    setLoading(true);
    try {
      const auth = getClientAuth();
      await signOut(auth);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const auth = getClientAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const now = Date.now();
        const lastActivityTime = localStorage.getItem(LAST_ACTIVITY_KEY);

        if (lastActivityTime && now - parseInt(lastActivityTime) > INACTIVITY_TIMEOUT_MS) {
          toast.error("Sesi Anda telah berakhir karena tidak aktif. Silakan login kembali.");
          logout();
          return;
        }

        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        const userDocRef = doc(db, "users", firebaseUser.uid);

        try {
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();

            // 🔥 Ambil data siswa tambahan
            let extraStudentData = {};
            if (userData.role === "student") {
              const studentRef = doc(db, "students", firebaseUser.uid);
              const studentSnap = await getDoc(studentRef);

              if (studentSnap.exists()) {
                const sData = studentSnap.data();
                extraStudentData = {
                  name: sData.nama_lengkap || userData.name || "No Name",
                  foto_profil: sData.foto_profil || userData.foto_profil || null,
                  kelas_ref: sData.kelas_ref || null,
                  kelas_ref_id: sData.kelas_ref?.id || null,
                  kelas_ref_path: sData.kelas_ref?.path || null,
                };
              } else {
                console.warn("⚠️ Student document not found for", firebaseUser.uid);
              }
            }

            // 🔗 Gabungkan data users + (jika ada) students
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: userData.name || "No Name",
              role: userData.role || null,
              photoURL: userData.foto_profil || firebaseUser.photoURL || null,
              ...extraStudentData,
            });
          } else {
            console.error("User data not found in Firestore for UID:", firebaseUser.uid);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || "No Name",
              role: null,
              photoURL: firebaseUser.photoURL || null,
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "No Name",
            role: null,
            photoURL: firebaseUser.photoURL || null,
          });
        }
      } else {
        setUser(null);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      }

      setLoading(false);
    });

    return () => unsubscribe(); 
  }, []);

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
};

// ------------------ HOOK ------------------
export const useAuth = () => useContext(AuthContext);
