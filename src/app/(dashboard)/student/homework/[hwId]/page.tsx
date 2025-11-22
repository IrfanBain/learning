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
    updateDoc, // <-- TAMBAHAN: Untuk update submission
    serverTimestamp,
    Timestamp,
    DocumentReference,
    limit
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    Download,
    FileText,
    CheckCircle,
    UploadCloud,
    X,
    User,
    Send,
    XCircle,
    Clock,
    PenTool,
    Edit2 // <-- TAMBAHAN: Ikon Edit
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---
interface HomeworkData {
    id: string;
    judul: string;
    deskripsi: string;
    status: "Draft" | "Dipublikasi" | "Ditutup";
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
    id: string; // <-- Pastikan ID ada
    homework_ref: DocumentReference;
    student_ref: DocumentReference;
    status_pengumpulan: "Terkumpul" | "Terlambat" | "Dinilai Manual";
    tanggal_pengumpulan: Timestamp;
    text_jawaban?: string; 
    file_jawaban?: UploadedFileInfo | null;
    komentar_siswa: string; 
    nilai_tugas: number | null;
    feedback_guru: string | null;
}
interface StudentData {
    id: string;
    nama_lengkap: string;
    kelas_ref: DocumentReference;
}

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
    const [isEditing, setIsEditing] = useState(false); // <-- BARU: Mode Edit

    // --- KONFIGURASI TOLERANSI ---
    const TOLERANSI_JAM = 24;

    // State Form
    const [textJawaban, setTextJawaban] = useState<string>(""); 
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [komentar, setKomentar] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    // State File Lama (untuk ditampilkan saat edit)
    const [existingFile, setExistingFile] = useState<UploadedFileInfo | null>(null); 

    // --- PENGAMBILAN DATA ---
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
            
            // 3. Cek kelas (Opsional)
            if (hwData.kelas_ref.id !== studentData.kelas_ref.id) {
                throw new Error("Anda tidak terdaftar di kelas untuk tugas ini.");
            }

            // 4. Ambil info tambahan
            const [mapelNama, guruNama] = await Promise.all([
                getRefName(hwData.mapel_ref, 'nama_mapel'),
                getRefName(hwData.guru_ref, 'nama_lengkap')
            ]);
            setHomework({ ...hwData, mapelNama, guruNama });

            // 5. Cek submission
            const submissionQuery = query(
                collection(db, "homework_submissions"),
                where("homework_ref", "==", hwRef),
                where("student_ref", "==", studentRef),
                limit(1)
            );
            const submissionSnap = await getDocs(submissionQuery);
            if (!submissionSnap.empty) {
                const subDoc = submissionSnap.docs[0];
                setSubmission({ ...subDoc.data(), id: subDoc.id } as SubmissionData);
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

    // --- HANDLER EDIT ---
    const handleStartEdit = () => {
        if (!submission) return;
        setIsEditing(true);
        setTextJawaban(submission.text_jawaban || "");
        setKomentar(submission.komentar_siswa || "");
        setExistingFile(submission.file_jawaban || null);
        setFileToUpload(null); // Reset file baru
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setTextJawaban("");
        setKomentar("");
        setFileToUpload(null);
        setExistingFile(null);
    };

    // --- HANDLER SUBMIT / UPDATE ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validasi: Minimal isi teks ATAU upload file (baru atau lama)
        const hasText = textJawaban.trim().length > 0;
        const hasNewFile = fileToUpload !== null;
        const hasOldFile = existingFile !== null;

        if (!hasText && !hasNewFile && !hasOldFile) {
            toast.error("Harap isi jawaban teks ATAU upload file.");
            return;
        }
        
        if (!homework || !student || !user) return;
        
        setIsUploading(true);
        const loadingToastId = toast.loading(isEditing ? "Menyimpan perubahan..." : "Mengirim jawaban...");

        try {
            let fileData = existingFile; // Default pakai file lama (jika edit)

            // A. Upload File Baru (Jika Ada)
            if (fileToUpload) {
                toast.loading("Mengupload file...", { id: loadingToastId });
                
                const fileExtension = fileToUpload.name.split('.').pop();
                const response = await fetch('/api/upload-url', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: fileToUpload.name,
                        contentType: fileToUpload.type,
                        fileExtension: fileExtension,
                        prefix: "homework_submissions"
                    })
                });

                if (!response.ok) throw new Error("Gagal mendapatkan URL upload.");
                const { uploadUrl, fileUrl, key, namaFile } = await response.json();

                const uploadResponse = await fetch(uploadUrl, {
                    method: "PUT",
                    body: fileToUpload,
                    headers: { "Content-Type": fileToUpload.type }
                });

                if (!uploadResponse.ok) throw new Error("Upload file gagal.");
                
                fileData = {
                    url: fileUrl,
                    path: key,
                    namaFile: namaFile
                };
            }
            // Jika user menghapus file lama di mode edit
            else if (isEditing && !existingFile) {
                fileData = null;
            }

            // B. Data Payload
            const deadline = homework.tanggal_selesai.toDate();
            const statusPengumpulan = new Date() > deadline ? "Terlambat" : "Terkumpul";

            const submissionPayload = {
                homework_ref: doc(db, "homework", homework.id),
                student_ref: doc(db, "students", user.uid),
                kelas_ref: student.kelas_ref,
                status_pengumpulan: statusPengumpulan,
                tanggal_pengumpulan: serverTimestamp(), // Update waktu pengumpulan
                
                text_jawaban: textJawaban, 
                file_jawaban: fileData, 

                komentar_siswa: komentar,
                // Jangan reset nilai/feedback jika edit, biarkan apa adanya (atau reset jika kebijakan sekolah mengharuskan)
                // Di sini kita asumsikan edit HANYA BOLEH jika nilai belum ada, jadi aman.
                nilai_tugas: null, 
                feedback_guru: null, 
                tanggal_dinilai: null
            };
            
            if (isEditing && submission?.id) {
                // UPDATE Submission
                const subRef = doc(db, "homework_submissions", submission.id);
                await updateDoc(subRef, submissionPayload);
                toast.success("Jawaban diperbarui!", { id: loadingToastId });
            } else {
                // CREATE Baru
                await addDoc(collection(db, "homework_submissions"), submissionPayload);
                toast.success("Tugas berhasil dikumpulkan!", { id: loadingToastId });
            }

            setIsEditing(false);
            fetchHomeworkDetail(user.uid); // Refresh

        } catch (err: any) {
            console.error("Error submitting:", err);
            toast.error(err.message || "Gagal mengirim jawaban.", { id: loadingToastId });
        } finally {
            setIsUploading(false);
        }
    };


    // --- RENDER ---
    if (loading || authLoading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;
    if (error) return <div className="p-6 text-center text-red-600">{error}</div>;
    if (!homework) return <div className="p-6 text-center text-gray-500">Data tidak ditemukan.</div>;

  // --- LOGIKA WAKTU & TOLERANSI ---
    const now = new Date();
    const deadlineDate = homework.tanggal_selesai.toDate();
    
    // Hitung waktu toleransi (Deadline + 24 Jam)
    const lockDate = new Date(deadlineDate.getTime() + (TOLERANSI_JAM * 60 * 60 * 1000));

    const isPastDeadline = now > deadlineDate; // Sudah lewat deadline (Status: Terlambat)
    const isLocked = now > lockDate;           // Sudah lewat toleransi (Status: Tidak bisa kirim)

    // Cek edit: Belum dinilai DAN Belum lewat toleransi (bukan deadline biasa)
    const canEdit = submission && submission.nilai_tugas === null && !isLocked;

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/student/homework')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar PR
            </button>

            {/* INFO TUGAS */}
             <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{homework.judul}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2 pb-4 border-b">
                    <span>{homework.mapelNama}</span>
                    <span>|</span>
                    <span>Oleh: {homework.guruNama}</span>
                    <span>|</span>
                    <span className={`flex items-center gap-1 font-medium ${isPastDeadline ? 'text-red-600' : 'text-yellow-600'}`}>
                        <Clock className='w-4 h-4 text-red-500' />
                        Deadline: {homework.tanggal_selesai.toDate().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                    </span>
                </div>
                
                <div className="mt-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Soal / Instruksi:</h2>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200">
                        {homework.deskripsi}
                    </p>
                    
                    {homework.file_lampiran && (
                        <a href={homework.file_lampiran.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:underline bg-blue-50 px-3 py-2 rounded-md border border-blue-100">
                            <Download className="w-4 h-4" />
                            Download Lampiran Soal
                        </a>
                    )}
                </div>
            </div>

            {/* --- AREA FORM / HASIL --- */}
            
            {/* --- LOGIKA TAMPILAN UTAMA --- */}
            
            {/* KONDISI 1: Tampilkan FORM jika: 
                (Belum ada submission ATAU Sedang Edit) 
                DAN (Status PR bukan Ditutup)
                DAN (Belum Terkunci secara waktu ATAU Sedang Edit) 
            */}
            {(!submission || isEditing) && homework.status !== 'Ditutup' && (!isLocked || isEditing) ? (
                
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Send className="w-5 h-5 text-blue-600" />
                            {isEditing ? "Edit Jawaban Anda" : "Kumpulkan Jawaban"}
                        </h2>
                        {isEditing && (
                            <button onClick={handleCancelEdit} className="text-sm text-red-500 hover:underline flex items-center gap-1">
                                <XCircle className="w-4 h-4"/> Batal Edit
                            </button>
                        )}
                    </div>

                    {/* Peringatan Soft Deadline (Masa Toleransi) */}
                    {isPastDeadline && !isEditing && (
                        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg flex items-start gap-3">
                            <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-yellow-800">Deadline Terlewat - Masa Toleransi</p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Batas waktu utama sudah habis. Anda masih diperbolehkan mengirim jawaban dalam waktu <strong>{TOLERANSI_JAM} jam</strong> kedepan setelah deadline.
                                    <br/> 
                                    Sisa waktu mu : <CountdownTimer targetDate={lockDate} /> lagi.
                                    <br/>
                                    Status pengumpulan akan tercatat sebagai <span className="font-bold underline">Terlambat</span>.
                                </p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* ... (ISI FORM TETAP SAMA SEPERTI SEBELUMNYA, TIDAK PERLU DIUBAH) ... */}
                        {/* ... Copas saja bagian input Textarea, Upload File, Komentar ... */}
                        
                        {/* 1. Input Jawaban Teks */}
                        <div>
                            <label className="block font-medium text-gray-700 mb-2">Jawaban Teks (Ketik Langsung)</label>
                            <textarea 
                                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px]"
                                placeholder="Ketik jawaban Anda di sini..."
                                value={textJawaban}
                                onChange={e => setTextJawaban(e.target.value)}
                            ></textarea>
                        </div>
                        
                        {/* ... (Lanjutkan dengan input file dan tombol submit seperti kode sebelumnya) ... */}
                        {/* Copy paste bagian Upload File dan Tombol Submit di sini */}
                         <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
                                <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-gray-500">DAN / ATAU</span></div>
                            </div>

                            {/* 2. Input File Upload */}
                            <div>
                                <label className="block font-medium text-gray-700 mb-2">
                                    Upload File (Foto / PDF / Word) - <span className="text-gray-500 font-normal">Opsional</span>
                                </label>
                                
                                {/* Jika ada file lama di mode edit */}
                                {existingFile && !fileToUpload && (
                                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <FileText className="w-4 h-4"/>
                                            <span className="text-sm font-medium">File Terpakai: {existingFile.namaFile}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setExistingFile(null)} // Hapus file lama
                                            className="text-xs text-red-500 hover:underline flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" /> Hapus file ini
                                        </button>
                                    </div>
                                )}

                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${fileToUpload ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                                    
                                    {!fileToUpload ? (
                                        <div className="relative cursor-pointer">
                                            <input 
                                                type="file" 
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={e => setFileToUpload(e.target.files ? e.target.files[0] : null)}
                                            />
                                            <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                                            <p className="text-gray-600 font-medium">Klik untuk pilih file</p>
                                            <p className="text-xs text-gray-400 mt-1">Maksimal 10MB</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg border"><FileText className="w-6 h-6 text-green-600"/></div>
                                                <div className="text-left">
                                                    <p className="font-semibold text-green-800 text-sm">{fileToUpload.name}</p>
                                                    <p className="text-xs text-green-600">{(fileToUpload.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setFileToUpload(null)}
                                                className="p-2 hover:bg-red-100 text-red-500 rounded-full transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Catatan Tambahan */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 border border-gray-300 rounded-lg"
                                    placeholder="Contoh: Maaf bu saya telat karena..."
                                    value={komentar}
                                    onChange={e => setKomentar(e.target.value)}
                                />
                            </div>

                            {/* Tombol Submit */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isUploading || (!textJawaban.trim() && !fileToUpload && !existingFile)}
                                    className={`w-full text-white font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transition-all ${
                                        isPastDeadline && !isEditing
                                        ? 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                    }`}
                                >
                                    {isUploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                                    {isEditing ? "Simpan Perubahan" : (isPastDeadline ? "Kirim (Terlambat)" : "Kirim Tugas")}
                                </button>
                            </div>
                    </form>
                </div>

            ) : (
                
                // --- AREA PESAN ERROR / TERKUNCI (Jika form tidak muncul dan belum ada submission) ---
                (!submission && (homework.status === 'Ditutup' || isLocked)) ? (
                     <div className="bg-white p-8 rounded-xl shadow-md border border-red-100 text-center">
                        <div className="inline-flex p-3 bg-red-50 rounded-full mb-4">
                            <XCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Akses Pengumpulan Ditutup</h2>
                        <p className="text-gray-600 mt-2 max-w-md mx-auto">
                            {homework.status === 'Ditutup' 
                                ? "Guru telah menutup akses pengumpulan untuk tugas ini secara manual." 
                                : `Batas waktu toleransi (${TOLERANSI_JAM} jam setelah deadline) telah habis.`
                            }
                        </p>
                        <p className="text-sm text-red-500 mt-4 font-medium">Anda tidak dapat mengirimkan jawaban lagi.</p>
                    </div>

                ) : (
                    
                    // --- AREA HASIL (Submission Ada) ---
                    // Ini akan muncul JIKA siswa sudah submit SENDIRI, 
                    // ATAU jika guru memberi nilai MANUAL (meskipun siswa telat/tidak kumpul)
                    <div className="bg-white p-6 rounded-xl shadow-md border border-green-100">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
                            <div className="flex items-center gap-3">
                                {/* Ikon Status */}
                                {submission?.status_pengumpulan === 'Dinilai Manual' ? (
                                     <User className="w-8 h-8 text-gray-600" />
                                ) : (
                                     <CheckCircle className="w-8 h-8 text-green-600" />
                                )}
                                
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {submission?.status_pengumpulan === 'Dinilai Manual' ? 'Hasil Penilaian Guru' : 'Tugas Terkirim'}
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {submission?.status_pengumpulan === 'Dinilai Manual' 
                                            ? 'Guru memberikan nilai secara manual.' 
                                            : `Dikumpulkan: ${submission?.tanggal_pengumpulan.toDate().toLocaleString('id-ID')}`
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* TOMBOL EDIT (Hanya jika belum dinilai & belum lewat Masa Toleransi) */}
                            {canEdit && (
                                <button 
                                    onClick={handleStartEdit}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Edit Jawaban
                                </button>
                            )}
                        </div>

                        {/* ... (Sisa kode tampilan Jawaban Teks, File, Nilai tetap sama) ... */}
                         {/* Jawaban Teks */}
                    {submission?.text_jawaban && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <PenTool className="w-4 h-4" /> Jawaban Teks:
                            </h3>
                            <div className="p-4 bg-gray-50 rounded-lg border text-gray-800 whitespace-pre-wrap">
                                {submission.text_jawaban}
                            </div>
                        </div>
                    )}

                    {/* Jawaban File */}
                    {submission?.file_jawaban && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> File Jawaban:
                            </h3>
                            <a 
                                href={submission.file_jawaban.url} 
                                target="_blank" 
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100"
                            >
                                <Download className="w-4 h-4" />
                                {submission.file_jawaban.namaFile}
                            </a>
                        </div>
                    )}

                    {/* Nilai & Feedback */}
                    <div className="mt-6 pt-6 border-t bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-xl">
                        <h3 className="font-bold text-gray-800 mb-3">Penilaian Guru</h3>
                        {submission?.nilai_tugas !== null ? (
                            <div className="flex gap-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border text-center min-w-[100px]">
                                    <span className="block text-xs text-gray-500 uppercase tracking-wide">Nilai</span>
                                    <span className="text-3xl font-bold text-blue-600">{submission?.nilai_tugas}</span>
                                </div>
                                <div className="flex-1">
                                    <span className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Umpan Balik</span>
                                    <p className="text-gray-700 italic">{submission?.feedback_guru || "Tidak ada catatan."}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Menunggu penilaian...
                            </p>
                        )}
                    </div>
                    </div>
                )
            )}
        </div>
    );
};

// --- KOMPONEN TIMER HITUNG MUNDUR ---
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const diff = targetDate.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Waktu Habis");
                return;
            }

            // Hitung jam, menit, detik
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            // Format string: "23j 59m 10d"
            setTimeLeft(`${hours}jam ${minutes}menit ${seconds}d`);
        };

        updateTimer(); // Jalan langsung saat mount
        const interval = setInterval(updateTimer, 1000); // Update tiap 1 detik

        return () => clearInterval(interval); // Bersihkan timer saat unmount
    }, [targetDate]);

    return <span className="font-mono font-bold tabular-nums">{timeLeft}</span>;
};

export default StudentHomeworkDetailPage;