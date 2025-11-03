"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import { type User as AuthUser } from 'firebase/auth';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    orderBy
} from 'firebase/firestore';
import { 
    Loader2, 
    AlertTriangle, 
    Medal,
    Book,
    BookUp,
    ListChecks,
    FileText,
    ListFilter // <-- BARU
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

type GradeItem = {
    id: string; 
    judulTugas: string;
    tipe: "Latihan PG" | "Latihan Esai" | "Tugas Rumah";
    status: "Dinilai" | "Menunggu Penilaian";
    skor: number | null; 
    tanggal: Timestamp;
    mapelId: string;
    mapelNama: string;
};

// --- HAPUS Tipe SubjectGrades ---
// (Kita tidak perlu grouping lagi)

// Helper (tidak berubah)
const getRefName = async (ref: DocumentReference, fieldName: string): Promise<string> => {
    try {
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
            return docSnap.data()[fieldName] || "N/A";
        }
    } catch (e) { console.warn(`Gagal mengambil ref: ${ref.path}`, e); }
    return "N/A";
};

// --- KOMPONEN UTAMA ---
const StudentGradesPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    // --- MODIFIKASI: Ganti state groupedGrades menjadi allGrades ---
    const [allGrades, setAllGrades] = useState<GradeItem[]>([]);
    const [studentName, setStudentName] = useState<string>("");
    
    // --- BARU: State untuk filter ---
    type FilterType = "semua" | "latihan" | "pr";
    const [filterTipe, setFilterTipe] = useState<FilterType>("semua");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const mapelCache = React.useRef(new Map<string, string>());

    const getCachedMapelName = useCallback(async (mapelRef: DocumentReference) => {
        // ... (tidak berubah)
        const mapelId = mapelRef.id;
        let mapelNama = mapelCache.current.get(mapelId);
        if (!mapelNama) {
            mapelNama = await getRefName(mapelRef, 'nama_mapel');
            mapelCache.current.set(mapelId, mapelNama);
        }
        return { mapelId, mapelNama };
    }, []);

    // --- MODIFIKASI: Fungsi fetchAllGrades ---
    const fetchAllGrades = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const studentRef = doc(db, "students", userUid);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
                throw new Error("Data siswa tidak ditemukan.");
            }
            setStudentName(studentSnap.data()?.nama_lengkap || "Siswa");

            // --- 1. Ambil Nilai Latihan (student's_answer) ---
            const answersQuery = query(
                collection(db, "student's_answer"),
                where("student_ref", "==", studentRef),
                where("status", "==", "dikerjakan") 
            );
            
            // --- 2. Ambil Nilai Tugas (homework_submissions) ---
            const hwQuery = query(
                collection(db, "homework_submissions"),
                where("student_ref", "==", studentRef)
            );

            const [answersSnapshot, hwSnapshot] = await Promise.all([
                getDocs(answersQuery),
                getDocs(hwQuery)
            ]);

            let allItems: GradeItem[] = [];

            // --- Proses Nilai Latihan (logika tidak berubah) ---
            for (const subDoc of answersSnapshot.docs) {
                const data = subDoc.data();
                const latihanRef = data.latihan_ref as DocumentReference;
                
                const examSnap = await getDoc(latihanRef);
                if (!examSnap.exists()) continue;
                const examData = examSnap.data();
                if (!examData) continue;
                
                const { mapelId, mapelNama } = await getCachedMapelName(examData.mapel_ref);
                
                const tipe = examData.tipe === "Pilihan Ganda" ? "Latihan PG" : "Latihan Esai";
                let skor: number | null = null;
                let status: "Dinilai" | "Menunggu Penilaian"; 

                if (tipe === "Latihan PG") {
                    skor = data.nilai_akhir ?? 0;
                    status = "Dinilai";
                } else { // Esai
                    skor = data.nilai_esai ?? null;
                    status = (skor !== null) ? "Dinilai" : "Menunggu Penilaian";
                }

                allItems.push({
                    id: subDoc.id,
                    judulTugas: examData.judul || "Latihan",
                    tipe: tipe,
                    status: status,
                    skor: skor,
                    tanggal: data.waktu_selesai,
                    mapelId: mapelId,
                    mapelNama: mapelNama
                });
            }

            // --- Proses Nilai Tugas Rumah (logika tidak berubah) ---
            for (const subDoc of hwSnapshot.docs) {
                const data = subDoc.data();
                const hwRef = data.homework_ref as DocumentReference;
                
                const hwSnap = await getDoc(hwRef);
                if (!hwSnap.exists()) continue;
                const hwData = hwSnap.data();
                if (!hwData) continue;
                
                const { mapelId, mapelNama } = await getCachedMapelName(hwData.mapel_ref);
                
                const skor = data.nilai_tugas ?? null;

                allItems.push({
                    id: subDoc.id,
                    judulTugas: hwData.judul || "Tugas",
                    tipe: "Tugas Rumah",
                    status: (skor !== null) ? "Dinilai" : "Menunggu Penilaian",
                    skor: skor,
                    tanggal: data.tanggal_pengumpulan,
                    mapelId: mapelId,
                    mapelNama: mapelNama
                });
            }

            // --- 3. HAPUS Logika Grouping ---
            
            // --- 4. BARU: Simpan list datar (flat list) & urutkan ---
            allItems.sort((a, b) => b.tanggal.toMillis() - a.tanggal.toMillis());
            setAllGrades(allItems);

        } catch (err: any) {
            console.error("Error fetching grades:", err);
            let userMessage = "Gagal memuat data nilai. ";
            if (err.code === 'permission-denied') {
                userMessage += "Izin ditolak. Pastikan Security Rules Anda benar.";
            }
            setError(userMessage);
            toast.error(userMessage);
        } finally {
            setLoading(false);
        }
    }, [getCachedMapelName]);

    // Effect utama (tidak berubah)
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchAllGrades(user.uid);
        }
        if (!user && !authLoading) {
             setLoading(false);
             setError("Harap login sebagai siswa untuk melihat halaman ini.");
        }
    }, [user, authLoading, fetchAllGrades]);

    // --- BARU: Memo untuk memfilter daftar nilai ---
    const filteredGrades = useMemo(() => {
        if (filterTipe === "semua") {
            return allGrades;
        }
        if (filterTipe === "latihan") {
            return allGrades.filter(item => item.tipe === "Latihan PG" || item.tipe === "Latihan Esai");
        }
        if (filterTipe === "pr") {
            return allGrades.filter(item => item.tipe === "Tugas Rumah");
        }
        return allGrades;
    }, [allGrades, filterTipe]);

    // --- TAMPILAN (RENDER) ---
    if (loading || authLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat Rekap Nilai...</span>
            </div>
        );
    }

    // --- BARU: Komponen Tombol Filter ---
    const FilterButton = ({ type, label }: { type: FilterType, label: string }) => {
        const isActive = filterTipe === type;
        return (
            <button
                onClick={() => setFilterTipe(type)}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all text-sm font-medium
                    ${isActive 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-2xl font-bold text-gray-800">Rekap Nilai</h1>
            <p className="text-base text-gray-600 mt-1">
                Halo, <span className="font-semibold text-blue-600">{studentName || 'Siswa'}!</span> Ini adalah daftar semua nilai Anda.
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}
            
            {/* --- BARU: Kontainer Filter dan Tabel --- */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mt-6">
                
                {/* --- BARU: Tombol Filter --- */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <ListFilter className="w-5 h-5 text-gray-400" />
                    <FilterButton type="semua" label="Semua" />
                    <FilterButton type="latihan" label="Latihan (PG/Esai)" />
                    <FilterButton type="pr" label="Tugas Rumah" />
                </div>

                {/* --- BARU: Tabel --- */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tugas / Latihan
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Mata Pelajaran
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipe
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Skor
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredGrades.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        Tidak ada nilai yang cocok dengan filter ini.
                                    </td>
                                </tr>
                            )}
                            {filteredGrades.map(item => (
                                <GradeTableRow key={item.id} item={item} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- BARU: Komponen Baris Tabel ---
const GradeTableRow = ({ item }: { item: GradeItem }) => {
    
    const getIcon = () => {
        if (item.tipe === 'Latihan PG') return <ListChecks className="w-5 h-5 text-blue-500" />;
        if (item.tipe === 'Latihan Esai') return <FileText className="w-5 h-5 text-green-500" />;
        if (item.tipe === 'Tugas Rumah') return <BookUp className="w-5 h-5 text-purple-500" />;
        return <Medal className="w-5 h-5 text-gray-400" />;
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return "text-gray-400";
        if (score >= 80) return "text-green-600";
        if (score >= 65) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <tr className="hover:bg-gray-50">
            {/* Tugas */}
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                        {getIcon()}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{item.judulTugas}</div>
                        <div className="text-sm text-gray-500">
                            {item.tanggal.toDate().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            </td>
            {/* Mata Pelajaran */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {item.mapelNama}
            </td>
            {/* Tipe */}
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {item.tipe}
            </td>
            {/* Status */}
            <td className="px-6 py-4 whitespace-nowrap">
                {item.status === "Dinilai" ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Dinilai
                    </span>
                ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Menunggu Penilaian
                    </span>
                )}
            </td>
            {/* Skor */}
            <td className="px-6 py-4 whitespace-nowrap">
                {item.status === "Dinilai" ? (
                    <span className={`text-xl font-bold ${getScoreColor(item.skor)}`}>
                        {item.skor ?? 0}
                    </span>
                ) : (
                    <span className="text-sm font-medium text-gray-400">N/A</span>
                )}
            </td>
        </tr>
    );
};

// --- HAPUS KOMPONEN GradeItemRow LAMA ---

export default StudentGradesPage;

