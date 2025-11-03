"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    BookUp, 
    AlertTriangle, 
    CheckCircle, 
    XCircle,
    ArrowRight,
    History,
    Clock,
    BookOpenCheck
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

interface StudentData {
    nama_lengkap: string;
    kelas_ref: DocumentReference;
}

interface HomeworkData {
    id: string;
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)";
    mapel_ref: DocumentReference;
    guru_ref: DocumentReference;
    tanggal_selesai: Timestamp;
    status: "Dipublikasi" | "Ditutup" | "Draft";
    // Data tambahan
    mapelNama?: string;
    guruNama?: string;
}

interface SubmissionData {
    id: string;
    latihan_ref: DocumentReference;
    homework_ref: DocumentReference;
    nilai_tugas?: number;
    status_pengumpulan: string; 
}

// Tipe data gabungan untuk UI
type MergedHomeworkData = HomeworkData & {
    submission?: SubmissionData;
    customStatus?: "Tersedia" | "Selesai" | "Terlewat" | "Ditutup";
};

// Helper
const getRefName = async (ref: DocumentReference, fieldName: string) => {
    try {
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
            return docSnap.data()[fieldName] || "N/A";
        }
    } catch (e) { console.warn(`Gagal mengambil ref: ${ref.path}`, e); }
    return "N/A";
};


// --- KOMPONEN UTAMA ---
const StudentHomeworkPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    const [todoHomework, setTodoHomework] = useState<MergedHomeworkData[]>([]);
    const [completedHomework, setCompletedHomework] = useState<MergedHomeworkData[]>([]);
    const [studentName, setStudentName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fungsi utama untuk mengambil semua data
    const fetchHomeworkData = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        
        try {
            // 1. Dapatkan data siswa dan kelasnya
            const studentRef = doc(db, "students", userUid);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
                throw new Error("Data siswa tidak ditemukan.");
            }
            const studentData = studentSnap.data() as StudentData;
            const kelasRef = studentData.kelas_ref;
            setStudentName(studentData.nama_lengkap);

            // 2. Query PR untuk kelas siswa
            const hwQuery = query(
                collection(db, "homework"),
                where("kelas_ref", "==", kelasRef),
                where("status", "==", "Dipublikasi")
            );

            // 3. Query semua pengumpulan PR oleh siswa ini
            const submissionsQuery = query(
                collection(db, "homework_submissions"),
                where("student_ref", "==", studentRef)
            );

            const [hwSnapshot, submissionsSnapshot] = await Promise.all([
                getDocs(hwQuery),
                getDocs(submissionsQuery)
            ]);

            // 4. Proses Jawaban (Submissions) ke dalam Map agar mudah dicari
            const submissionMap = new Map<string, SubmissionData>();
            submissionsSnapshot.docs.forEach(subDoc => {
                const subData = subDoc.data() as Omit<SubmissionData, 'id'>;
                submissionMap.set(subData.homework_ref.id, { ...subData, id: subDoc.id });
            });

            // 5. Proses PR dan gabungkan
            const now = new Date();
            const hwPromises = hwSnapshot.docs.map(async (hwDoc) => {
                const hwData = { ...hwDoc.data(), id: hwDoc.id } as HomeworkData;
                const submission = submissionMap.get(hwData.id);
                const deadline = hwData.tanggal_selesai.toDate();

                let mergedData: MergedHomeworkData = { ...hwData };

                if (submission) {
                    mergedData.submission = submission;
                    mergedData.customStatus = "Selesai";
                } else {
                    if (now < deadline) {
                        mergedData.customStatus = "Tersedia";
                    } else {
                        mergedData.customStatus = "Terlewat";
                    }
                }

                const [mapelNama, guruNama] = await Promise.all([
                    getRefName(hwData.mapel_ref, 'nama_mapel'),
                    getRefName(hwData.guru_ref, 'nama_lengkap')
                ]);
                mergedData.mapelNama = mapelNama;
                mergedData.guruNama = guruNama;

                return mergedData;
            });

            const allMergedHomeworks = await Promise.all(hwPromises);

            // 6. Pisahkan ke dua list
            const todoList: MergedHomeworkData[] = [];
            const completedList: MergedHomeworkData[] = [];

            allMergedHomeworks.forEach(hw => {
                if (hw.customStatus === "Tersedia") {
                    todoList.push(hw);
                } else if (hw.customStatus) { // (Selesai, Terlewat)
                    completedList.push(hw);
                }
            });
            
            setTodoHomework(todoList.sort((a, b) => a.tanggal_selesai.toMillis() - b.tanggal_selesai.toMillis())); // Deadline terdekat dulu
            setCompletedHomework(completedList.sort((a, b) => b.tanggal_selesai.toMillis() - a.tanggal_selesai.toMillis())); // Yang terbaru dulu

        } catch (err: any) {
            console.error("Error fetching homework data:", err);
            let userMessage = "Gagal memuat data PR. ";
            if (err.code === 'permission-denied') {
                userMessage += "Izin ditolak. Pastikan Security Rules Anda benar.";
            } else if (err.code === 'failed-precondition') {
                 userMessage += "Indeks Firestore diperlukan. Cek konsol (F12).";
            }
            setError(userMessage);
            toast.error(userMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect utama
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchHomeworkData(user.uid);
        }
        if (!user && !authLoading) {
             setLoading(false);
             setError("Harap login sebagai siswa untuk melihat halaman ini.");
        }
    }, [user, authLoading, fetchHomeworkData]);

    // --- TAMPILAN (RENDER) ---
    if (loading || authLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat pekerjaan rumah...</span>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-2xl font-bold text-gray-800">Pekerjaan Rumah</h1>
            <p className="text-base text-gray-600 mt-1">
                Selamat datang, <span className="font-semibold text-blue-600">{studentName || 'Siswa'}!</span>
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Bagian 1: PR Tersedia (To-Do) */}
            <section className="mt-6"> 
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-3 mb-4">
                    <BookOpenCheck className="w-6 h-6 text-blue-600" /> 
                    Tugas Tersedia
                </h2>
                <div className="space-y-4">
                    {todoHomework.length === 0 && !error && (
                        <div className="text-center text-gray-500 py-8 bg-white rounded-xl shadow-sm border border-gray-100">
                            <CheckCircle className="w-10 h-10 mx-auto text-green-500" /> 
                            <p className="mt-3 text-base font-medium">Tidak ada PR saat ini.</p>
                            <p className="text-sm text-gray-500">Semua PR sudah selesai dikerjakan.</p>
                        </div>
                    )}
                    {todoHomework.map(hw => (
                        <HomeworkCard key={hw.id} hw={hw} />
                    ))}
                </div>
            </section>

             {/* Bagian 2: Riwayat PR (Completed) */}
            <section className="mt-8"> 
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-3 mb-4">
                    <History className="w-6 h-6 text-gray-600" /> 
                    Riwayat Tugas
                </h2>
                <div className="space-y-4">
                    {completedHomework.length === 0 && !error && (
                         <div className="text-center text-gray-500 py-8 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p className="text-base font-medium">Belum ada riwayat tugas.</p>
                        </div>
                    )}
                    {completedHomework.map(hw => (
                        <HomeworkCard key={hw.id} hw={hw} />
                    ))}
                </div>
            </section>
        </div>
    );
};

// --- KOMPONEN KARTU PR (PENDUKUNG) ---
const HomeworkCard = ({ hw }: { hw: MergedHomeworkData }) => {
    
    const deadline = hw.tanggal_selesai.toDate().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let statusUI: React.ReactNode;
    let actionUI: React.ReactNode;
    const linkTo = `/student/homework/${hw.id}`;

    switch (hw.customStatus) {
        case "Tersedia":
            statusUI = (
                <div className="text-sm text-gray-600">
                    Batas Akhir: <span className="font-semibold text-red-600">{deadline}</span>
                </div>
            );
            actionUI = (
                <Link 
                    href={linkTo} 
                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all"
                >
                    Lihat & Kumpulkan <ArrowRight className="w-4 h-4" />
                </Link>
            );
            break;
            
        case "Selesai":
            statusUI = (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm text-green-700 font-semibold bg-green-100 px-3 py-1 rounded-full">
                        {hw.submission?.status_pengumpulan}
                    </span>
                    <span className="text-base"> 
                        Nilai: 
                        <span className="font-bold text-blue-600 ml-1">
                            {hw.submission?.nilai_tugas ?? 'Menunggu Penilaian'}
                        </span>
                    </span>
                </div>
            );
            actionUI = (
                 <Link 
                    href={linkTo} 
                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-white text-blue-600 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
                >
                    Lihat Penilaian
                </Link>
            );
            break;

        case "Terlewat":
             statusUI = (
                <div className="flex items-center gap-2 text-sm text-red-700 font-semibold bg-red-100 px-3 py-1 rounded-full">
                    <XCircle className="w-4 h-4" />
                    Batas Akhir Terlewat
                </div>
            );
            actionUI = (
                 <div className="py-2 px-4 text-sm font-semibold bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
                    Ditutup
                </div>
            );
            break;
    }

    return (
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 transition-all hover:shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{hw.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1.5">
                        <span>{hw.mapelNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{hw.guruNama}</span>
                    </div>
                </div>
                <div className="sm:hidden mt-3">
                    {statusUI}
                </div>
                <div className="flex-shrink-0 mt-4 sm:mt-0">
                    {actionUI}
                </div>
            </div>
            <div className="hidden sm:block border-t mt-4 pt-3">
                {statusUI}
            </div>
        </div>
    );
};

export default StudentHomeworkPage;
