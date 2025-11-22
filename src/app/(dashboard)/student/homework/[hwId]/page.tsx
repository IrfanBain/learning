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
    Download,
    FileText,
    CheckCircle,
    UploadCloud,
    X,
    Send,
    XCircle,
    Clock,
    PenTool // Ikon baru untuk teks
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---
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
    
    // Revisi: Bisa teks, bisa file, atau keduanya
    text_jawaban?: string; 
    file_jawaban?: UploadedFileInfo;

    komentar_siswa: string; // Catatan tambahan (opsional)
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

    // State Form
    const [textJawaban, setTextJawaban] = useState<string>(""); // <-- BARU: Jawaban Teks
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
            
            // 3. Cek kelas (Opsional: validasi kelas siswa)
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

    // --- HANDLER SUBMIT ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Validasi: Minimal isi teks ATAU upload file
        if (!textJawaban.trim() && !fileToUpload) {
            toast.error("Harap isi jawaban teks ATAU upload file.");
            return;
        }
        
        if (!homework || !student || !user) return;
        
        setIsUploading(true);
        const loadingToastId = toast.loading("Mengirim jawaban...");

        try {
            let fileData = null;

            // 2. Upload File (Jika Ada)
            if (fileToUpload) {
                toast.loading("Mengupload file...", { id: loadingToastId });
                
                const fileExtension = fileToUpload.name.split('.').pop();
                // Minta URL Upload
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

                // Upload ke R2
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

            // 3. Simpan ke Firestore
            const deadline = homework.tanggal_selesai.toDate();
            const statusPengumpulan = new Date() > deadline ? "Terlambat" : "Terkumpul";

            const submissionPayload = {
                homework_ref: doc(db, "homework", homework.id),
                student_ref: doc(db, "students", user.uid),
                kelas_ref: student.kelas_ref,
                status_pengumpulan: statusPengumpulan,
                tanggal_pengumpulan: serverTimestamp(),
                
                // Simpan data baru
                text_jawaban: textJawaban, 
                file_jawaban: fileData, // Bisa null jika cuma teks

                komentar_siswa: komentar,
                nilai_tugas: null,
                feedback_guru: null,
                tanggal_dinilai: null
            };
            
            await addDoc(collection(db, "homework_submissions"), submissionPayload);

            toast.success("Tugas berhasil dikumpulkan!", { id: loadingToastId });
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

    const isPastDeadline = homework.tanggal_selesai.toDate() < new Date();

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/student/homework')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar PR
            </button>

            {/* INFO TUGAS (Soal Guru) */}
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

            {/* --- AREA JAWABAN SISWA --- */}
            
            {submission ? (
                // --- TAMPILAN SUDAH MENGUMPULKAN ---
                <div className="bg-white p-6 rounded-xl shadow-md border border-green-100">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <div>
                            <h2 className="text-xl font-bold text-green-800">Tugas Terkirim</h2>
                            <p className="text-sm text-gray-500">
                                Dikumpulkan: {submission.tanggal_pengumpulan.toDate().toLocaleString('id-ID')}
                                {submission.status_pengumpulan === 'Terlambat' && <span className="ml-2 text-red-500 font-semibold">(Terlambat)</span>}
                            </p>
                        </div>
                    </div>

                    {/* Jawaban Teks */}
                    {submission.text_jawaban && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <PenTool className="w-4 h-4" /> Jawaban Teks Anda:
                            </h3>
                            <div className="p-4 bg-gray-50 rounded-lg border text-gray-800 whitespace-pre-wrap">
                                {submission.text_jawaban}
                            </div>
                        </div>
                    )}

                    {/* Jawaban File */}
                    {submission.file_jawaban && (
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
                        {submission.nilai_tugas !== null ? (
                            <div className="flex gap-6">
                                <div className="bg-white p-4 rounded-lg shadow-sm border text-center min-w-[100px]">
                                    <span className="block text-xs text-gray-500 uppercase tracking-wide">Nilai</span>
                                    <span className="text-3xl font-bold text-blue-600">{submission.nilai_tugas}</span>
                                </div>
                                <div className="flex-1">
                                    <span className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Umpan Balik</span>
                                    <p className="text-gray-700 italic">{submission.feedback_guru || "Tidak ada catatan."}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Menunggu penilaian...
                            </p>
                        )}
                    </div>
                </div>

            ) : (
                
                // --- FORM PENGUMPULAN TUGAS ---
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Send className="w-5 h-5 text-blue-600" />
                        Kumpulkan Jawaban
                    </h2>

                    {isPastDeadline ? (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center text-red-700">
                            <XCircle className="w-8 h-8 mx-auto mb-2" />
                            <p className="font-semibold">Maaf, batas waktu pengumpulan sudah habis.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* 1. Input Jawaban Teks */}
                            <div>
                                <label className="block font-medium text-gray-700 mb-2">
                                    Jawaban Teks (Ketik Langsung)
                                </label>
                                <textarea 
                                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px]"
                                    placeholder="Ketik jawaban Anda di sini..."
                                    value={textJawaban}
                                    onChange={e => setTextJawaban(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
                                <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-gray-500">DAN / ATAU</span></div>
                            </div>

                            {/* 2. Input File Upload */}
                            <div>
                                <label className="block font-medium text-gray-700 mb-2">
                                    Upload File (Foto / PDF / Word) - <span className="text-gray-500 font-normal">Opsional</span>
                                </label>
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
                                    disabled={isUploading || (!textJawaban.trim() && !fileToUpload)}
                                    className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all"
                                >
                                    {isUploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                                    Kirim Tugas
                                </button>
                                <p className="text-xs text-center text-gray-500 mt-3">
                                    Pastikan jawaban Anda sudah benar sebelum mengirim.
                                </p>
                            </div>

                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentHomeworkDetailPage;