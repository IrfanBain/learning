"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig'; 
import { type User as AuthUser } from 'firebase/auth';
import {
    collection,
    query,
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    orderBy,
    onSnapshot,
    QuerySnapshot,
    DocumentData,
    where, 
    QueryConstraint,
    limit 
} from 'firebase/firestore';
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    ArrowRight, 
    FileText, 
    CalendarHeart, 
    Users, 
    CalendarCheck 
} from "lucide-react";
import Link from "next/link";

// --- Tipe Data (dari 'events/page.tsx') ---
interface EventDoc {
    id: string;
    judul: string;
    deskripsi: string;
    tanggal_mulai: Timestamp;
    tanggal_selesai: Timestamp;
    allDay: boolean;
    kategori: "Ujian" | "Libur" | "Acara Sekolah" | "Rapat" | "Lainnya";
    target_audiens: "Semua" | "Guru" | "Siswa";
    target_kelas_ref: DocumentReference | null;
}

// --- FUNGSI HELPER ---
const getRelativeDateStatus = (startDate: Timestamp) => {
    // ... (Fungsi ini tidak berubah)
    if (!startDate) return { text: "Mendatang", color: "text-gray-500" };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDateTs = startDate.toDate();
    const eventDate = new Date(eventDateTs.getFullYear(), eventDateTs.getMonth(), eventDateTs.getDate());
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
        return { text: "Selesai", color: "text-red-500" };
    }
    if (diffDays === 0) {
        return { text: "Hari Ini", color: "text-green-600" };
    }
    if (diffDays === 1) {
        return { text: "Besok", color: "text-yellow-600" };
    }
    return { text: "Mendatang", color: "text-blue-500" };
};

const getCategoryStyle = (kategori: EventDoc['kategori']) => {
    // ... (Fungsi ini tidak berubah)
    switch(kategori) {
        case "Ujian":
            return { color: "border-l-red-500", icon: <FileText className="w-5 h-5 text-red-500" /> };
        case "Libur":
            return { color: "border-l-purple-500", icon: <CalendarHeart className="w-5 h-5 text-purple-500" /> };
        case "Rapat":
            return { color: "border-l-yellow-500", icon: <Users className="w-5 h-5 text-yellow-500" /> };
        case "Acara Sekolah":
        default:
            return { color: "border-l-blue-500", icon: <CalendarCheck className="w-5 h-5 text-blue-500" /> };
    }
};


// --- KOMPONEN UTAMA ---
const EventListWidget = () => {
  const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<DocumentData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // (Semua logika fetching data tetap sama)
  useEffect(() => {
    if (user?.uid && !authLoading) {
      const fetchUserData = async () => {
        setLoadingUser(true);
        let userRole: string | null = null;
        let userProfileData: DocumentData | null = null;
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                userProfileData = userDocSnap.data();
                userRole = userProfileData.role;
            } else {
                const teacherDocRef = doc(db, "teachers", user.uid);
                const teacherDocSnap = await getDoc(teacherDocRef);
                if (teacherDocSnap.exists()) {
                    userProfileData = teacherDocSnap.data();
                    userRole = "teacher"; 
                } else {
                     const studentDocRef = doc(db, "students", user.uid);
                     const studentDocSnap = await getDoc(studentDocRef);
                     if (studentDocSnap.exists()) {
                         userProfileData = studentDocSnap.data();
                         userRole = "student";
                     } else {
                         throw new Error("Data profil Anda tidak ditemukan.");
                     }
                }
            }
            setUserData({ ...userProfileData, role: userRole });
        } catch (err: any) {
            console.error("Gagal mengambil data user:", err);
        } finally {
            setLoadingUser(false);
        }
      };
      fetchUserData();
    }
    if (!user && !authLoading) {
        setLoading(false);
        setLoadingUser(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (loadingUser || !userData) {
        if (!authLoading && !loadingUser) setLoading(false);
        return;
    }

    setLoading(true);
    const role = userData.role;
    
    const queryConstraints: QueryConstraint[] = [];

    if (role === 'admin') {
        // Admin melihat SEMUA
    } else if (role === 'teacher') {
        queryConstraints.push(where("target_audiens", "in", ["Semua", "Guru"]));
    } else if (role === 'student') {
        queryConstraints.push(where("target_audiens", "in", ["Semua", "Siswa"]));
    } else {
         setLoading(false);
         return;
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    queryConstraints.push(where("tanggal_mulai", ">=", Timestamp.fromDate(yesterday)));
    
    queryConstraints.push(orderBy("tanggal_mulai", "asc")); 
    queryConstraints.push(limit(3)); 

    const q = query(
        collection(db, "events"),
        ...queryConstraints
    );

    const unsubscribe = onSnapshot(q, 
        (querySnapshot: QuerySnapshot) => {
            const eventsData: EventDoc[] = [];
            
            querySnapshot.forEach((docSnap) => {
                const eventData = { id: docSnap.id, ...docSnap.data() } as EventDoc;
                
                if (role === 'student' && userData.kelas_ref) {
                    if (eventData.target_kelas_ref && eventData.target_kelas_ref.id !== userData.kelas_ref.id) {
                        return;
                    }
                }
                eventsData.push(eventData);
            });
            
            setEvents(eventsData);
            setLoading(false);
        }, 
        (err: any) => {
            console.error("Error listening to events:", err);
            setLoading(false);
        }
    );

    return () => unsubscribe();
  }, [user, loadingUser, userData]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Acara</h1>
        <Link href="/list/events" className="text-xs text-blue-600 hover:underline">
            Lihat Semua
        </Link>
      </div>
      <div className="flex flex-col gap-3 mt-2">

        {(loading || loadingUser) ? (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        ) : events.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-24 text-gray-500 text-center">
                <CalendarIcon className="w-8 h-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium">Tidak ada acara mendatang.</p>
            </div>
        ) : (
            events.map((event) => {
                const status = getRelativeDateStatus(event.tanggal_mulai);
                const style = getCategoryStyle(event.kategori);
                let timeString = "Seharian";
                if (!event.allDay) {
                    const startTime = event.tanggal_mulai.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    timeString = `Mulai pukul ${startTime}`;
                }

                return (
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg border border-gray-100 border-l-4 ${style.color} bg-gray-50/50`}
                    key={event.id}
                  >
                    <div className="flex-shrink-0 pt-1">
                        {style.icon}
                    </div>
                    <div className="flex-grow">
                        <div className="flex items-center justify-between">
                          <h2 className="font-semibold text-gray-800">{event.judul}</h2>
                          <span className={`text-xs font-bold ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{timeString}</p>
                    </div>
                  </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default EventListWidget;
