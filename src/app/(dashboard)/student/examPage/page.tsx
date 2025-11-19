"use client";

import React, { useState, useEffect, useCallback } from 'react';
// ... (imports tidak berubah) ...
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    DocumentData
} from 'firebase/firestore';
import { Loader2, ArrowRight, BookOpenCheck, History, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---
// (Tidak ada perubahan di sini)
interface StudentData {
    nama_lengkap: string;
    kelas_ref: DocumentReference;
}
interface ExamData {
    id: string;
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)" | "Esai Uraian" | "PG dan Esai";
    mapel_ref: DocumentReference;
    guru_ref: DocumentReference;
    tanggal_selesai: Timestamp;
    status: "Dipublikasi" | "Ditutup" | "Draft";
    mapelNama?: string;
    guruNama?: string;
}
interface SubmissionData {
    id: string;
    latihan_ref: DocumentReference;
    student_ref: DocumentReference;
    nilai_akhir?: number;
    nilai_esai?: number; // <-- Pastikan ini ada
    nilai_akhir_scaled?: number;
    status: string; 
    waktu_selesai: Timestamp;
}
type MergedExamData = ExamData & {
    submission?: SubmissionData;
    customStatus?: "Tersedia" | "Selesai" | "Terlewat" | "Ditutup";
};

// --- KOMPONEN UTAMA ---
const StudentExamPage = () => {
    // ... (Semua state dan fungsi fetch tidak berubah) ...
    const { user, loading: authLoading } = useAuth();
    const [todoExams, setTodoExams] = useState<MergedExamData[]>([]);
    const [completedExams, setCompletedExams] = useState<MergedExamData[]>([]);
    const [studentName, setStudentName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getRefName = async (ref: DocumentReference, fieldName: string) => {
        try {
            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                return docSnap.data()[fieldName] || "Data Tidak Ditemukan";
            }
        } catch (e) {
            console.warn(`Gagal mengambil ref: ${ref.path}`, e);
        }
        return "N/A";
    };

    const fetchExamData = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const studentRef = doc(db, "students", userUid);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) {
                throw new Error("Data siswa tidak ditemukan. Pastikan Anda login sebagai siswa.");
            }
            const studentData = studentSnap.data() as StudentData;
            const kelasRef = studentData.kelas_ref;
            setStudentName(studentData.nama_lengkap);

            const examsQuery = query(
                collection(db, "exams"),
                where("kelas_ref", "==", kelasRef),
                where("status", "in", ["Dipublikasi", "Ditutup"]) 
            );

            const submissionsQuery = query(
                collection(db, "students_answers"),
                where("student_ref", "==", studentRef)
            );

            const [examsSnapshot, submissionsSnapshot] = await Promise.all([
                getDocs(examsQuery),
                getDocs(submissionsQuery)
            ]);

            const submissionMap = new Map<string, SubmissionData>();
            submissionsSnapshot.forEach(subDoc => {
                const subData = subDoc.data() as Omit<SubmissionData, 'id'>;
                submissionMap.set(subData.latihan_ref.id, { ...subData, id: subDoc.id });
            });

            const now = new Date();
            const examPromises = examsSnapshot.docs.map(async (examDoc) => {
                const examData = { ...examDoc.data(), id: examDoc.id } as ExamData;
                const submission = submissionMap.get(examData.id);
                const deadline = examData.tanggal_selesai.toDate();

                let mergedData: MergedExamData = { ...examData };

    if (submission && submission.status === 'dikerjakan') {
          // KASUS 1: Benar-benar sudah selesai
          mergedData.submission = submission;
          mergedData.customStatus = "Selesai";
        
        } else if (submission && submission.status === 'sedang dikerjakan') {
          // KASUS 2: Ditinggal (Back/Refresh). Anggap sebagai "Tersedia"
          // agar bisa dilanjutkan (logic resume di halaman start akan bekerja)
          mergedData.submission = submission; // Bawa data submission
          
          if (examData.status === "Dipublikasi" && now < deadline) {
            mergedData.customStatus = "Tersedia";
          } else {
            // Ditinggal DAN deadline-nya keburu habis
            mergedData.customStatus = "Terlewat"; 
          }

        } else {
          // KASUS 3: Belum pernah disentuh SAMA SEKALI
          mergedData.submission = undefined; // Pastikan tidak ada data submission
          
          if (examData.status === "Dipublikasi" && now < deadline) {
            mergedData.customStatus = "Tersedia";
          } else if (examData.status === "Dipublikasi" && now >= deadline) {
            mergedData.customStatus = "Terlewat";
          } else if (examData.status === "Ditutup") {
            mergedData.customStatus = "Ditutup";
          }
        }

                const [mapelNama, guruNama] = await Promise.all([
                    getRefName(examData.mapel_ref, 'nama_mapel'),
                    getRefName(examData.guru_ref, 'nama_lengkap') // <-- Sesuaikan field
                ]);
                mergedData.mapelNama = mapelNama;
                mergedData.guruNama = guruNama;

                return mergedData;
            });

            const allMergedExams = await Promise.all(examPromises);

            const todoList: MergedExamData[] = [];
            const completedList: MergedExamData[] = [];

            allMergedExams.forEach(exam => {
                if (exam.customStatus === "Tersedia") {
                    todoList.push(exam);
                } else if (exam.customStatus) { 
                    completedList.push(exam);
                }
            });
            
            todoList.sort((a, b) => b.tanggal_selesai.toMillis() - a.tanggal_selesai.toMillis());
            completedList.sort((a, b) => b.tanggal_selesai.toMillis() - a.tanggal_selesai.toMillis());

            setTodoExams(todoList);
            setCompletedExams(completedList);

        } catch (err: any) {
            console.error("Error fetching student exam data:", err);
            if (err.code === 'failed-precondition') {
                const errorMsg = "Query gagal: Diperlukan Indeks Firestore. Silakan cek konsol developer (F12) untuk melihat link pembuatan indeks dari Firebase.";
                setError(errorMsg);
                toast.error("Error: Indeks Firestore tidak ada.");
            } else {
                 setError(err.message || "Gagal memuat data Ujian.");
                 toast.error(err.message || "Gagal memuat data Ujian.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchExamData(user.uid);
        }
        if (!user && !authLoading) {
             setLoading(false);
             setError("Harap login sebagai siswa untuk melihat halaman ini.");
        }
    }, [user, authLoading, fetchExamData, ]);

    // --- RENDER ---
    // (Render utama tidak berubah)
    if (loading || authLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data Ujian...</span>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            
            <h1 className="text-2xl font-bold text-gray-800">Ujian</h1>
            <p className="text-base text-gray-600 mt-1">
                Selamat datang, <span className="font-semibold text-blue-600">{studentName || 'Siswa'}!</span>
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            <section className="mt-6"> 
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-3 mb-4">
                    <BookOpenCheck className="w-6 h-6 text-blue-600" /> 
                    Ujian Tersedia
                </h2>
                <div className="space-y-4">
                    {todoExams.length === 0 && !error && (
                        <div className="text-center text-gray-500 py-8 bg-white rounded-xl shadow-sm border border-gray-100">
                            <CheckCircle className="w-10 h-10 mx-auto text-green-500" /> 
                            <p className="mt-3 text-base font-medium">Hore! Tidak ada Ujian yang perlu dikerjakan.</p>
                            <p className="text-sm text-gray-500">Semua Ujian sudah selesai atau belum ada yang baru.</p>
                        </div>
                    )}
                    {todoExams.map(exam => (
                        <ExamCard key={exam.id} exam={exam} />
                    ))}
                </div>
            </section>

            <section className="mt-8"> 
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-3 mb-4">
                    <History className="w-6 h-6 text-gray-600" /> 
                    Riwayat Ujian
                </h2>
                <div className="space-y-4">
                    {completedExams.length === 0 && !error && (
                         <div className="text-center text-gray-500 py-8 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p className="text-base font-medium">Belum ada riwayat Ujian.</p>
                        </div>
                    )}
                    {completedExams.map(exam => (
                        <ExamCard key={exam.id} exam={exam} />
                    ))}
                </div>
            </section>
        </div>
    );
};

// --- KOMPONEN KARTU LATIHAN (PENDUKUNG) ---

const ExamCard = ({ exam }: { exam: MergedExamData }) => {
    
    const deadline = exam.tanggal_selesai.toDate().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let statusUI: React.ReactNode;
    let actionUI: React.ReactNode;

    switch (exam.customStatus) {
        case "Tersedia":
            statusUI = (
                <div className="text-sm text-gray-600">
                    Batas Akhir: <span className="font-semibold text-red-600">{deadline}</span>
                </div>
            );
            actionUI = (
                <Link 
                    href={`/student/examPage/start/${exam.id}`} 
                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all"
                >
                    {exam.submission ? 'Lanjutkan' : 'Mulai Kerjakan'} <ArrowRight className="w-4 h-4" />
                </Link>
            );
            break;
            
        case "Selesai":
            statusUI = (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-sm text-green-700 font-semibold bg-green-100 px-3 py-1 rounded-full">
                        Selesai Dikerjakan
                    </span>
                    {/* --- MODIFIKASI DISPLAY NILAI --- */}
                    <span className="text-base"> 
                        Nilai Akhir: 
                        
                        {/* KASUS 1: Tipe Campuran, utamakan Nilai Akhir Skala 100 */}
                        {exam.tipe === 'PG dan Esai' ? ( 
                             <span className="font-bold text-purple-600 ml-1">
                                {/* Gunakan nilai_akhir_scaled untuk skor final */}
                                {exam.submission?.nilai_akhir_scaled ?? 'Menunggu'} 
                            </span>
                        ) : exam.tipe === 'Pilihan Ganda' ? ( // KASUS 2: PG Murni
                            // Tampilkan nilai_akhir (skor PG)
                            <span className="font-bold text-blue-600 ml-1">
                                {exam.submission?.nilai_akhir ?? '-'}
                            </span>
                        ) : ( // KASUS 3: Esai Murni
                            // Tampilkan nilai_esai (skor Esai manual)
                            <span className="font-bold text-green-600 ml-1">
                                {exam.submission?.nilai_esai ?? 'Menunggu'}
                            </span>
                        )}
                    </span>
                </div>
            );
            actionUI = (
                 <Link 
                    href={`/student/examPage/result/${exam.submission?.id}`} 
                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold bg-white text-blue-600 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
                >
                    Lihat Hasil
                </Link>
            );
            break;

        case "Terlewat":
        case "Ditutup":
             statusUI = (
                <div className="flex items-center gap-2 text-sm text-red-700 font-semibold bg-red-100 px-3 py-1 rounded-full">
                    <XCircle className="w-4 h-4" />
                    {exam.customStatus}
                </div>
            );
            actionUI = (
                 <div className="py-2 px-4 text-sm font-semibold bg-gray-200 text-gray-500 rounded-lg cursor-not-allowed">
                    Ditutup
                </div>
            );
            break;

        default:
            statusUI = <div className="text-sm text-gray-500">Status tidak diketahui</div>;
            actionUI = null;
    }


    return (
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 transition-all hover:shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{exam.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1.5">
                        <span>{exam.mapelNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{exam.guruNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        {/* --- MODIFIKASI: Tampilkan Tipe Latihan --- */}
                        <span className="font-medium">{exam.tipe}</span>
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

export default StudentExamPage;

