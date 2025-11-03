"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// --- MODIFIKASI 1: Impor 'useParams' ---
import { useRouter, useParams } from 'next/navigation'; 
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import { type User as AuthUser } from 'firebase/auth';
// ... (sisa impor tidak berubah) ...
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
    ListFilter,
    ArrowLeft // <-- BARU: Impor ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- (Tipe GradeItem tidak berubah) ---
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

// --- (Helper getRefName tidak berubah) ---
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
const TeacherStudentGradesPage = () => { // <-- Ubah nama komponen
    // --- MODIFIKASI 2: Dapatkan ID siswa dari URL ---
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    const params = useParams(); // <-- BARU
    const router = useRouter(); // <-- BARU
    const studentId = params.studentId as string; // <-- BARU: Ambil ID siswa dari URL

    const [allGrades, setAllGrades] = useState<GradeItem[]>([]);
    const [studentName, setStudentName] = useState<string>("");
    
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

    // --- MODIFIKASI 3: Ubah 'userUid' menjadi 'studentId' ---
    const fetchAllGrades = useCallback(async (targetStudentId: string) => { // <-- Terima ID siswa
        setLoading(true);
        setError(null);
        
        try {
            // --- Gunakan 'targetStudentId' ---
            const studentRef = doc(db, "students", targetStudentId); 
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
                throw new Error("Data siswa tidak ditemukan.");
            }
            setStudentName(studentSnap.data()?.nama_lengkap || "Siswa");

            // (Sisa query di bawah ini sudah benar karena menggunakan 'studentRef')
            const answersQuery = query(
                collection(db, "student's_answer"),
                where("student_ref", "==", studentRef),
                where("status", "==", "dikerjakan") 
            );
            
            const hwQuery = query(
                collection(db, "homework_submissions"),
                where("student_ref", "==", studentRef)
            );

            // ... (sisa fungsi fetchAllGrades tidak berubah) ...
            const [answersSnapshot, hwSnapshot] = await Promise.all([
                getDocs(answersQuery),
                getDocs(hwQuery)
            ]);

            let allItems: GradeItem[] = [];

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

    // --- MODIFIKASI 4: Ubah cara pemanggilan useEffect ---
    useEffect(() => {
        // 'user' di sini adalah GURU. Kita cek apakah guru sudah login.
        // 'studentId' adalah ID siswa yang ingin dilihat nilainya.
        if (user?.uid && !authLoading && studentId) {
            fetchAllGrades(studentId); // Panggil fetch dengan ID siswa dari URL
        }
        if (!user && !authLoading) {
             setLoading(false);
             setError("Harap login sebagai guru untuk melihat halaman ini.");
        }
    }, [user, authLoading, studentId, fetchAllGrades]); // <-- Tambah studentId

    // (Memo filter tidak berubah)
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

    // (Komponen FilterButton tidak berubah)
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

    if (loading || authLoading) {
        // ... (render loading tidak berubah)
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat Rekap Nilai...</span>
            </div>
        );
    }

    // --- MODIFIKASI 5: Tambahkan tombol Kembali ---
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* --- TOMBOL KEMBALI --- */}
            <button 
                onClick={() => router.back()} // Kembali ke daftar siswa
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar Siswa
            </button>
            
            {/* --- Judul diubah --- */}
            <h1 className="text-2xl font-bold text-gray-800">Rekap Nilai Siswa</h1>
            <p className="text-base text-gray-600 mt-1">
                Menampilkan semua nilai untuk <span className="font-semibold text-blue-600">{studentName || 'Siswa'}</span>.
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}
            
            {/* --- Kontainer Filter dan Tabel (TIDAK BERUBAH) --- */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mt-6">
                
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <ListFilter className="w-5 h-5 text-gray-400" />
                    <FilterButton type="semua" label="Semua" />
                    <FilterButton type="latihan" label="Latihan (PG/Esai)" />
                    <FilterButton type="pr" label="Tugas Rumah" />
                </div>

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
                                        Siswa ini belum memiliki nilai yang cocok dengan filter.
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

// --- (Komponen GradeTableRow tidak berubah) ---
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

export default TeacherStudentGradesPage; // <-- Ubah nama komponen
