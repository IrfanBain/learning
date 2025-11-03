"use client";

import React, { useState, useEffect, useCallback } from 'react';
// --- BARU: Impor 'useSearchParams' untuk membaca '?status=...' ---
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import {
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    updateDoc, // <-- Penting untuk menyimpan nilai
    serverTimestamp
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    AlertTriangle, 
    User,
    Download,
    FileText,
    CheckCircle,
    XCircle,
    Save
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

interface HomeworkData {
    judul: string;
    kelas_ref: DocumentReference;
    tanggal_selesai: Timestamp;
}

interface StudentData {
    id: string;
    nama_lengkap: string; 
    nisn: string;
}

interface SubmissionData {
    id: string; // ID dokumen submission
    student_ref: DocumentReference;
    status_pengumpulan: "Terkumpul" | "Terlambat";
    tanggal_pengumpulan: Timestamp;
    file_jawaban: {
        url: string;
        namaFile: string;
        path: string;
    };
    komentar_siswa: string;
    nilai_tugas: number | null;
    feedback_guru: string | null;
}

// --- KOMPONEN UTAMA ---

const GradeHomeworkPage = () => {
    const { user } = useAuth();
    const router = useRouter();
    
    // --- BARU: Mengambil parameter URL ---
    const params = useParams();
    const searchParams = useSearchParams(); // Untuk ?status=
    
    // hwId = ID Pekerjaan Rumah
    // id = ID Submission (jika status=submitted) ATAU ID Student (jika status=pending)
    const hwId = params.hwId as string;
    const id = params.id as string; 
    const status = searchParams.get('status'); // 'submitted' or 'pending'

    // State Data
    const [homework, setHomework] = useState<HomeworkData | null>(null);
    const [student, setStudent] = useState<StudentData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    
    // State UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // --- BARU: State Form Penilaian ---
    const [nilai, setNilai] = useState<string>(""); // Pakai string untuk input
    const [feedback, setFeedback] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // --- PENGAMBILAN DATA (FETCHING) ---
    const fetchGradeData = useCallback(async () => {
        if (!hwId || !id || !status || !user) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Ambil data PR (selalu diperlukan)
            const hwRef = doc(db, "homework", hwId);
            const hwSnap = await getDoc(hwRef);
            if (!hwSnap.exists()) throw new Error("Pekerjaan Rumah tidak ditemukan.");
            setHomework(hwSnap.data() as HomeworkData);

            if (status === 'submitted') {
                // --- KASUS 1: Siswa SUDAH mengumpulkan ---
                // 'id' adalah submissionId
                const subRef = doc(db, "homework_submissions", id);
                const subSnap = await getDoc(subRef);
                if (!subSnap.exists()) throw new Error("Data pengumpulan tidak ditemukan.");
                
                const subData = { ...subSnap.data(), id: subSnap.id } as SubmissionData;
                setSubmission(subData);
                
                // Ambil data siswa dari student_ref di dalam submission
                const studentSnap = await getDoc(subData.student_ref);
                if (!studentSnap.exists()) throw new Error("Data siswa tidak ditemukan.");
                setStudent({ ...studentSnap.data(), id: studentSnap.id } as StudentData);
                
                // Isi form dengan data yang sudah ada (jika sudah pernah dinilai)
                setNilai(subData.nilai_tugas?.toString() || "");
                setFeedback(subData.feedback_guru || "");

            } else if (status === 'pending') {
                // --- KASUS 2: Siswa BELUM mengumpulkan ---
                // 'id' adalah studentId
                const studentRef = doc(db, "students", id);
                const studentSnap = await getDoc(studentRef);
                if (!studentSnap.exists()) throw new Error("Data siswa tidak ditemukan.");
                setStudent({ ...studentSnap.data(), id: studentSnap.id } as StudentData);
                // Biarkan submission 'null'
            }

        } catch (err: any) {
            console.error("Error fetching grade data:", err);
            setError(err.message || "Gagal memuat data.");
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [hwId, id, status, user]);

    useEffect(() => {
        fetchGradeData();
    }, [fetchGradeData]);

    // --- BARU: Handler untuk Simpan Nilai ---
    const handleSaveGrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!submission) {
            toast.error("Tidak ada data pengumpulan untuk dinilai.");
            return;
        }
        
        setIsSaving(true);
        const loadingToastId = toast.loading("Menyimpan penilaian...");
        
        try {
            const nilaiAngka = parseInt(nilai, 10);
            if (isNaN(nilaiAngka) || nilaiAngka < 0 || nilaiAngka > 100) {
                throw new Error("Nilai harus berupa angka antara 0 dan 100.");
            }

            const subRef = doc(db, "homework_submissions", submission.id);
            await updateDoc(subRef, {
                nilai_tugas: nilaiAngka,
                feedback_guru: feedback,
                tanggal_dinilai: serverTimestamp()
            });

            toast.success("Penilaian berhasil disimpan!", { id: loadingToastId });
            // Refresh data di halaman
            fetchGradeData();

        } catch (err: any) {
            console.error("Error saving grade:", err);
            toast.error(err.message || "Gagal menyimpan nilai.", { id: loadingToastId });
        } finally {
            setIsSaving(false);
        }
    };


    // --- TAMPILAN (RENDER) ---

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data...</span>
            </div>
        );
    }

    if (error) {
         return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Rekap Pengumpulan
                </button>
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            </div>
         )
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Rekap Pengumpulan
            </button>

            {/* Info Header */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                    Periksa Pekerjaan Rumah
                </h1>
                <p className="text-lg text-gray-600 mt-1">{homework?.judul}</p>
                
                <div className="border-t mt-4 pt-4 flex items-center gap-4">
                    <div className="flex-shrink-0 h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Siswa</p>
                        <p className="text-lg font-semibold text-gray-900">{student?.nama_lengkap}</p>
                    </div>
                </div>
            </div>
            
            {/* Konten Utama */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Kolom Kiri: Status & File */}
                <div className="md:col-span-1 space-y-4">
                    <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">Status Pengumpulan</h2>
                        
                        {!submission && (
                            <div className="p-4 bg-red-50 border-l-4 border-red-400">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-6 h-6 text-red-600" />
                                    <p className="text-lg font-bold text-red-800">Belum Mengumpulkan</p>
                                </div>
                            </div>
                        )}
                        
                        {submission && (
                            <div className="space-y-3">
                                {submission.status_pengumpulan === 'Terkumpul' ? (
                                    <div className="p-3 bg-green-50 border-l-4 border-green-400">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-6 h-6 text-green-600" />
                                            <p className="text-lg font-bold text-green-800">Terkumpul</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-6 h-6 text-yellow-600" />
                                            <p className="text-lg font-bold text-yellow-800">Terlambat</p>
                                        </div>
                                    </div>
                                )}
                                <div className="text-sm text-gray-600">
                                    <p>
                                        <strong>Waktu Kumpul:</strong> {submission.tanggal_pengumpulan.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                                    </p>
                                    <p>
                                        <strong>Deadline:</strong> {homework?.tanggal_selesai.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {submission && (
                         <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-3">File Jawaban Siswa</h2>
                            <a 
                                href={submission.file_jawaban.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all"
                            >
                                <Download className="w-5 h-5" />
                                Download/Lihat File
                            </a>
                            <p className="text-xs text-gray-500 mt-2 truncate text-center" title={submission.file_jawaban.namaFile}>
                                {submission.file_jawaban.namaFile}
                            </p>
                        </div>
                    )}
                    
                    {submission?.komentar_siswa && (
                         <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">Komentar Siswa</h2>
                            <p className="text-sm text-gray-600 italic">{submission.komentar_siswa}</p>
                        </div>
                    )}
                </div>

                {/* Kolom Kanan: Form Penilaian */}
                <div className="md:col-span-2">
                    <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Formulir Penilaian</h2>
                        
                        {!submission ? (
                            <p className="text-gray-500 text-center py-10">Siswa belum mengumpulkan tugas. Penilaian belum bisa dilakukan.</p>
                        ) : (
                            <form onSubmit={handleSaveGrade} className="space-y-4">
                                <div>
                                    <label htmlFor="nilai_tugas" className="block text-sm font-medium text-gray-700 mb-1">
                                        Nilai Tugas (Angka 0-100)
                                    </label>
                                    <input
                                        type="number"
                                        id="nilai_tugas"
                                        value={nilai}
                                        onChange={(e) => setNilai(e.target.value)}
                                        min={0}
                                        max={100}
                                        className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Contoh: 85"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="feedback_guru" className="block text-sm font-medium text-gray-700 mb-1">
                                        Feedback / Komentar Guru (Opsional)
                                    </label>
                                    <textarea
                                        id="feedback_guru"
                                        rows={6}
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Tuliskan feedback untuk siswa di sini..."
                                    ></textarea>
                                </div>
                                <div className="flex justify-end pt-3 border-t">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 py-2 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        {submission.nilai_tugas !== null ? 'Perbarui Penilaian' : 'Simpan Penilaian'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GradeHomeworkPage;
