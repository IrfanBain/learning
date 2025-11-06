"use client"

import Image from "next/image"
import { useAuth } from '@/context/authContext';
import React, { useState, useEffect } from "react"; // <-- IMPOR BARU
import { db } from "@/lib/firebaseConfig"; // <-- IMPOR BARU
import { type User as AuthUser } from 'firebase/auth'; // <-- IMPOR BARU
import {
    collection,
    query,
    doc,
    getDoc,
    Timestamp,
    orderBy,
    onSnapshot, // <-- IMPOR BARU
    QuerySnapshot,
    DocumentData,
    where, 
    QueryConstraint,
    limit // <-- IMPOR BARU
} from 'firebase/firestore';
import { Loader2, Megaphone } from "lucide-react"; // <-- IMPOR BARU
import Link from "next/link"; // <-- IMPOR BARU

// --- DEFINISI TIPE ---

interface AnnouncementDoc {
    id: string;
    judul: string;
    isi: string;
    tanggal_dibuat: Timestamp;
    target_audiens: "Semua" | "Siswa" | "Guru";
}

const Announcements = () => {
  const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
  
  // --- STATE BARU ---
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"student" | "teacher" | "admin" | null>(null);

  // --- 1. Ambil Data Role Pengguna ---
  useEffect(() => {
    if (user?.uid && !authLoading) {
      const fetchUserData = async () => {
        try {
          // Asumsi: SEMUA data user (termasuk role) ada di koleksi 'users'
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const role = userData.role; // Ambil role (misal: 'teacher')
            
            if (role === 'admin') setUserRole("admin");
            else if (role === 'teacher') setUserRole("teacher");
            else if (role === 'student') setUserRole("student");
            else setUserRole(null); // Role tidak dikenali

          } else {
            // Fallback (jika data role ada di 'teachers'/'students')
            const teacherDocRef = doc(db, "teachers", user.uid);
            const teacherDocSnap = await getDoc(teacherDocRef);
            if (teacherDocSnap.exists()) {
                 setUserRole("teacher");
            } else {
                 const studentDocRef = doc(db, "students", user.uid);
                 const studentDocSnap = await getDoc(studentDocRef);
                 if (studentDocSnap.exists()) {
                     setUserRole("student");
                 } else {
                     console.error("Data profil tidak ditemukan.");
                 }
            }
          }
        } catch (err: any) {
            console.error("Gagal mengambil data user:", err);
        }
      };
      fetchUserData();
    }
    if (!user && !authLoading) {
        setLoading(false); // Selesai loading jika tidak ada user
    }
  }, [user, authLoading]);

  // --- 2. Ambil Pengumuman (Real-time & Difilter) ---
  useEffect(() => {
    // Jangan jalankan jika role belum didapat atau masih loading auth
    if (!userRole || authLoading) {
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);

    const queryConstraints: QueryConstraint[] = [];

    if (userRole === 'admin') {
        // Admin melihat SEMUA
    } else if (userRole === 'teacher') {
        queryConstraints.push(where("target_audiens", "in", ["Semua", "Guru"]));
    } else if (userRole === 'student') {
        queryConstraints.push(where("target_audiens", "in", ["Semua", "Siswa"]));
    }

    queryConstraints.push(orderBy("tanggal_dibuat", "desc"));
    queryConstraints.push(limit(3)); // <-- HANYA AMBIL 3 TERBARU

    const q = query(
        collection(db, "announcements"),
        ...queryConstraints
    );

    const unsubscribe = onSnapshot(q, 
        (querySnapshot: QuerySnapshot) => {
            const announcementsData: AnnouncementDoc[] = [];
            querySnapshot.forEach((doc) => {
                announcementsData.push({ id: doc.id, ...doc.data() } as AnnouncementDoc);
            });
            
            setAnnouncements(announcementsData);
            setLoading(false);
        }, 
        (err: any) => {
            console.error("Error listening to announcements:", err);
            setLoading(false);
            // Jangan tampilkan toast error di widget dashboard
        }
    );

    return () => unsubscribe();
  }, [userRole, authLoading]); // <-- Jalankan ulang jika 'userRole' berubah

  // Array warna-warni (sesuai style Anda)
  const colorClasses = [
    'bg-blue-100 text-blue-800', // Mirip lamaSkyLight
    'bg-purple-100 text-purple-800', // Mirip lamaPurpleLight
    'bg-yellow-100 text-yellow-800' // Mirip lamaYellowLight
  ];

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pengumuman</h1>
        <Link href="/list/announcements" className="text-xs text-blue-600 hover:underline">
            Lihat Semua
        </Link>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        
        {/* --- KONTEN DINAMIS --- */}
        {loading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        ) : announcements.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-40 text-gray-500">
                <Megaphone className="w-10 h-10 text-gray-300" />
                <p className="mt-2 text-sm font-medium">Belum ada pengumuman.</p>
            </div>
        ) : (
            announcements.map((item, index) => (
                <div 
                    key={item.id} 
                    // Gunakan index % 3 (0, 1, 2) untuk mengambil warna
                    className={`rounded-md p-4 ${colorClasses[index % colorClasses.length]}`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800">{item.judul}</h2>
                    <span className="text-xs text-gray-500 bg-white/70 rounded-md px-1.5 py-0.5">
                      {/* Tambahkan pengecekan null '?' */}
                      {item.tanggal_dibuat?.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) || 'Baru'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {item.isi}
                  </p>
                </div>
            ))
        )}
        
      </div>
    </div>
  );
};

export default Announcements;
