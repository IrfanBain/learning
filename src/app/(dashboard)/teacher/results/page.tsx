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
    Users,
    ChevronRight,
    User as UserIcon,
    Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

// --- DEFINISI TIPE ---

// Tipe untuk dropdown kelas
interface KelasItem {
    id: string;
    nama: string;
    // (Opsional) tambahkan ref jika perlu
}

// Tipe untuk data siswa
interface StudentData {
    id: string;
    nama_lengkap: string;
    nisn?: string;
    foto?: string; // URL foto profil
}

// --- KOMPONEN UTAMA ---
const TeacherGradesPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    // State Data
    const [availableKelas, setAvailableKelas] = useState<KelasItem[]>([]);
    const [studentList, setStudentList] = useState<StudentData[]>([]);
    
    // State UI
    const [selectedKelasId, setSelectedKelasId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- 1. Ambil daftar kelas yang diajar guru ---
    // (Catatan: Ini asumsi. Jika guru tidak terikat ke 'classes', 
    // kita mungkin perlu mengambil semua kelas)
    const fetchTeacherClasses = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        try {
            // Asumsi: Kita ambil semua kelas yang ada
            // (Jika guru punya 'kelas_ref' di datanya, query-nya bisa lebih spesifik)
            const kelasQuery = query(collection(db, "classes"), orderBy("tingkat", "asc"));
            const kelasSnapshot = await getDocs(kelasQuery);
            
            const kelasData = kelasSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            
            setAvailableKelas(kelasData);
            
            // Jika hanya ada 1 kelas, langsung pilih
            if (kelasData.length === 1) {
                setSelectedKelasId(kelasData[0].id);
            }

        } catch (err: any) {
            console.error("Error fetching classes:", err);
            setError("Gagal memuat daftar kelas.");
            toast.error("Gagal memuat daftar kelas.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect untuk mengambil daftar kelas saat halaman dimuat
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchTeacherClasses(user.uid);
        }
    }, [user, authLoading, fetchTeacherClasses]);

    // --- 2. Ambil daftar siswa SETELAH kelas dipilih ---
    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedKelasId) {
                setStudentList([]);
                return; // Jangan fetch jika tidak ada kelas dipilih
            }
            
            setLoadingStudents(true);
            try {
                const kelasRef = doc(db, "classes", selectedKelasId);
                const studentsQuery = query(
                    collection(db, "students"),
                    where("kelas_ref", "==", kelasRef),
                    orderBy("nama_lengkap", "asc")
                );
                
                const studentsSnapshot = await getDocs(studentsQuery);
                const studentsData = studentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    nama_lengkap: doc.data().nama_lengkap || "Tanpa Nama",
                    nisn: doc.data().nisn || "",
                    foto: doc.data().fotoURL || null // Sesuaikan field 'fotoURL'
                }));
                
                setStudentList(studentsData);
                
            } catch (err: any) {
                console.error("Error fetching students:", err);
                toast.error("Gagal memuat daftar siswa.");
            } finally {
                setLoadingStudents(false);
            }
        };

        fetchStudents();
    }, [selectedKelasId]); // <-- Jalankan ulang setiap 'selectedKelasId' berubah


    // --- TAMPILAN (RENDER) ---
    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data kelas...</span>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-2xl font-bold text-gray-800">Buku Nilai (Guru)</h1>
            <p className="text-base text-gray-600 mt-1">
                Pilih kelas untuk melihat rekap nilai siswa.
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}
            
            {/* --- Kontainer Filter dan Daftar Siswa --- */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mt-6">
                
                {/* --- Filter Kelas --- */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2 text-gray-700">
                        <Users className="w-5 h-5" />
                        <label htmlFor="kelasSelect" className="text-base font-semibold">
                            Pilih Kelas:
                        </label>
                    </div>
                    <select
                        id="kelasSelect"
                        value={selectedKelasId}
                        onChange={(e) => setSelectedKelasId(e.target.value)}
                        className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                    >
                        <option value="">-- Tampilkan Siswa dari Kelas --</option>
                        {availableKelas.map(kelas => (
                            <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                        ))}
                    </select>
                </div>

                {/* --- Daftar Siswa --- */}
                {loadingStudents ? (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-500">Memuat siswa...</span>
                    </div>
                ) : studentList.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">
                        {selectedKelasId ? (
                            <>
                                <UserIcon className="w-12 h-12 mx-auto text-gray-300" />
                                <p className="mt-3 font-medium">Tidak ada siswa</p>
                                <p className="text-sm">Tidak ada siswa yang terdaftar di kelas ini.</p>
                            </>
                        ) : (
                            <>
                                <Search className="w-12 h-12 mx-auto text-gray-300" />
                                <p className="mt-3 font-medium">Silakan Pilih Kelas</p>
                                <p className="text-sm">Pilih kelas dari daftar di atas untuk melihat siswa.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {studentList.map(student => (
                            <Link 
                                key={student.id}
                                href={`/teacher/results/${student.id}`} // <-- Arahkan ke halaman detail
                                className="flex items-center justify-between py-4 px-2 rounded-lg hover:bg-gray-50 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <Image
                                        width={100}
                                        height={100} 
                                        src={student.foto || `/placeholder-avatar.png`} // Ganti dengan path default jika tidak ada foto
                                        alt="Foto Profil"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{student.nama_lengkap}</p>
                                        <p className="text-sm text-gray-500">NISN: {student.nisn || 'N/A'}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherGradesPage;
