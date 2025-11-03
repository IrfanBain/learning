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
    orderBy,
    QueryConstraint // <-- BARU
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

interface DropdownItem {
    id: string;
    nama: string;
}

interface StudentData {
    id: string;
    nama_lengkap: string;
    nisn?: string;
    foto?: string; 
}

// --- KOMPONEN UTAMA ---
const AdminGradesPage = () => {
    // Asumsi halaman ini sudah dilindungi oleh layout Admin
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    // State Data
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableGuru, setAvailableGuru] = useState<DropdownItem[]>([]);
    const [studentList, setStudentList] = useState<StudentData[]>([]);
    
    // State UI
    const [selectedKelasId, setSelectedKelasId] = useState<string>("all");
    const [selectedMapelId, setSelectedMapelId] = useState<string>("all");
    const [selectedGuruId, setSelectedGuruId] = useState<string>("all");

    const [loading, setLoading] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- 1. Ambil semua data filter (Kelas, Mapel, Guru) ---
    const fetchDropdownData = useCallback(async () => {
        setLoading(true);
        try {
            // Ambil Kelas
            const kelasQuery = query(collection(db, "classes"), orderBy("tingkat", "asc"));
            // Ambil Mapel
            const mapelQuery = query(collection(db, "subjects"), orderBy("nama_mapel", "asc"));
            // Ambil Guru
            const guruQuery = query(collection(db, "teachers"), orderBy("nama_lengkap", "asc"));

            const [kelasSnap, mapelSnap, guruSnap] = await Promise.all([
                getDocs(kelasQuery),
                getDocs(mapelQuery),
                getDocs(guruQuery)
            ]);
            
            const kelasData = kelasSnap.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            const mapelData = mapelSnap.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            const guruData = guruSnap.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_lengkap || "Tanpa Nama"
            }));
            
            setAvailableKelas(kelasData);
            setAvailableMapel(mapelData);
            setAvailableGuru(guruData);

        } catch (err: any) {
            console.error("Error fetching dropdowns:", err);
            setError("Gagal memuat data filter.");
            toast.error("Gagal memuat data filter.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    // --- 2. Ambil daftar siswa berdasarkan filter ---
    const fetchStudents = useCallback(async () => {
        // Jangan fetch jika tidak ada filter (kecuali "all")
        if (!selectedKelasId && !selectedMapelId && !selectedGuruId) {
            setStudentList([]);
            return; 
        }
        
        setLoadingStudents(true);
        try {
            // Logika filter yang kompleks:
            // 1. Filter Siswa berdasarkan Kelas (paling utama)
            // 2. Filter Latihan/Tugas berdasarkan Mapel & Guru
            // 3. Gabungkan hasilnya.
            // (Untuk SEMENTARA, kita filter berdasarkan KELAS saja agar cepat)
            // (Filter gabungan Mapel/Guru memerlukan query yang sangat kompleks)

            let studentsQuery;
            const queryConstraints: QueryConstraint[] = [];

            if (selectedKelasId !== "all") {
                queryConstraints.push(where("kelas_ref", "==", doc(db, "classes", selectedKelasId)));
            }
            // (Filter berdasarkan Guru/Mapel pada siswa itu sulit, 
            //  karena siswa tidak terikat langsung ke guru/mapel, tapi ke kelas)
            
            // Jika tidak ada filter kelas, jangan tampilkan apa-apa (terlalu banyak)
            if (queryConstraints.length === 0) {
                 setStudentList([]);
                 setLoadingStudents(false);
                 return;
            }
            
            queryConstraints.push(orderBy("nama_lengkap", "asc"));
            studentsQuery = query(collection(db, "students"), ...queryConstraints);

            const studentsSnapshot = await getDocs(studentsQuery);
            const studentsData = studentsSnapshot.docs.map(doc => ({
                id: doc.id,
                nama_lengkap: doc.data().nama_lengkap || "Tanpa Nama",
                nisn: doc.data().nisn || "",
                foto: doc.data().fotoURL || null 
            }));
            
            setStudentList(studentsData);
            
        } catch (err: any) {
            console.error("Error fetching students:", err);
            toast.error("Gagal memuat daftar siswa.");
        } finally {
            setLoadingStudents(false);
        }
    }, [selectedKelasId, selectedMapelId, selectedGuruId]);

    // --- TAMPILAN (RENDER) ---
    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data filter...</span>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-2xl font-bold text-gray-800">Buku Nilai (Admin)</h1>
            <p className="text-base text-gray-600 mt-1">
                Filter siswa berdasarkan kelas, mata pelajaran, atau guru.
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}
            
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mt-6">
                
                {/* --- Filter --- */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
                    {/* Filter Kelas */}
                    <div>
                        <label htmlFor="kelasSelect" className="block text-sm font-medium text-gray-700 mb-1">
                            Kelas
                        </label>
                        <select
                            id="kelasSelect"
                            value={selectedKelasId}
                            onChange={(e) => setSelectedKelasId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="all">Semua Kelas</option>
                            {availableKelas.map(kelas => (
                                <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                            ))}
                        </select>
                    </div>
                    {/* Filter Mapel (Saat ini tidak memfilter, tapi bisa ditambahkan) */}
                    <div>
                        <label htmlFor="mapelSelect" className="block text-sm font-medium text-gray-700 mb-1">
                            Mata Pelajaran (Filter PR/Latihan)
                        </label>
                        <select
                            id="mapelSelect"
                            value={selectedMapelId}
                            onChange={(e) => setSelectedMapelId(e.target.value)}
                            disabled // <-- Dinonaktifkan sementara
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50"
                        >
                            <option value="all">Semua Mapel</option>
                            {availableMapel.map(mapel => (
                                <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
                            ))}
                        </select>
                    </div>
                    {/* Filter Guru (Saat ini tidak memfilter, tapi bisa ditambahkan) */}
                     <div>
                        <label htmlFor="guruSelect" className="block text-sm font-medium text-gray-700 mb-1">
                            Guru (Filter PR/Latihan)
                        </label>
                        <select
                            id="guruSelect"
                            value={selectedGuruId}
                            onChange={(e) => setSelectedGuruId(e.target.value)}
                            disabled // <-- Dinonaktifkan sementara
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-50"
                        >
                            <option value="all">Semua Guru</option>
                            {availableGuru.map(guru => (
                                <option key={guru.id} value={guru.id}>{guru.nama}</option>
                            ))}
                        </select>
                    </div>
                    {/* Tombol Cari */}
                    <div className="self-end">
                        <button
                            onClick={fetchStudents}
                            disabled={loadingStudents || selectedKelasId === "all"}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loadingStudents ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            Cari Siswa
                        </button>
                    </div>
                </div>

                {/* --- Daftar Siswa --- */}
                {loadingStudents && (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-500">Memuat siswa...</span>
                    </div>
                )} 
                
                {!loadingStudents && studentList.length === 0 && (
                    <div className="text-center text-gray-500 py-10">
                        <Search className="w-12 h-12 mx-auto text-gray-300" />
                        <p className="mt-3 font-medium">Pilih Kelas</p>
                        <p className="text-sm">Silakan pilih kelas terlebih dahulu untuk menampilkan daftar siswa.</p>
                    </div>
                )}
                
                {!loadingStudents && studentList.length > 0 && (
                    <div className="divide-y divide-gray-100">
                        {studentList.map(student => (
                            <Link 
                                key={student.id}
                                // --- PENTING: Link ke halaman /teacher/nilai/... ---
                                // (Kita gunakan halaman yg sama dengan guru)
                                href={`/teacher/results/${student.id}`} 
                                target="_blank" // <-- Buka di tab baru
                                className="flex items-center justify-between py-4 px-2 rounded-lg hover:bg-gray-50 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <Image
                                        width={100}
                                        height={100} 
                                        src={student.foto || `/placeholder-avatar.png`} // Ganti dengan path default jika tidak ada foto`} 
                                        alt="Foto Profil"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{student.nama_lengkap}</p>
                                        <p className="text-sm text-gray-500">NISN: {student.nisn || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                                    Lihat Rapor
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminGradesPage;
