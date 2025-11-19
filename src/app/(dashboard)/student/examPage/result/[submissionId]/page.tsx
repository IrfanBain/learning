"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    getDoc,
    Timestamp,
    DocumentReference
} from 'firebase/firestore';
// --- MODIFIKASI: Tambah ikon Clock ---
import { 
    Loader2, 
    ArrowLeft, 
    User, 
    Check, 
    X, 
    FileText, 
    AlertTriangle, 
    Medal, 
    MessageSquare,
    Clock as ClockIcon // <-- BARU
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

// Data dari koleksi 'exams'
interface ExamData {
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)" | "Esai Uraian" | "PG dan Esai";
}

// Data dari koleksi 'soal'
interface SoalData {
    id: string;
    urutan: number;
    pertanyaan: string;
    tipe_soal: "Pilihan Ganda" | "Esai" | "Esai Uraian" | "PG dan Esai";
    poin: number;
    opsi?: { [key: string]: string };
    kunci_jawaban?: string;
    rubrik_penilaian?: string;
    jumlah_input?: number;
}

// --- MODIFIKASI: Tipe SubmissionData ---
interface SubmissionData {
    jawaban: string[]; 
    student_ref: DocumentReference;
    latihan_ref: DocumentReference;
    nilai_akhir?: number; // Skor PG
    nilai_esai?: number;  // <-- TAMBAHKAN INI
    nilai_akhir_scaled?: number;
    waktu_selesai: Timestamp;
    status: string;
    skor_per_soal?: { [key: string]: number };
}

// Data dari koleksi 'students'
interface StudentData {
    nama_lengkap: string;
}

const ExamStudentResultPage = () => {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const submissionId = params.submissionId as string;

    const [exam, setExam] = useState<ExamData | null>(null);
    const [submission, setSubmission] = useState<SubmissionData | null>(null);
    const [studentName, setStudentName] = useState<string>("");
    const [soalList, setSoalList] = useState<SoalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Statistik untuk summary
    const [summary, setSummary] = useState({
        correct: 0,
        incorrect: 0,
        essays: 0,
        totalScore: 0,
        maxScore: 0
    });

    const fetchDetailData = useCallback(async (userUid: string) => {
        if (!submissionId) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Ambil data jawaban siswa (submission)
            // Data ini sekarang akan otomatis berisi 'nilai_esai' (baik null atau angka)
            const subRef = doc(db, "students_answers", submissionId as string);
            const subSnap = await getDoc(subRef);
            if (!subSnap.exists()) {
                throw new Error("Data jawaban siswa tidak ditemukan.");
            }
            const subData = subSnap.data() as SubmissionData;

            // --- CEK KEAMANAN SISI KLIEN ---
            if (subData.student_ref.id !== userUid) {
                throw new Error("Akses ditolak. Anda tidak diizinkan melihat hasil ini.");
            }
            setSubmission(subData);

            // 2. Ambil semua data lain secara paralel
            // (Tidak ada perubahan di sini)
            const studentPromise = getDoc(subData.student_ref);
            const examPromise = getDoc(subData.latihan_ref);
            const soalQuery = query(
                collection(subData.latihan_ref, "soal"),
                orderBy("urutan", "asc")
            );
            const soalPromise = getDocs(soalQuery);

            const [studentSnap, examSnap, soalSnap] = await Promise.all([
                studentPromise,
                examPromise,
                soalPromise
            ]);

            // 3. Set data Siswa
            if (studentSnap.exists()) {
                setStudentName(studentSnap.data()?.nama_lengkap || "Siswa");
            } else {
                setStudentName("Siswa (Telah Dihapus)");
            }

            // 4. Set data Ujian
            const examData = examSnap.data() as ExamData;
            if (examSnap.exists()) {
                setExam(examData);
            } else {
                throw new Error("Data Ujian tidak ditemukan.");
            }

            // 5. Set data Soal dan Hitung Statistik
            // (Logika ini tidak berubah, sudah benar)
            const soalData = soalSnap.docs.map(d => ({ ...d.data(), id: d.id } as SoalData));
            setSoalList(soalData);

            let correct = 0;
            let incorrect = 0;
            let essays = 0;
            let totalScore = 0;
            let maxScore = 0;

            soalData.forEach((soal, index) => {
                if (soal.tipe_soal === "Pilihan Ganda") {
                    maxScore += soal.poin;
                    if (soal.kunci_jawaban && subData.jawaban[index] === soal.kunci_jawaban) {
                        correct++;
                        totalScore += soal.poin;
                    } else {
                        incorrect++;
                    }
                } else {
                    essays++;
                }
            });
            setSummary({ correct, incorrect, essays, totalScore, maxScore });

        } catch (err: any) {
            console.error("Error fetching detail data:", err);
            setError(err.message || "Gagal memuat detail jawaban.");
            if (err.code === 'permission-denied') {
                setError("Izin ditolak. Gagal memuat data Ujian atau soal. Pastikan firestore.rules Anda sudah benar.");
                toast.error("Gagal memuat: Izin ditolak.");
            }
        } finally {
            setLoading(false);
        }
    }, [submissionId]); // Tambahkan user sbg dependensi

    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchDetailData(user.uid);
        }
        if (!user && !authLoading) {
            setLoading(false);
            setError("Harap login untuk melihat hasil.");
        }
    }, [user, authLoading, fetchDetailData]);

    if (loading || authLoading) {
        // ... (render loading tidak berubah)
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat hasil Anda...</span>
            </div>
        );
    }

    if (error) {
         // ... (render error tidak berubah)
         return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.push('/student/examPage')}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Daftar Ujian
                </button>
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            </div>
         )
    }

    if (!submission || !exam) {
        // ... (render data tidak lengkap tidak berubah)
        return <div className="p-8 text-center text-gray-500">Data hasil tidak ditemukan.</div>;
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/student/examPage')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar Ujian
            </button>

            {/* Header Info Siswa & Skor */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Hasil Ujian: {exam.judul}</h1>
                <div className="border-t mt-4 pt-4 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center gap-3">
                         <div className="flex-shrink-0 h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Siswa</p>
                            <p className="text-lg font-semibold text-gray-900">{studentName}</p>
                        </div>
                    </div>
                    
                    {/* --- MODIFIKASI: Tampilan Skor Kondisional --- */}
                    <div className="text-left sm:text-right">
                        {exam.tipe === 'Pilihan Ganda' && (
                            <>
                                <p className="text-md text-gray-500">Nilai Akhir (Pilihan Ganda)</p>
                                <p className="text-xl font-bold text-blue-600">{submission.nilai_akhir ?? '-'}</p>
                            </>
                        )}
                        {(exam.tipe === 'Esai' || exam.tipe === 'Esai Uraian') && (
                             <>
                                <p className="text-sm text-gray-500">Nilai Akhir (Esai/Uraian)</p>
                                {/* Cek apakah nilai_esai sudah diisi (bukan null/undefined) */}
                                {(submission.nilai_esai !== null && submission.nilai_esai !== undefined) ? (
                                    <p className="text-xl font-bold text-green-600">{submission.nilai_esai}</p>
                                ) : (
                                    <p className="text-md font-semibold text-yellow-600 mt-1">Menunggu Penilaian</p>
                                )}
                            </>
                        )}
                        {exam.tipe === 'PG dan Esai' && (
                            <>
                                <p className="text-sm text-gray-500">Nilai Akhir</p>
                                <p className="text-xl font-bold text-green-600">{submission.nilai_akhir_scaled ?? 'Menunggu Penilaian'}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* --- MODIFIKASI: Ringkasan Jawaban Kondisional --- */}
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm">
                    {exam.tipe === 'Pilihan Ganda' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-600 bg-green-100 p-1 rounded-full" />
                                <span className="font-medium">{summary.correct}</span> Benar
                            </div>
                            <div className="flex items-center gap-2">
                                <X className="w-5 h-5 text-red-600 bg-red-100 p-1 rounded-full" />
                                <span className="font-medium">{summary.incorrect}</span> Salah
                            </div>
                            <div className="flex items-center gap-2">
                                <Medal className="w-5 h-5 text-yellow-600 bg-yellow-100 p-1 rounded-full" />
                                Skor PG: <span className="font-medium">{summary.totalScore} / {summary.maxScore} Poin</span>
                            </div>
                        </>
                    )}
                    {(exam.tipe === 'Esai' || exam.tipe === 'Esai Uraian') && (
                        <>
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-600 bg-blue-100 p-1 rounded-full" />
                                <span className="font-medium">{summary.essays}</span> Soal Esai Telah Dikumpulkan
                            </div>
                            {(submission.nilai_esai === null || submission.nilai_esai === undefined) && (
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-5 h-5 text-yellow-600 bg-yellow-100 p-1 rounded-full" />
                                    <span className="font-semibold text-yellow-700">Menunggu penilaian guru</span>
                                </div>
                            )}
                        </>
                    )}
                    {exam.tipe === 'PG dan Esai' && (
                        <>
                             {/* 1. Total Soal PG (Max Count) */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                                <FileText className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-700">
                                    Total Soal PG: <span className="font-bold">{summary.correct + summary.incorrect}</span>
                                </span>
                            </div>

                             {/* 2. Total Soal Esai (Max Count) */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-200">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-blue-800">
                                    Total Soal Esai: <span className="font-bold">{summary.essays}</span>
                                </span>
                            </div>

                            {/* 3. Skor PG Diperoleh (Baru) */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-200">
                                <Medal className="w-4 h-4 text-green-600" />
                                <span className="font-medium text-green-800">
                                    Skor PG Diperoleh: <span className="font-bold">{summary.totalScore} Poin</span>
                                </span>
                            </div>
                            
                            {/* 4. Skor Esai Diperoleh (Baru) */}
                            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 rounded-full border border-yellow-200">
                                <MessageSquare className="w-4 h-4 text-yellow-600" />
                                <span className="font-medium text-yellow-800">
                                    Skor Esai Diperoleh: <span className="font-bold">{submission.nilai_esai ?? 0} Poin</span>
                                </span>
                            </div>

                             {/* 5. Status Penilaian (Menunggu) */}
                            {(submission.nilai_esai === null || submission.nilai_esai === undefined) && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 rounded-full">
                                    <ClockIcon className="w-4 h-4 text-yellow-700" />
                                    <span className="font-semibold text-yellow-700">Menunggu penilaian guru</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Daftar Soal & Jawaban */}
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Tinjauan Jawaban</h2>
            <div className="space-y-4">
                {soalList.map((soal, index) => {
                    const studentAnswer = submission.jawaban[index];
                    const correctAnswer = soal.kunci_jawaban;

                    return (
                        <div key={soal.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            {/* Header Soal (Logika tidak berubah) */}
                            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm
                                        ${soal.tipe_soal === 'Pilihan Ganda' ? (studentAnswer === correctAnswer ? 'bg-green-600' : 'bg-red-600') : 'bg-blue-600'}
                                    `}>
                                        {soal.urutan}
                                    </span>
                                    <span className="text-sm font-medium text-gray-600">
                                        {soal.tipe_soal === 'Pilihan Ganda' ? (
                                            `(Skor: ${studentAnswer === correctAnswer ? soal.poin : 0} / ${soal.poin})`
                                        ) : (
                                            `(Skor: ${submission.skor_per_soal?.[soal.id] ?? 0} / ${soal.poin})`
                                        )}
                                    </span>
                                </div>
                                {soal.tipe_soal === 'Pilihan Ganda' && studentAnswer === correctAnswer && (
                                    <span className="text-sm font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">Benar</span>
                                )}
                                {soal.tipe_soal === 'Pilihan Ganda' && studentAnswer !== correctAnswer && (
                                // --- BARU: Cek apakah jawabannya kosong ---
                                (studentAnswer === "" || studentAnswer === null || studentAnswer === undefined) ? (
                                    // Jika tidak dijawab
                                    <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Tidak menjawab</span>
                                ) : (
                                    // Jika dijawab tapi salah
                                <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Salah</span>
                                )
                                )}
                                {soal.tipe_soal === 'Esai' && (
                                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Esai</span>
                                )}
                                {soal.tipe_soal === 'Esai Uraian' && (
                                    <span className="text-sm font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">Esai Uraian</span>
                                )}
                            </div>
                            {/* Isi Pertanyaan (Tidak berubah) */}
                            <p className="text-gray-800 font-medium my-4 whitespace-pre-wrap">{soal.pertanyaan}</p>

                            {/* Render Jawaban (berbeda untuk PG dan Esai) */}
                            {soal.tipe_soal === 'Pilihan Ganda' && (
                                <RenderPilihanGanda 
                                    soal={soal} 
                                    studentAnswer={studentAnswer} 
                                    correctAnswer={correctAnswer} 
                                />
                            )}
                            {soal.tipe_soal === 'Esai' && (
                                <RenderEsai 
                                    soal={soal} 
                                    studentAnswer={studentAnswer} 
                                />
                            )}
                            {soal.tipe_soal === 'Esai Uraian' && (
                                <RenderEsaiUraian
                                    soal={soal}
                                    studentAnswer={studentAnswer}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

// --- KOMPONEN HELPER (TIDAK BERUBAH) ---

// Komponen helper untuk merender Pilihan Ganda
const RenderPilihanGanda = ({ soal, studentAnswer, correctAnswer }: {
    soal: SoalData,
    studentAnswer: string,
    correctAnswer?: string
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {soal.opsi && ['A', 'B', 'C', 'D'].map(key => {
                if (!soal.opsi?.[key]) return null;

                const isCorrect = correctAnswer === key;
                const isStudentAnswer = studentAnswer === key;
                
                let chipStyle = "bg-gray-100 text-gray-800"; // Default
                let icon = null;

                // Ini adalah jawaban yang BENAR
                if (isCorrect) {
                    chipStyle = "bg-green-100 text-green-800 border-green-300 border-2 font-semibold";
                    icon = <Check className="w-5 h-5 text-green-600 ml-auto" />;
                }
                
                // Ini adalah jawaban siswa, TAPI SALAH
                if (isStudentAnswer && !isCorrect) {
                    chipStyle = "bg-red-100 text-red-800 border-red-300 border-2";
                    icon = <X className="w-5 h-5 text-red-600 ml-auto" />;
                }

                return (
                    <div 
                        key={key} 
                        className={`flex items-center gap-3 p-3 rounded-md ${chipStyle} transition-all`}
                    >
                        <span className="font-bold">{key}.</span>
                        <span>{soal.opsi[key]}</span>
                        {icon}
                    </div>
                );
            })}
        </div>
    );
};

// Komponen helper untuk merender Jawaban Esai
const RenderEsai = ({ soal, studentAnswer }: {
    soal: SoalData,
    studentAnswer: string
}) => {
    return (
        <div className="space-y-4">
            {/* Jawaban Siswa */}
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md">
                <p className="font-semibold text-blue-800 mb-1">Jawaban Anda:</p>
                <p className="text-blue-900 whitespace-pre-wrap text-sm">
                    {studentAnswer || <span className="italic text-gray-500">-- Tidak dijawab --</span>}
                </p>
            </div>
            {/* Kunci Jawaban / Rubrik */}
            {/* {soal.rubrik_penilaian && (
                 <div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-md">
                    <p className="font-semibold text-gray-800 mb-1">Kunci Jawaban/Rubrik Guru:</p>
                    <p className="text-gray-900 whitespace-pre-wrap text-sm">
                        {soal.rubrik_penilaian}
                    </p>
                </div>
            )} */}
        </div>
    )
}

// --- BARU: Komponen helper untuk merender Jawaban Esai Uraian ---
const RenderEsaiUraian = ({ soal, studentAnswer }: {
soal: SoalData,
studentAnswer: string
}) => {
// 1. Tentukan jumlah input yang SEHARUSNYA ada
const jumlahInput = soal.jumlah_input || 1;

// 2. Parse jawaban JSON yang TERSIMPAN
let savedAnswers: string[] = [];
try {
const parsed = JSON.parse(studentAnswer);
if (Array.isArray(parsed)) {
savedAnswers = parsed;
 }
} catch (e) {
 // Biarkan 'savedAnswers' sebagai array kosong jika parse gagal (misal, "")
}

 // 3. Buat array TAMPILAN dengan panjang yang BENAR
const displayAnswers = Array.from({ length: jumlahInput }, (_, index) => {
 return savedAnswers[index] || ""; // Isi dengan jawaban atau string kosong
});

return (
<div className="space-y-4">
 {/* Jawaban Siswa (di-loop) */}
<div className="p-3 bg-purple-50 border-l-4 border-purple-400 rounded-r-md">
<p className="font-semibold text-purple-800 mb-2">Jawaban Anda:</p>
<div className="space-y-2">
{displayAnswers.map((answer, index) => (
<div key={index} className="flex items-start gap-3">
<span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-200 text-purple-700 font-semibold text-sm flex-shrink-0 pt-0.5">
{index + 1}
</span>
<p className="text-purple-900 whitespace-pre-wrap text-sm pt-0.5 w-full bg-white/50 p-2 rounded">
{answer || <span className="italic text-gray-500">-- Tidak dijawab --</span>}
</p>
 </div>
 ))}
</div>
 </div>

{/* Tampilkan Rubrik Guru (jika ada) */}
{/* {soal.rubrik_penilaian && (
<div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-md">
<p className="font-semibold text-gray-800 mb-1">Kunci Jawaban/Rubrik Guru:</p>
<p className="text-gray-900 whitespace-pre-wrap text-sm">
{soal.rubrik_penilaian}
</p>
</div>
)} */}
</div>
)
}

export default ExamStudentResultPage;

