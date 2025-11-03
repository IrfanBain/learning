"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    addDoc,
    serverTimestamp,
    Timestamp,
    DocumentReference,
    limit
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    AlertTriangle, 
    CheckCircle,
    Download,
    FileText,
    UploadCloud,
    X,
    Send,
    XCircle,
    Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---
// (Tipe data ini duplikat dari file sebelumnya,
//  idealnya Anda letakkan di file 'types.ts' terpisah)
interface HomeworkData {
    id: string;
    judul: string;
    deskripsi: string;
    status: "Draft" | "Dipublikasi";
    tanggal_dibuat: Timestamp;
    tanggal_selesai: Timestamp;
    guru_ref: DocumentReference;
    kelas_ref: DocumentReference;
    mapel_ref: DocumentReference;
    file_lampiran: UploadedFileInfo | null;
    mapelNama?: string;
    guruNama?: string;
}
interface UploadedFileInfo {
    url: string;      
    path: string;     
    namaFile: string; 
}
interface SubmissionData {
    id: string;
    homework_ref: DocumentReference;
    student_ref: DocumentReference;
    status_pengumpulan: "Terkumpul" | "Terlambat";
    tanggal_pengumpulan: Timestamp;
    file_jawaban: UploadedFileInfo;
    komentar_siswa: string;
    nilai_tugas: number | null;
    feedback_guru: string | null;
}
interface StudentData {
    id: string;
    nama_lengkap: string;
    kelas_ref: DocumentReference;
}

// Helper (Bisa ditaruh di file terpisah)
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
const StudentHomeworkDetailPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    const params = useParams();
    const router = useRouter();
    const hwId = params.hwId as string;

    // State Data
    const [homework, setHomework] = useState<HomeworkData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [student, setStudent] = useState<StudentData | null>(null);
    
    // State UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State Form
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [komentar, setKomentar] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);

    // --- PENGAMBILAN DATA (FETCHING) ---
    const fetchHomeworkDetail = useCallback(async (userUid: string) => {
        if (!hwId || !userUid) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Ambil data PR
            const hwRef = doc(db, "homework", hwId);
            const hwSnap = await getDoc(hwRef);
            if (!hwSnap.exists()) throw new Error("Tugas tidak ditemukan.");
            
            const hwData = { ...hwSnap.data(), id: hwSnap.id } as HomeworkData;
            
            // 2. Ambil data siswa
            const studentRef = doc(db, "students", userUid);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) throw new Error("Data siswa tidak ditemukan.");
            const studentData = { ...studentSnap.data(), id: studentSnap.id } as StudentData;
            setStudent(studentData);
            
            // 3. Cek apakah PR ini untuk kelas siswa
            if (hwData.kelas_ref.id !== studentData.kelas_ref.id) {
                throw new Error("Anda tidak terdaftar di kelas untuk tugas ini.");
            }

            // 4. Ambil data guru & mapel (untuk info)
            const [mapelNama, guruNama] = await Promise.all([
                getRefName(hwData.mapel_ref, 'nama_mapel'),
                getRefName(hwData.guru_ref, 'nama_lengkap')
            ]);
            setHomework({ ...hwData, mapelNama, guruNama });

            // 5. Cek apakah siswa sudah mengumpulkan
            const submissionQuery = query(
                collection(db, "homework_submissions"),
                where("homework_ref", "==", hwRef),
                where("student_ref", "==", studentRef),
                limit(1)
            );
            const submissionSnap = await getDocs(submissionQuery);
            if (!submissionSnap.empty) {
                setSubmission(submissionSnap.docs[0].data() as SubmissionData);
            }

        } catch (err: any) {
            console.error("Error fetching homework detail:", err);
            setError(err.message || "Gagal memuat data tugas.");
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [hwId]);

    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchHomeworkDetail(user.uid);
        }
        if (!user && !authLoading) {
            setLoading(false);
            setError("Harap login untuk melihat halaman ini.");
        }
    }, [user, authLoading, fetchHomeworkDetail]);

    // --- HANDLER UNTUK SUBMIT TUGAS ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileToUpload) {
            toast.error("Harap pilih file yang akan di-upload.");
            return;
        }
        if (!homework || !student || !user) {
            toast.error("Data tidak lengkap, gagal mengumpulkan.");
            return;
        }
        
        setIsUploading(true);
        const loadingToastId = toast.loading("Mengupload file jawaban...");

        try {
            // 1. Dapatkan Presigned URL dari API
            const fileExtension = fileToUpload.name.split('.').pop();
            const response = await fetch('/api/upload-url', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileToUpload.name,
                    contentType: fileToUpload.type,
                    fileExtension: fileExtension,
                    prefix: "homework_submissions" // <-- Folder Jawaban Siswa
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Gagal mendapatkan URL upload.");
            }
            
            const { uploadUrl, fileUrl, key, namaFile } = await response.json();

            // 2. Upload file ke R2 (Cloudflare)
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: fileToUpload,
                headers: { "Content-Type": fileToUpload.type }
            });

            if (!uploadResponse.ok) {
                throw new Error("Upload file ke R2 gagal.");
            }
            
            // 3. Cek status (Terlambat atau Tepat Waktu)
            const deadline = homework.tanggal_selesai.toDate();
            const statusPengumpulan = new Date() > deadline ? "Terlambat" : "Terkumpul";

            // 4. Simpan data submission ke Firestore
            const submissionData = {
                homework_ref: doc(db, "homework", homework.id),
                student_ref: doc(db, "students", user.uid),
                kelas_ref: student.kelas_ref,
                status_pengumpulan: statusPengumpulan,
                tanggal_pengumpulan: serverTimestamp(),
                file_jawaban: {
                    url: fileUrl,
                    path: key,
                    namaFile: namaFile
                },
                komentar_siswa: komentar,
                nilai_tugas: null,
                feedback_guru: null,
                tanggal_dinilai: null
            };
            
            await addDoc(collection(db, "homework_submissions"), submissionData);

            toast.success("Tugas berhasil dikumpulkan!", { id: loadingToastId });
            fetchHomeworkDetail(user.uid); // Refresh halaman

        } catch (err: any) {
            console.error("Error submitting homework:", err);
            toast.error(err.message || "Gagal mengumpulkan tugas.", { id: loadingToastId });
        } finally {
            setIsUploading(false);
        }
    };


    // --- TAMPILAN (RENDER) ---
    if (loading || authLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat detail tugas...</span>
            </div>
        );
    }

    if (error) {
         return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.push('/student/homework')}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Daftar PR
                </button>
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            </div>
         )
    }

    if (!homework) {
        return <div className="p-8 text-center text-gray-500">Data tugas tidak ditemukan.</div>;
    }

    // Cek jika sudah lewat deadline dan belum mengumpulkan
    const isPastDeadline = homework.tanggal_selesai.toDate() < new Date();

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/student/homework')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar PR
            </button>

            {/* Konten Utama */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                
                {/* Header Tugas */}
                <h1 className="text-2xl font-bold text-gray-800">{homework.judul}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-2 pb-4 border-b">
                    <span>{homework.mapelNama}</span>
                    <span className="text-gray-300">|</span>
                    <span>Oleh: {homework.guruNama}</span>
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-4 h-4 text-red-500" /> 
                        Deadline: {homework.tanggal_selesai.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                    </span>
                </div>
                
                {/* Instruksi & Lampiran Guru */}
                <div className="mt-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Instruksi Tugas</h2>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {homework.deskripsi}
                    </p>
                    
                    {homework.file_lampiran && (
                        <a 
                            href={homework.file_lampiran.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 py-2 px-4 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-all mt-4"
                        >
                            <Download className="w-5 h-5" />
                            Download Lampiran ({homework.file_lampiran.namaFile})
                        </a>
                    )}
                </div>
            </div>

            {/* --- BAGIAN PENGUMPULAN --- */}
            
            {/* KASUS 1: SUDAH MENGUMPULKAN (Tampilkan Hasil) */}
            {submission ? (
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Hasil Tugas Anda</h2>
                    
                    {/* Status */}
                    {submission.status_pengumpulan === "Terkumpul" ? (
                        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-md">
                            <p className="font-semibold text-green-800">Terkumpul pada:</p>
                            <p className="text-sm text-gray-700">{submission.tanggal_pengumpulan.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
                        </div>
                    ) : (
                         <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-md">
                            <p className="font-semibold text-yellow-800">Terlambat dikumpulkan pada:</p>
                            <p className="text-sm text-gray-700">{submission.tanggal_pengumpulan.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</p>
                        </div>
                    )}
                    
                    {/* File Jawaban */}
                    <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">File Jawaban Anda:</p>
                        <a 
                            href={submission.file_jawaban.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 py-2 px-4 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-all"
                        >
                            <FileText className="w-5 h-5" />
                            {submission.file_jawaban.namaFile}
                        </a>
                    </div>
                    
                    {/* Penilaian */}
                    <div className="border-t mt-6 pt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Penilaian dari Guru</h3>
                        {(submission.nilai_tugas === null && !submission.feedback_guru) ? (
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center text-gray-600">
                                <Clock className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                Tugas Anda sedang (atau akan) diperiksa oleh guru.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500">Nilai</p>
                                    <p className="text-4xl font-bold text-blue-600">{submission.nilai_tugas}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Feedback Guru</p>
                                    <p className="text-gray-700 whitespace-pre-wrap italic mt-1 p-3 bg-gray-50 rounded-md border">
                                        {submission.feedback_guru || "Tidak ada feedback."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                
            /* KASUS 2: BELUM MENGUMPULKAN (Tampilkan Form Upload) */
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Kumpulkan Jawaban Anda</h2>
                
                {/* Jika sudah lewat deadline, blokir upload */}
                {isPastDeadline ? (
                    <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-md text-center">
                        <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                        <p className="font-semibold text-red-800">Batas waktu pengumpulan telah berakhir.</p>
                        <p className="text-sm text-red-700">Anda tidak dapat mengumpulkan tugas ini lagi.</p>
                    </div>
                ) : (
                /* Jika masih ada waktu, tampilkan form */
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File Jawaban <span className="text-red-500">*</span></label>
                            
                            {isUploading && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Mengupload: {fileToUpload?.name}</span>
                                </div>
                            )}
                            
                            {!fileToUpload && !isUploading && (
                                <input
                                    type="file"
                                    id="file_jawaban"
                                    name="file_jawaban"
                                    onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                                    required
                                    className="w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-lg file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100 cursor-pointer"
                                />
                            )}
                            
                            {fileToUpload && !isUploading && (
                                <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-medium text-green-700 truncate">{fileToUpload.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFileToUpload(null);
                                            const fileInput = document.getElementById('file_jawaban') as HTMLInputElement;
                                            if (fileInput) fileInput.value = "";
                                        }}
                                        className="p-1 text-red-600 hover:text-red-800"
                                        title="Batal pilih file"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label htmlFor="komentar_siswa" className="block text-sm font-medium text-gray-700 mb-1">
                                Komentar (Opsional)
                            </label>
                            <textarea
                                id="komentar_siswa"
                                rows={3}
                                value={komentar}
                                onChange={(e) => setKomentar(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Tuliskan catatan singkat untuk guru di sini (jika ada)..."
                            ></textarea>
                        </div>
                        
                        <div className="flex justify-end pt-3 border-t">
                            <button
                                type="submit"
                                disabled={isUploading || !fileToUpload}
                                className="flex items-center justify-center gap-2 py-2 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50"
                            >
                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                Kumpulkan Tugas
                            </button>
                        </div>
                    </form>
                )}
            </div>
            )}
        </div>
    );
};

export default StudentHomeworkDetailPage;
