"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import {
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    updateDoc, 
    addDoc,
    collection,
    serverTimestamp
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    User, 
    Download, 
    FileText, 
    CheckCircle, 
    XCircle, 
    Save,
    AlertTriangle,
    MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

interface HomeworkData {
    deskripsi: string; // <-- TAMBAHKAN INI
    file_lampiran?: {  // <-- TAMBAHKAN INI (Opsional, siapa tahu ada file soal)
        url: string;
        nama: string; // atau 'namaFile' tergantung saat save
    } | null;
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
    id?: string;
    student_ref?: DocumentReference;
    status_pengumpulan?: string;
    tanggal_pengumpulan?: Timestamp;
    text_jawaban?: string;
    file_jawaban?: {
        url: string;
        namaFile: string;
        path: string;
    } | null;
    komentar_siswa?: string;
    nilai_tugas: number | null;
    feedback_guru: string | null;
}

// --- KOMPONEN UTAMA ---

const GradeHomeworkPage = () => {
    // 1. Ambil status loading dari Auth agar sinkron
    const { user, loading: authLoading } = useAuth(); 
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams(); 
    
    const hwId = params.hwId as string;
    const urlId = params.id as string;
    const status = searchParams.get('status');

    // State Data
    const [homework, setHomework] = useState<HomeworkData | null>(null);
    const [student, setStudent] = useState<StudentData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    
    // State UI (Default true)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // State Form
    const [nilai, setNilai] = useState<string>(""); 
    const [feedback, setFeedback] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // --- PENGAMBILAN DATA ---
    const fetchGradeData = useCallback(async () => {
        // Pastikan user sudah login dulu
        if (!user) return; 

        // Cek parameter wajib
        if (!hwId || !urlId || !status) {
            setError("Parameter URL tidak lengkap.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Ambil data PR
            const hwRef = doc(db, "homework", hwId);
            const hwSnap = await getDoc(hwRef);
            if (!hwSnap.exists()) throw new Error("Pekerjaan Rumah tidak ditemukan.");
            setHomework(hwSnap.data() as HomeworkData);

            if (status === 'submitted') {
                // --- KASUS 1: SUDAH MENGUMPULKAN ---
                const subRef = doc(db, "homework_submissions", urlId);
                const subSnap = await getDoc(subRef);
                
                if (!subSnap.exists()) {
                     throw new Error("Data pengumpulan tidak ditemukan.");
                }
                
                const subData = { ...subSnap.data(), id: subSnap.id } as SubmissionData;
                setSubmission(subData);
                
                // Ambil data siswa
                if (subData.student_ref) {
                    const studentSnap = await getDoc(subData.student_ref);
                    if (studentSnap.exists()) {
                        setStudent({ ...studentSnap.data(), id: studentSnap.id } as StudentData);
                    } else {
                        setStudent({ id: "unknown", nama_lengkap: "Siswa Terhapus", nisn: "-" });
                    }
                }
                
                setNilai(subData.nilai_tugas?.toString() || "");
                setFeedback(subData.feedback_guru || "");

            } else if (status === 'pending') {
                // --- KASUS 2: BELUM MENGUMPULKAN ---
                const studentRef = doc(db, "students", urlId);
                const studentSnap = await getDoc(studentRef);
                
                if (studentSnap.exists()) {
                    setStudent({ ...studentSnap.data(), id: studentSnap.id } as StudentData);
                } else {
                    throw new Error("Data siswa tidak ditemukan.");
                }
            }

        } catch (err: any) {
            console.error("Error fetching grade data:", err);
            setError(err.message || "Gagal memuat data.");
            toast.error(err.message);
        } finally {
            // PENTING: Matikan loading apapun yang terjadi
            setLoading(false);
        }
    }, [hwId, urlId, status, user]);

    // --- EFFECT UTAMA ---
    useEffect(() => {
        // Hanya fetch jika auth sudah selesai loading
        if (!authLoading) {
            if (user) {
                fetchGradeData();
            } else {
                // Jika tidak ada user, matikan loading & tampilkan error/redirect
                setLoading(false);
                // opsional: router.push('/login');
            }
        }
    }, [authLoading, user, fetchGradeData]);

    // --- HANDLER SIMPAN NILAI ---
    const handleSaveGrade = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setIsSaving(true);
        const loadingToastId = toast.loading("Menyimpan penilaian...");
        
        try {
            const nilaiAngka = parseInt(nilai, 10);
            if (isNaN(nilaiAngka) || nilaiAngka < 0 || nilaiAngka > 100) {
                throw new Error("Nilai harus berupa angka antara 0 dan 100.");
            }

            if (status === 'submitted' && submission?.id) {
                // UPDATE
                const subRef = doc(db, "homework_submissions", submission.id);
                await updateDoc(subRef, {
                    nilai_tugas: nilaiAngka,
                    feedback_guru: feedback,
                    tanggal_dinilai: serverTimestamp()
                });
                toast.success("Penilaian diperbarui!", { id: loadingToastId });

            } else if (status === 'pending' && student) {
                // CREATE NEW (MANUAL)
                const newSubmission = {
                    homework_ref: doc(db, "homework", hwId),
                    student_ref: doc(db, "students", student.id),
                    status_pengumpulan: "Dinilai Manual",
                    tanggal_pengumpulan: serverTimestamp(),
                    text_jawaban: "[Tidak Mengumpulkan - Dinilai Manual oleh Guru]",
                    file_jawaban: null,
                    komentar_siswa: "",
                    nilai_tugas: nilaiAngka,
                    feedback_guru: feedback,
                    tanggal_dinilai: serverTimestamp()
                };
                
                await addDoc(collection(db, "homework_submissions"), newSubmission);
                toast.success("Nilai manual disimpan!", { id: loadingToastId });
                router.back(); 
                return;
            }
            
            // Refresh data tanpa reload halaman
            fetchGradeData();

        } catch (err: any) {
            console.error("Error saving grade:", err);
            toast.error(err.message || "Gagal menyimpan nilai.", { id: loadingToastId });
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = submission ? (
        // Bandingkan nilai input dengan data di database
        nilai !== (submission.nilai_tugas?.toString() || "") ||
        feedback !== (submission.feedback_guru || "")
    ) : true;

    // --- RENDER ---
    if (loading || authLoading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;
    if (error) return <div className="p-6 text-center text-red-600 bg-red-50 m-6 rounded-lg">{error}</div>;

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Rekap
            </button>

            {/* Header Info */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Periksa Pekerjaan Rumah</h1>
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* KOLOM KIRI: JAWABAN SISWA */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-md border border-blue-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Soal / Instruksi
                        </h2>
                        
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {homework?.deskripsi || "Tidak ada deskripsi tertulis."}
                        </div>

                        {/* Tampilkan File Soal jika ada */}
                        {homework?.file_lampiran && (
                            <div className="mt-3">
                                <a 
                                    href={homework.file_lampiran.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    Lihat Lampiran Soal
                                </a>
                            </div>
                        )}
                    </div>
                    {/* 1. Status Pengumpulan */}
                    <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-3">Status Pengumpulan</h2>
                        
                        {!submission ? (
                             <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-md">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-6 h-6 text-red-600" />
                                    <p className="text-lg font-bold text-red-800">Belum Mengumpulkan</p>
                                </div>
                                <p className="text-sm text-red-700 mt-1">Siswa ini tidak mengirimkan jawaban.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {submission.status_pengumpulan === 'Terkumpul' && (
                                    <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded-r-md flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="font-bold text-green-800">Terkumpul Tepat Waktu</span>
                                    </div>
                                )}
                                {submission.status_pengumpulan === 'Terlambat' && (
                                    <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                        <span className="font-bold text-yellow-800">Terlambat</span>
                                    </div>
                                )}
                                {submission.status_pengumpulan === 'Dinilai Manual' && (
                                    <div className="p-3 bg-gray-100 border-l-4 border-gray-400 rounded-r-md flex items-center gap-2">
                                        <User className="w-5 h-5 text-gray-600" />
                                        <span className="font-bold text-gray-800">Dinilai Manual (Tanpa Jawaban)</span>
                                    </div>
                                )}

                                <div className="text-sm text-gray-600 pt-2">
                                    <p><strong>Dikumpulkan:</strong> {submission.tanggal_pengumpulan ? submission.tanggal_pengumpulan.toDate().toLocaleString() : '-'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Konten Jawaban */}
                    {submission && (
                        <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100 space-y-6">
                            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Jawaban Siswa</h2>
                            
                            {/* Teks */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Jawaban Teks
                                </h3>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap min-h-[80px]">
                                    {submission.text_jawaban || <span className="italic text-gray-400">Tidak ada jawaban teks.</span>}
                                </div>
                            </div>

                            {/* File */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Lampiran File
                                </h3>
                                {submission.file_jawaban ? (
                                    <a 
                                        href={submission.file_jawaban.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors group"
                                    >
                                        <div className="bg-white p-2 rounded-md border border-blue-100">
                                            <FileText className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-blue-700 group-hover:underline">
                                                {submission.file_jawaban.namaFile}
                                            </p>
                                            <p className="text-xs text-blue-500">Klik untuk lihat dan download</p>
                                        </div>
                                    </a>
                                ) : (
                                    <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 italic text-sm">
                                        Tidak ada file dilampirkan.
                                    </div>
                                )}
                            </div>

                            {/* Komentar */}
                            {submission.komentar_siswa && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                    <h3 className="text-xs font-bold text-yellow-700 uppercase mb-1 flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" /> Catatan Siswa
                                    </h3>
                                    <p className="text-sm text-gray-800 italic">{submission.komentar_siswa}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* KOLOM KANAN: FORM PENILAIAN */}
                <div className="md:col-span-1">
                    <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100 sticky top-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Formulir Penilaian
                        </h2>
                        
                        <form onSubmit={handleSaveGrade} className="space-y-4">
                            <div>
                                <label htmlFor="nilai_tugas" className="block text-sm font-medium text-gray-700 mb-1">
                                    Nilai (0-100)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        id="nilai_tugas"
                                        value={nilai}
                                        onChange={(e) => setNilai(e.target.value)}
                                        min={0}
                                        max={100}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-bold text-gray-800"
                                        placeholder="0"
                                        required
                                    />
                                    <span className="absolute right-4 top-2.5 text-gray-400 font-medium">/ 100</span>
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="feedback_guru" className="block text-sm font-medium text-gray-700 mb-1">
                                    Feedback / Komentar (Opsional)
                                </label>
                                <textarea
                                    id="feedback_guru"
                                    rows={6}
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    placeholder="Berikan masukan untuk siswa..."
                                ></textarea>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    // Disable jika: Sedang loading ATAU (Sudah ada submission DAN Tidak ada perubahan)
                                    disabled={isSaving || (submission !== null && !hasChanges)}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 font-semibold rounded-lg shadow-md transition-all ${
                                        (submission !== null && !hasChanges)
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' // Gaya saat disabled (Data sama)
                                            : 'bg-green-600 text-white hover:bg-green-700'   // Gaya aktif (Ada perubahan/Baru)
                                    }`}
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        // Ubah ikon: Jika sudah disimpan (tidak ada perubahan), tampilkan Check
                                        (!hasChanges && submission) ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />
                                    )}
                                    
                                    {/* Ubah Teks Tombol */}
                                    {isSaving 
                                        ? 'Menyimpan...' 
                                        : (submission && !hasChanges) 
                                            ? 'Tersimpan' 
                                            : (status === 'submitted' ? 'Simpan Perubahan' : 'Beri Nilai')
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GradeHomeworkPage;