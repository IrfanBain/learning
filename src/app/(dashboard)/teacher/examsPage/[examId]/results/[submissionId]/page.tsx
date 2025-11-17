"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    DocumentReference,
    updateDoc // <-- BARU: Impor updateDoc
} from 'firebase/firestore';
// --- BARU: Impor ikon Save ---
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
    Save // <-- BARU
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

// Data dari koleksi 'exams'
interface ExamData {
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)" | "Esai Uraian";
}

// Data dari koleksi 'soal'
interface SoalData {
    id: string;
    urutan: number;
    pertanyaan: string;
    tipe_soal: "Pilihan Ganda" | "Esai" | "Esai Uraian";
    poin: number;
    opsi?: { [key: string]: string };
    kunci_jawaban?: string;
    rubrik_penilaian?: string;
    jumlah_input?: number;
}

// Data dari koleksi 'student's_answer'
interface SubmissionData {
    jawaban: string[]; 
    student_ref: DocumentReference;
    latihan_ref: DocumentReference;
    nilai_akhir?: number; // Skor PG
    nilai_esai?: number;  // <-- BARU: Skor Esai
    skor_per_soal?: number;
    waktu_selesai: Timestamp;
    status: string;
}

// Data dari koleksi 'students'
interface StudentData {
    nama_lengkap: string;
}

// --- BARU: Tipe untuk state skor esai ---
// (Menyimpan skor inputan guru per soal, misal: { "id-soal-1": 10, "id-soal-2": 5 })
type EssayScoresState = {
    [soalId: string]: number; 
};

const StudentResultPage = () => {
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

    // --- BARU: State untuk penilaian esai ---
    const [essayScores, setEssayScores] = useState<EssayScoresState>({});
    const [isSaving, setIsSaving] = useState(false);
    const [manualPgScore, setManualPgScore] = useState<number | string>("");

    // --- BARU: Memo untuk menghitung total skor esai saat ini ---
    const currentTotalEssayScore = useMemo(() => {
        return Object.values(essayScores).reduce((sum, score) => sum + (Number(score) || 0), 0);
    }, [essayScores]);

    // Statistik untuk summary (tidak berubah)
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
            const subRef = doc(db, "students_answers", submissionId);
            const subSnap = await getDoc(subRef);
            if (!subSnap.exists()) {
                throw new Error("Data jawaban siswa tidak ditemukan.");
            }
            const subData = subSnap.data() as SubmissionData;
            setSubmission(subData);

            // (Cek keamanan tidak perlu, sudah ditangani di rules)

            // 2. Ambil semua data lain secara paralel
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

            // 4. Set data Latihan
            const examData = examSnap.data() as ExamData;
            if (examSnap.exists()) {
                setExam(examData);
            } else {
                throw new Error("Data latihan tidak ditemukan.");
            }

            // 5. Set data Soal dan Hitung Statistik
            const soalData = soalSnap.docs.map(d => ({ ...d.data(), id: d.id } as SoalData));
            setSoalList(soalData);

            // --- Logika Perhitungan Statistik (Hanya untuk PG) ---
            if (examData.tipe === "Pilihan Ganda") {
                let correct = 0;
                let incorrect = 0;
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
                    }
                });
                setSummary({ correct, incorrect, essays: 0, totalScore, maxScore });
            } 
            // --- BARU: Inisialisasi state skor esai jika ada nilai esai sebelumnya ---
            else if (examData.tipe === "Esai" || examData.tipe === "Esai Uraian") {
                // Jika sudah pernah dinilai ('nilai_esai' tidak null), 
                // kita tidak bisa mengembalikan skor per-soal.
                // Kita akan menangani ini di UI.
                // Untuk sekarang, kita hanya perlu tahu total skor esai.
                // (Kita akan menangani inputan terpisah)
                setSummary({ correct: 0, incorrect: 0, essays: soalData.length, totalScore: 0, maxScore: 0 });
            }

        } catch (err: any) {
            console.error("Error fetching detail data:", err);
            setError(err.message || "Gagal memuat detail jawaban.");
            if (err.code === 'permission-denied') {
                setError("Izin ditolak. Gagal memuat data latihan atau soal. Pastikan firestore.rules Anda sudah benar.");
                toast.error("Gagal memuat: Izin ditolak.");
            }
        } finally {
            setLoading(false);
        }
    }, [submissionId]); // Hapus 'user' dari dependensi

    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchDetailData(user.uid);
        }
        if (!user && !authLoading) {
            setLoading(false);
            setError("Harap login untuk melihat hasil.");
        }
    }, [user, authLoading, fetchDetailData]);

    // --- BARU: Handler untuk input nilai esai ---
    const handleEssayScoreChange = (soalId: string, value: string, maxPoin: number) => {
        const score = parseInt(value, 10);
        // Validasi: tidak boleh negatif dan tidak boleh > poin maks
        if (score < 0) {
            setEssayScores(prev => ({ ...prev, [soalId]: 0 }));
        } else if (score > maxPoin) {
            setEssayScores(prev => ({ ...prev, [soalId]: maxPoin }));
        } else {
            setEssayScores(prev => ({ ...prev, [soalId]: score }));
        }
    };

    // --- BARU: Handler untuk simpan nilai esai ---
    const handleSaveEssayScores = async () => {
        if (!submission) return;
        
        // Validasi: Pastikan semua soal esai sudah diberi nilai
        const essayQuestionIds = soalList.filter(s => s.tipe_soal === 'Esai' || s.tipe_soal === 'Esai Uraian').map(s => s.id);
        const scoredQuestionIds = Object.keys(essayScores);
        
        if (essayQuestionIds.length !== scoredQuestionIds.length) {
            toast.error("Harap isi nilai untuk SEMUA soal esai sebelum menyimpan.");
            return;
        }

        setIsSaving(true);
        const loadingToastId = toast.loading("Menyimpan nilai esai...");

        try {
            const totalScore = currentTotalEssayScore; // Ambil dari state memo
            
            const subRef = doc(db, "students_answers", submissionId);
            await updateDoc(subRef, {
                nilai_esai: totalScore, // Simpan total skor esai
                skor_per_soal: essayScores
            });

            // Perbarui state submission secara lokal agar UI update
            setSubmission(prev => prev ? { ...prev, nilai_esai: totalScore } : null);
            
            toast.success("Nilai esai berhasil disimpan!", { id: loadingToastId });
            
        } catch (err: any) {
            console.error("Error saving essay score:", err);
            toast.error(err.message || "Gagal menyimpan nilai.", { id: loadingToastId });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManualPgScore = async () => {
    if (!submission || manualPgScore === "") return;
    
    const score = Number(manualPgScore);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error("Nilai harus berupa angka antara 0 dan 100.");
      return;
    }

    setIsSaving(true);
    const loadingToastId = toast.loading("Menyimpan nilai manual PG...");

    try {
      const subRef = doc(db, "students_answers", submissionId);
      await updateDoc(subRef, {
        nilai_akhir: score // Simpan skor manual ke nilai_akhir
      });

      // Perbarui state submission secara lokal agar UI update
      setSubmission(prev => prev ? { ...prev, nilai_akhir: score } : null);
      setManualPgScore(""); // Kosongkan input
      
      toast.success("Nilai manual PG berhasil disimpan!", { id: loadingToastId });
      
    } catch (err: any) {
      console.error("Error saving manual PG score:", err);
      toast.error(err.message || "Gagal menyimpan nilai.", { id: loadingToastId });
    } finally {
      setIsSaving(false);
    }
  };


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
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke List Hasil
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
        // --- MODIFIKASI: Tambah padding-bottom jika ada panel simpan ---
        <div className={`relative p-4 sm:p-6 bg-gray-50 min-h-screen font-sans ${(exam.tipe === 'Esai' || exam.tipe === 'Esai Uraian' || exam.tipe === 'Pilihan Ganda') ? 'pb-48' : ''}`}>
            <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke List Hasil
            </button>

            {/* Header Info Siswa & Skor */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Detail Jawaban: {exam.judul}</h1>
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
                    
                    {/* --- MODIFIKASI: Tampilan Skor --- */}
                    <div className="text-left sm:text-right">
                        {exam.tipe === 'Pilihan Ganda' && (
                            <>
                                <p className="text-sm text-gray-500">Nilai Akhir (Pilihan Ganda)</p>
                                <p className="text-4xl font-bold text-blue-600">{manualPgScore !== "" ? manualPgScore : (submission.nilai_akhir ?? '-')}</p>
                            </>
                        )}
                        {(exam.tipe === 'Esai' || exam.tipe === "Esai Uraian") && (
                             <>
                                <p className="text-sm text-gray-500">Nilai Akhir (Esai/uraian)</p>
                                <p className="text-xl font-bold text-blue-600">
                                    {/* Tampilkan nilai dari DB jika ada, jika tidak, tampilkan hitungan sementara */}
                                    {submission.nilai_esai !== null ? submission.nilai_esai : (currentTotalEssayScore || 'Belum Dinilai')}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* --- MODIFIKASI: Tampilan Ringkasan Jawaban --- */}
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
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-600 bg-blue-100 p-1 rounded-full" />
                            <span className="font-medium">{summary.essays}</span> Total Soal Esai
                        </div>
                    )}
                </div>
            </div>

            
            {exam.tipe === 'Pilihan Ganda' && (
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="w-full sm:w-auto">
              <label htmlFor="manual-pg-score" className="block text-sm font-medium text-gray-700">
                Beri Nilai Manual (0-100)
              </label>
              <input
                id="manual-pg-score"
                type="number"
                value={manualPgScore}
                onChange={(e) => setManualPgScore(e.target.value)}
                min={0}
                max={100}
                className="mt-1 w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder={submission.nilai_akhir?.toString() ?? "0"}
             />
            </div>
            <button
              onClick={handleSaveManualPgScore}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Simpan Nilai Manual
            </button>
          </div>
        </div>
      )}

      {/* Daftar Soal & Jawaban */}
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Tinjauan Jawaban</h2>
            <div className="space-y-4">
                {soalList.map((soal, index) => {
                    const studentAnswer = submission.jawaban[index];
                    const correctAnswer = soal.kunci_jawaban;

                    return (
                        <div key={soal.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            {/* Header Soal */}
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
                                            `(Skor: ${essayScores[soal.id] || 0} / ${soal.poin})`
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
                                        <span className="text-sm font-semibold text-gray-600 bg-yellow-100 px-3 py-1 rounded-full">Tidak menjawab</span>
                                    ) : (
                                        // Jika dijawab tapi salah
                                        <span className="text-sm font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">Salah</span>
                                    )
                                    )}
                                {(soal.tipe_soal === 'Esai' || soal.tipe_soal === 'Esai Uraian') && (
                                    <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Esai</span>
                                )}
                            </div>
                            
                            {/* Isi Pertanyaan */}
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
                                    // --- BARU: Kirim props untuk input nilai ---
                                    scoreValue={essayScores[soal.id]}
                                    onScoreChange={(value) => handleEssayScoreChange(soal.id, value, soal.poin)}
                                    isGraded={submission.nilai_esai !== null} // Cek apakah sudah pernah disimpan
                                />
                            )}
                            {soal.tipe_soal === 'Esai Uraian' && (
                                <RenderEsaiUraian 
                                    soal={soal} 
                                    studentAnswer={studentAnswer} 
                                    // --- BARU: Kirim props untuk input nilai ---
                                    scoreValue={essayScores[soal.id]}
                                    onScoreChange={(value) => handleEssayScoreChange(soal.id, value, soal.poin)}
                                    isGraded={submission.nilai_esai !== null} // Cek apakah sudah pernah disimpan
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* --- BARU: Panel Simpan Nilai Esai (Sticky) --- */}
       
            {(exam.tipe === 'Esai' || exam.tipe === 'Esai Uraian') && (
                <div className=" bottom-5 left-7 right-7 bg-white p-4 border-t border-gray-200 shadow-lg rounded-md mt-5">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div>
                            <p className="text-sm text-gray-600">Total Skor Esai (dari inputan)</p>
                            <p className="text-2xl font-bold text-blue-600">{currentTotalEssayScore} Poin</p>
                        </div>
                        {submission.nilai_esai !== null && (
                            <p className="text-sm text-green-600 font-medium">
                                Nilai akhir ({submission.nilai_esai}) sudah tersimpan. <br/> 
                                Menyimpan lagi akan menimpa nilai sebelumnya.
                            </p>
                        )}
                        <button
                            onClick={handleSaveEssayScores}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {submission.nilai_esai !== null ? "Perbarui Nilai Esai" : "Simpan Nilai Esai"}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

// --- KOMPONEN HELPER (TIDAK BERUBAH) ---
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

                if (isCorrect) {
                    chipStyle = "bg-green-100 text-green-800 border-green-300 border-2 font-semibold";
                    icon = <Check className="w-5 h-5 text-green-600 ml-auto" />;
                }
                
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

// --- MODIFIKASI: Komponen RenderEsai ---
const RenderEsai = ({ soal, studentAnswer, scoreValue, onScoreChange, isGraded }: {
    soal: SoalData,
    studentAnswer: string,
    scoreValue: number, // Nilai dari state
    onScoreChange: (value: string) => void,
    isGraded: boolean // Apakah sudah ada nilai_esai di DB
}) => {
    return (
        <div className="space-y-4">
            {/* Jawaban Siswa */}
            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md">
                <p className="font-semibold text-blue-800 mb-1">Jawaban Siswa:</p>
                <p className="text-blue-900 whitespace-pre-wrap text-sm">
                    {studentAnswer || <span className="italic text-gray-500">-- Tidak dijawab --</span>}
                </p>
            </div>
            
            {/* Rubrik Guru */}
            {soal.rubrik_penilaian && (
                 <div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-md">
                    <p className="font-semibold text-gray-800 mb-1">Kunci Jawaban/Rubrik Guru:</p>
                    <p className="text-gray-900 whitespace-pre-wrap text-sm">
                        {soal.rubrik_penilaian}
                    </p>
                </div>
            )}

            {/* --- BARU: Input Skor --- */}
            <div className="pt-2 ">
                <label 
                    htmlFor={`score-${soal.id}`} 
                    className="block text-sm font-medium text-gray-700"
                >
                    Berikan Skor (Maks: {soal.poin} Poin)
                </label>
                <input 
                    type="number"
                    id={`score-${soal.id}`}
                    value={scoreValue === null || isNaN(scoreValue) ? "" : scoreValue}
                    onChange={(e) => onScoreChange(e.target.value)}
                    min={0}
                    max={soal.poin}
                    className="mt-1 w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contoh: 10"
                />
                 {/* Tampilkan peringatan jika nilai di DB ada TAPI state input kosong (halaman baru dimuat) */}
                 {isGraded && (scoreValue === null || scoreValue === undefined) && (
                    <p className="text-xs text-green-600 mt-1">
                        Soal ini sudah pernah dinilai (bagian dari total). <br/>
                        Mengisi ulang akan menimpa nilai sebelumnya saat disimpan.
                    </p>
                 )}
            </div>
        </div>
    )
}

// --- BARU: Komponen helper untuk merender dan menilai Jawaban Esai Uraian ---
const RenderEsaiUraian = ({ soal, studentAnswer, scoreValue, onScoreChange, isGraded }: {
soal: SoalData,
studentAnswer: string,
 scoreValue: number,
onScoreChange: (value: string) => void,
isGraded: boolean
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
<p className="font-semibold text-purple-800 mb-2">Jawaban Siswa:</p>
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

{/* Rubrik Guru */}
{soal.rubrik_penilaian && (
<div className="p-3 bg-gray-50 border-l-4 border-gray-400 rounded-r-md">
<p className="font-semibold text-gray-800 mb-1">Kunci Jawaban/Rubrik Guru:</p>
<p className="text-gray-900 whitespace-pre-wrap text-sm">
{soal.rubrik_penilaian}
</p>
</div>
 )}

 {/* Input Skor (Sama seperti RenderEsai) */}
<div className="pt-2 ">
<label 
htmlFor={`score-${soal.id}`} 
className="block text-sm font-medium text-gray-700"
>
Berikan Skor (Maks: {soal.poin} Poin)
 </label>
<input 
type="number"
id={`score-${soal.id}`}
value={scoreValue === null || isNaN(scoreValue) ? "" : scoreValue}
onChange={(e) => onScoreChange(e.target.value)}
min={0}
max={soal.poin}
className="mt-1 w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
placeholder="Contoh: 10"
/>
{isGraded && (scoreValue === null || scoreValue === undefined) && (
<p className="text-xs text-green-600 mt-1">
Soal ini sudah pernah dinilai (bagian dari total). <br/>
Mengisi ulang akan menimpa nilai sebelumnya saat disimpan.
</p>
)}
</div>
</div>
)
}

export default StudentResultPage;

