"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/authContext'; // <-- PASTIKAN PATH INI BENAR
import { db } from '@/lib/firebaseConfig'; // <-- PASTIKAN PATH INI BENAR
import { doc, getDoc, collection, query, where, getDocs, DocumentReference } from 'firebase/firestore'; 

// Impor komponen Anda (pastikan path-nya benar)
import Announcements from "@/components/Announcements"; 
import DynamicEventCalendar from "@/components/EventCalendar"; // Ganti nama/path jika perlu

// Import ikon-ikon (pastikan Anda sudah install: npm install lucide-react)
import { 
    Book, 
    Calculator, 
    Globe, 
    Users, // Akan kita pakai untuk ikon Kelas
    Palette, 
    FlaskConical, 
    Clock, 
    User, // Tidak terpakai di kartu, tapi bisa disimpan
    CalendarDays 
} from 'lucide-react';

// --- DEFINISI TIPE DATA ---
interface TeacherData {
    nama_lengkap: string;
}
interface ScheduleDoc {
    id: string;
    hari: string; 
    jam_mulai: string; 
    jam_selesai: string; 
    mapel_ref: DocumentReference; 
    guru_ref: DocumentReference; 
    kelas_ref: DocumentReference; 
}
// Tipe Objek Info Kelas
interface KelasInfo {
    tingkat: string;
    nama: string;
}
interface CombinedSchedule {
    id: string;
    hari: string;
    jam_mulai: string;
    jam_selesai: string;
    mapelNama: string;
    // kelasNama: string; // <-- Kita ganti dengan objek di bawah
    kelasInfo: KelasInfo | null; // <-- Objek untuk menyimpan tingkat dan nama kelas
    mapelIcon: React.ReactNode;
}
type GroupedSchedules = {
    [key: string]: CombinedSchedule[];
};

// --- DATA & HELPER ---
const HARI_URUT = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const getHariIni = () => {
    const hariIndex = new Date().getDay(); 
    const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return namaHari[hariIndex] || "Senin"; 
};

const getSubjectIcon = (subjectName: string): React.ReactNode => {
    if (!subjectName) return <Book className="w-6 h-6 text-gray-500" />;
    const name = subjectName.toLowerCase();
    if (name.includes('matematika')) return <Calculator className="w-6 h-6 text-red-500" />;
    if (name.includes('biologi')) return <FlaskConical className="w-6 h-6 text-green-500" />;
    if (name.includes('fisika')) return <FlaskConical className="w-6 h-6 text-blue-500" />;
    if (name.includes('kimia')) return <FlaskConical className="w-6 h-6 text-yellow-500" />;
    if (name.includes('ips')) return <Globe className="w-6 h-6 text-orange-500" />;
    if (name.includes('pkn') || name.includes('ppkn')) return <Users className="w-6 h-6 text-purple-500" />;
    if (name.includes('seni')) return <Palette className="w-6 h-6 text-pink-500" />;
    return <Book className="w-6 h-6 text-gray-500" />;
};

// --- KOMPONEN UTAMA ---

const TeacherPage = () => {
    const { user, loading: authLoading } = useAuth(); 

    // --- STATES ---
    const [teacherName, setTeacherName] = useState<string>("Guru"); 
    const [groupedSchedules, setGroupedSchedules] = useState<GroupedSchedules>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>(getHariIni());

    // --- LOGIKA FETCHING DATA ASLI DARI FIREBASE ---
    useEffect(() => {
        if (authLoading || !user) {
            if (authLoading) setLoading(true);
            if (!authLoading && !user) {
                setLoading(false);
                setError("Tidak ada user terdeteksi. Silakan login kembali.");
            }
            return;
        }

        const fetchTeacherSchedule = async () => { 
            setLoading(true);
            setError(null);

            try {
                // 1. Ambil Data Guru (teachers/{userId})
                const teacherRef = doc(db, "teachers", user.uid); 
                const teacherSnap = await getDoc(teacherRef);
                if (!teacherSnap.exists()) {
                    throw new Error("Data guru tidak ditemukan. Pastikan Anda login dengan akun guru.");
                }
                
                const teacherData = teacherSnap.data() as TeacherData;
                setTeacherName(teacherData.nama_lengkap || "Guru"); 

                // 2. Ambil Jadwal berdasarkan guru_ref
                const schedulesQuery = query(
                    collection(db, "schedules"),
                    where("guru_ref", "==", teacherRef) 
                );
                const scheduleSnapshot = await getDocs(schedulesQuery);
                
                if (scheduleSnapshot.empty) {
                    setGroupedSchedules({}); 
                    setLoading(false);
                    return;
                }
                
                const scheduleDocs = scheduleSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleDoc));
                
                // 3. Optimasi: Ambil semua data KELAS & mapel sekaligus
                const mapelRefs = Array.from(new Set(scheduleDocs.map(s => s.mapel_ref).filter(ref => ref)));
                const kelasRefs = Array.from(new Set(scheduleDocs.map(s => s.kelas_ref).filter(ref => ref))); 

                const mapelDocs = mapelRefs.length > 0 ? await Promise.all(mapelRefs.map(ref => getDoc(ref))) : [];
                const kelasDocs = kelasRefs.length > 0 ? await Promise.all(kelasRefs.map(ref => getDoc(ref))) : []; 

                // Buat Map untuk pencarian cepat
                const mapelMap = new Map(mapelDocs.map(d => [d.id, d.data()?.nama_mapel || "N/A"]));
                
                // --- INI BAGIAN YANG DIUBAH ---
                // Simpan objek { tingkat, nama } ke dalam map
                const kelasMap = new Map(kelasDocs.map(d => {
                    const data = d.data();
                    const info: KelasInfo = {
                        tingkat: data?.tingkat || "", // Ambil field 'tingkat'
                        nama: data?.nama_kelas || "N/A" // Ambil 'nama_kelas'
                    };
                    return [d.id, info]; // Simpan objek info ke Map
                }));
                // --- AKHIR DARI BAGIAN YANG DIUBAH ---
                
                // 4. Gabungkan semua data menjadi satu array yang rapi
                const combinedSchedules: CombinedSchedule[] = scheduleDocs.map(sch => {
                    const mapelNama = mapelMap.get(sch.mapel_ref?.id) || "Mapel?";
                    // Ambil objek info kelas dari map
                    const kelasInfo = kelasMap.get(sch.kelas_ref?.id) || null; // <-- Ambil objeknya
                    return {
                        id: sch.id,
                        hari: sch.hari,
                        jam_mulai: sch.jam_mulai,
                        jam_selesai: sch.jam_selesai,
                        mapelNama: mapelNama,
                        kelasInfo: kelasInfo, // <-- Simpan objek info kelas
                        mapelIcon: getSubjectIcon(mapelNama),
                    };
                });

                // 5. Kelompokkan jadwal berdasarkan Hari
                const grouped = HARI_URUT.reduce((acc, hari) => {
                    acc[hari] = combinedSchedules
                        .filter(s => s.hari === hari)
                        .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai)); 
                    return acc;
                }, {} as GroupedSchedules);

                setGroupedSchedules(grouped);

            } catch (err: any) {
                console.error("Error fetching teacher schedule:", err);
                setError(err.message || "Gagal memuat data jadwal."); 
                if (err.code === 'permission-denied') {
                    setError("Gagal memuat jadwal: Periksa aturan keamanan (Security Rules) Firestore Anda.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherSchedule(); 
    }, [user, authLoading]); 


    // Memoize jadwal untuk hari yang dipilih agar tidak render ulang sia-sia
    const schedulesForSelectedDay = useMemo(() => {
        return groupedSchedules[selectedDay] || [];
    }, [groupedSchedules, selectedDay]);

    // --- RENDER (SESUAI LAYOUT ANDA) ---
    return (
        <div className="p-4 flex gap-4 flex-col lg:flex-row bg-gray-50 min-h-screen font-sans">
            
            {/* LEFT (Kolom Jadwal) */}
            <div className="w-full lg:w-2/3">
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                    
                    {/* --- Header Bagian Jadwal --- */}
                    <div className="mb-4">
                        <h1 className="text-xl font-semibold text-gray-900">Jadwal Mengajar</h1> 
                        <p className="text-sm text-gray-600">
                            Nama Guru: <span className="font-medium text-blue-600">{teacherName}</span> 
                        </p>
                    </div>
                    
                    {/* --- Tab Navigasi Hari --- */}
                    <nav className="flex border-b border-gray-200 overflow-x-auto mb-4">
                        {HARI_URUT.map(hari => {
                            const isHariIni = getHariIni() === hari;
                            return (
                                <button
                                    key={hari}
                                    onClick={() => setSelectedDay(hari)}
                                    className={`
                                        py-3 px-4 sm:px-5 font-medium text-sm sm:text-base whitespace-nowrap transition-all duration-200
                                        ${selectedDay === hari 
                                            ? 'border-b-4 border-blue-600 text-blue-600' 
                                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-b-4 border-transparent'
                                        }
                                        ${isHariIni && selectedDay !== hari ? 'font-bold text-blue-700 bg-blue-50' : ''}
                                    `}
                                >
                                    {hari} {isHariIni && "(Hari Ini)"}
                                </button>
                            );
                        })}
                    </nav>

                    {/* --- Konten Jadwal (Kartu Pelajaran) --- */}
                    <div className="min-h-[300px] relative">
                        {error && <ErrorMessage message={error} />}
                        {!error && loading && <LoadingSpinner isFullScreen={false} />}
                        {!error && !loading && schedulesForSelectedDay.length === 0 && (
                            <NoScheduleMessage day={selectedDay} /> 
                        )}
                        {!error && !loading && schedulesForSelectedDay.length > 0 && (
                            <div className="space-y-4">
                                {schedulesForSelectedDay.map(schedule => (
                                    <ScheduleCard key={schedule.id} schedule={schedule} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT (Kolom Kalender & Pengumuman) */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <DynamicEventCalendar /> 
                <Announcements />
            </div>
        </div>
    );
};


// --- KOMPONEN PENDUKUNG ---

// Kartu untuk menampilkan satu mata pelajaran (VERSI GURU - DENGAN TINGKAT)
const ScheduleCard = ({ schedule }: { schedule: CombinedSchedule }) => {
    // Gabungkan tingkat dan nama kelas jika info kelas ada
    const displayKelasNama = schedule.kelasInfo 
        ? `${schedule.kelasInfo.tingkat || ''} ${schedule.kelasInfo.nama}`.trim() // Gabungkan dan hilangkan spasi ekstra
        : "Kelas?"; // Fallback jika kelasInfo null

    return (
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            <div className="flex">
                {/* Bagian Kiri: Waktu & Ikon Mapel */}
                <div className="w-24 sm:w-28 flex flex-col items-center justify-center bg-gray-50/50 p-4 border-r border-gray-200">
                    {schedule.mapelIcon}
                    <p className="text-lg sm:text-xl font-bold text-blue-600 mt-2">
                        {schedule.jam_mulai}
                    </p>
                    <p className="text-xs text-gray-500">s/d {schedule.jam_selesai}</p>
                </div>
                
                {/* Bagian Kanan: Info Mapel & KELAS (dengan Tingkat) */}
                <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">
                        {schedule.mapelNama}
                    </h3>
                    {/* --- INI BAGIAN YANG DIUBAH --- */}
                    <div className="flex items-center text-gray-600 mt-1">
                        <Users className="w-4 h-4 mr-2" /> 
                        <span className="text-sm sm:text-base">{displayKelasNama}</span> {/* <-- Tampilkan nama kelas yang sudah digabung */}
                    </div>
                    {/* --- AKHIR DARI BAGIAN YANG DIUBAH --- */}
                </div>
            </div>
        </div>
    );
};

// Komponen untuk Tampilan Loading
const LoadingSpinner = ({ isFullScreen = false }: { isFullScreen?: boolean }) => {
    const wrapperClass = isFullScreen
        ? "absolute inset-0 flex items-center justify-center bg-white/50"
        : "flex items-center justify-center h-60";

    return (
        <div className={wrapperClass}>
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
            <p className="ml-4 text-gray-600">Memuat jadwal...</p>
        </div>
    );
};

// Komponen untuk Tampilan Error
const ErrorMessage = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center h-60 bg-red-50 text-red-700 p-6 rounded-lg">
        <h3 className="text-lg font-semibold">Oops! Terjadi Kesalahan</h3>
        <p className="text-center mt-2">{message}</p>
    </div>
);

// Komponen untuk Tampilan Jika Tidak Ada Jadwal
const NoScheduleMessage = ({ day }: { day: string }) => (
    <div className="flex flex-col items-center justify-center h-60 text-gray-500 p-6">
        <CalendarDays className="w-16 h-16 text-gray-300" />
        <h3 className="text-xl font-semibold mt-4">Tidak Ada Jadwal</h3>
        <p className="text-center">Anda tidak memiliki jadwal mengajar untuk hari {day}.</p> 
    </div>
);

export default TeacherPage;