"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    DocumentData,
    addDoc,
    serverTimestamp,
    updateDoc,
    limit,
    orderBy
} from 'firebase/firestore';
import { 
    CheckCircle,
    Loader2, 
    ArrowLeft, 
    AlertTriangle, 
    Clock, 
    BookCheck, 
    ListChecks, 
    FileText, 
    Play, 
    ChevronLeft, 
    ChevronRight, 
    Flag, 
    Send,
    Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// --- DEFINISI TIPE ---

// Status halaman
type PageStatus = "loading" | "ready" | "inProgress" | "submitting" | "alreadyTaken" | "deadlinePassed" | "error";

// Data dari koleksi 'students'
interface StudentData {
    nama: string;
    kelas_ref: DocumentReference;
}

// Data dari koleksi 'exams'
interface ExamData {
    id: string;
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)" | "Esai Uraian" | "PG dan Esai";
    mapel_ref: DocumentReference;
    guru_ref: DocumentReference;
    tanggal_selesai: Timestamp;
    durasi_menit: number;
    status: "Dipublikasi" | "Ditutup" | "Draft";
    jumlah_soal: number;
}

// Data dari koleksi 'soal'
interface SoalData {
    id: string;
    urutan: number;
    pertanyaan: string;
    tipe_soal: "Pilihan Ganda" | "Esai" | "Esai Uraian";
    poin: number;
    opsi?: { [key: string]: string }; // "A", "B", "C", "D"
    kunci_jawaban?: string; // "A"
    jumlah_input?: number;
    // rubrik_penilaian?: string; // Tidak perlu di-load di sini
}

// --- KOMPONEN HELPER: TIMER ---
// Dibuat terpisah agar tidak memicu re-render yang tidak perlu
const TimerDisplay = React.memo(({ initialSeconds, onTimeUp }: { initialSeconds: number, onTimeUp: () => void }) => {
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

    useEffect(() => {
        if (secondsLeft <= 0) {
            onTimeUp();
            return;
        }

        const timerId = setInterval(() => {
            setSecondsLeft(s => s - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [secondsLeft, onTimeUp]);

    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    return (
        <div className={`font-bold text-xl px-4 py-2 rounded-lg ${
            secondsLeft < 300 ? 'text-red-600 bg-red-100' : 'text-gray-800 bg-gray-100'
        }`}>
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    );
});
TimerDisplay.displayName = 'TimerDisplay';


// --- KOMPONEN HELPER: PALET NAVIGASI SOAL ---
const QuestionPalette = React.memo(({ count, currentIndex, answers, flags, onSelect }: {
    count: number,
    currentIndex: number,
    answers: string[],
    flags: boolean[],
    onSelect: (index: number) => void
}) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Navigasi Soal</h3>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: count }, (_, i) => {
                    const isCurrent = i === currentIndex;
                    const isAnswered = answers[i] !== "";
                    const isFlagged = flags[i];

                    let style = "bg-gray-100 hover:bg-gray-200 text-gray-700"; // Default
                    if (isAnswered) style = "bg-green-100 hover:bg-green-200 text-green-800";
                    if (isCurrent) style = "bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300";
                    if (isFlagged) style += " relative";

                    return (
                        <button
                            key={i}
                            onClick={() => onSelect(i)}
                            className={`w-9 h-9 text-sm font-bold rounded-md transition-all ${style}`}
                        >
                            {isFlagged && <Flag className="w-3 h-3 text-red-500 absolute top-0.5 right-0.5" fill="red" />}
                            {i + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});
QuestionPalette.displayName = 'QuestionPalette';

// --- KOMPONEN UTAMA ---

const StudentExamStartPage = () => {
    const { user, loading: authLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const examId = params.examId as string;

    // State Halaman
    const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
    const [error, setError] = useState<string | null>(null);

    // State Data
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [examData, setExamData] = useState<ExamData | null>(null);
    const [soalList, setSoalList] = useState<SoalData[]>([]);
    const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);

    // State Pengerjaan
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<string[]>([]); // Array untuk menyimpan jawaban
    const [flags, setFlags] = useState<boolean[]>([]); // Array untuk menandai "ragu-ragu"
    const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null); // ID dokumen di student's_answer
    const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

    useEffect(() => {
// Jangan lakukan apa-apa jika ujian belum dimulai (submissionId belum ada)
// atau jika sedang dalam proses submit
if (!currentSubmissionId || pageStatus === 'submitting') {
  return;
}

// Atur timer 'debounce'. Kita tunggu 2 detik setelah siswa selesai mengetik.
const saveTimer = setTimeout(async () => {
  console.log("Menyimpan progress jawaban...");
  try {
const submissionRef = doc(db, "students_answers", currentSubmissionId);
await updateDoc(submissionRef, {
  jawaban: answers // Simpan seluruh array jawaban saat ini
});
console.log("Progress tersimpan!");
  } catch (err) {
console.error("Gagal melakukan autosave:", err);
// Anda bisa tambahkan toast error non-intrusif di sini jika mau
// toast.error("Gagal simpan progress.", { duration: 1000 });
  }
}, 2000); // 2000ms = 2 detik

// Ini adalah 'cleanup function'.
// Jika siswa mengetik lagi (answers berubah lagi) sebelum 2 detik,
// timer sebelumnya akan dibatalkan dan timer baru akan dibuat.
return () => {
  clearTimeout(saveTimer);
};

  }, [answers, currentSubmissionId, pageStatus]); // Dependencies: jalankan ini jika 'answers' berubah

const isAllAnswered = useMemo(() => {
  // Jika jumlah soal dan jawaban tidak sinkron, anggap belum
 if (soalList.length === 0 || soalList.length !== answers.length) return false;

  // 'every' akan cek semua item. Jika 1 saja 'false', hasilnya 'false'
   return answers.every((answerString, index) => {
const soal = soalList[index];

// Untuk PG atau Esai Biasa, cek string tidak boleh kosong
if (soal.tipe_soal === "Pilihan Ganda" || soal.tipe_soal === "Esai") {
  return answerString.trim() !== "";
}

// Untuk Esai Uraian, cek string JSON
if (soal.tipe_soal === "Esai Uraian") {
  if (answerString.trim() === "") return false; // Belum diisi sama sekali
  try {
const arr = JSON.parse(answerString);
if (!Array.isArray(arr)) return false; // Data rusak
// Cek apakah "minimal 1" input di array itu diisi
// 'some' akan 'true' jika 1 saja item tidak kosong
return arr.some(item => item.trim() !== "");
  } catch (e) {
return false; // Gagal parse JSON (dianggap belum diisi)
  }
}

return false; // Tipe soal tidak dikenal
  });
}, [answers, soalList]); // Hitung ulang hanya saat 'answers' atau 'soalList' berubah
                

    // --- 1. FUNGSI FETCH UTAMA (PRE-CHECKS) ---
    const fetchExamPrerequisites = useCallback(async (userUid: string) => {
        setPageStatus("loading");
        setError(null);
        try {
            // Referensi
            const studentRef = doc(db, "students", userUid);
            const examRef = doc(db, "exams", examId);

            // Ambil data siswa dan data Ujian secara bersamaan
            const [studentSnap, examSnap] = await Promise.all([
                getDoc(studentRef),
                getDoc(examRef)
            ]);

            // Cek 1: Data Siswa ada?
            if (!studentSnap.exists()) {
                throw new Error("Data siswa tidak ditemukan.");
            }
            setStudentData(studentSnap.data() as StudentData);

            // Cek 2: Ujian ada?
            if (!examSnap.exists()) {
                throw new Error("Ujian tidak ditemukan.");
            }
            const exam = { ...examSnap.data(), id: examSnap.id } as ExamData;
            setExamData(exam);

            // Cek 3: Ini Tipe "Tugas (Upload File)"? Jika ya, stop.
            if (exam.tipe === "Tugas (Upload File)") {
                setError("Ujian ini adalah tipe Upload File, bukan ujian online. Silakan kembali.");
                setPageStatus("error");
                // Idealnya: router.replace(`/student/examPage/upload/${examId}`);
                return;
            }

            // Cek 4: Apakah siswa sudah pernah mengerjakan?
            const submissionQuery = query(
                collection(db, "students_answers"),
                where("latihan_ref", "==", examRef),
                where("student_ref", "==", studentRef),
                limit(1)
            );
            const submissionSnap = await getDocs(submissionQuery);

if (!submissionSnap.empty) {
// Ada submission, mari kita cek statusnya
const submissionDoc = submissionSnap.docs[0];
const submissionData = submissionDoc.data();
const submissionId = submissionDoc.id;

if (submissionData.status === "dikerjakan") {
  // --- KASUS 1: UJIAN BENAR-BENAR SUDAH SELESAI ---
  setExistingSubmissionId(submissionId);
  setPageStatus("alreadyTaken");
  return; // Hentikan fungsi

} else if (submissionData.status === "sedang dikerjakan") {
  // --- KASUS 2: SISWA ME-REFRESH HALAMAN (BUG) ---
  // Kita harus melanjutkan ujiannya, bukan menganggapnya selesai.
  console.log("Melanjutkan ujian yang sedang berjalan (di-refresh)...");

  // 1. Ambil soal (logika yang sama seperti di luar 'if')
  const soalQuery = query(
collection(db, "exams", examId, "soal"),
orderBy("urutan", "asc")
  );
  const soalSnap = await getDocs(soalQuery);

  if (soalSnap.empty) {
throw new Error("Gagal memuat soal: Ujian ini belum memiliki pertanyaan.");
  }
  const soal = soalSnap.docs.map(d => ({ ...d.data(), id: d.id } as SoalData));
  setSoalList(soal);
  
  // 2. Ambil jawaban yang TERSIMPAN di database
  const savedAnswers = submissionData.jawaban || [];

  // 3. Set state 'answers' dengan jawaban tersimpan
  // (Tambahkan pengecekan jika jumlah soal tidak cocok)
  if (savedAnswers.length === soal.length) {
setAnswers(savedAnswers);
  } else {
// Jika tidak cocok (misal guru edit soal saat ujian),
// buat array baru seukuran soal.
   console.warn("Jumlah jawaban tersimpan tidak cocok dengan jumlah soal.");
const newAnswers = new Array(soal.length).fill("");
    // Salin jawaban lama yang masih relevan
for(let i = 0; i < Math.min(savedAnswers.length, soal.length); i++) {
  newAnswers[i] = savedAnswers[i];
}
setAnswers(newAnswers);
  }

  // 4. Inisialisasi flags
  setFlags(new Array(soal.length).fill(false));
  
  // 5. Set ID submission yang sedang aktif
  setCurrentSubmissionId(submissionId);

  // 6. LANGSUNG masuk ke mode "inProgress", lewati "ready"
  if (submissionData.waktu_mulai) {
const startTime = submissionData.waktu_mulai.toDate();
const totalDurationSeconds = exam.durasi_menit * 60;
const now = new Date();
const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
const newRemainingSeconds = totalDurationSeconds - elapsedSeconds;
   
setRemainingSeconds(newRemainingSeconds);
  } else {
// Fallback jika 'waktu_mulai' tidak ada
setRemainingSeconds(exam.durasi_menit * 60);
  }

  // 7. LANGSUNG masuk ke mode "inProgress", lewati "ready"
  setPageStatus("inProgress");
  return; // Hentikan fungsi
}
  }

            // Cek 5: Apakah deadline sudah lewat?
            if (exam.tanggal_selesai.toDate() < new Date()) {
                setPageStatus("deadlinePassed");
                return;
            }
            
            // Cek 6: Apakah statusnya "Dipublikasi"?
            if (exam.status !== "Dipublikasi") {
                setError("Ujian ini tidak (lagi) tersedia untuk dikerjakan.");
                setPageStatus("error");
                return;
            }

            // --- SEMUA CEK LOLOS ---
            // Saatnya mengambil soal
            const soalQuery = query(
                collection(db, "exams", examId, "soal"),
                orderBy("urutan", "asc")
            );
            const soalSnap = await getDocs(soalQuery);

            if (soalSnap.empty || soalSnap.size !== exam.jumlah_soal) {
                // Ini masalah jika jumlah soal tidak cocok
                console.warn(`Jumlah soal di exam (${exam.jumlah_soal}) tidak cocok dengan query (${soalSnap.size})`);
                if (soalSnap.empty) {
                    throw new Error("Gagal memuat soal: Ujian ini belum memiliki pertanyaan.");
                }
            }
            
            const soal = soalSnap.docs.map(d => ({ ...d.data(), id: d.id } as SoalData));
            setSoalList(soal);
            
            // Inisialisasi array jawaban dan flags
            setAnswers(new Array(soal.length).fill(""));
            setFlags(new Array(soal.length).fill(false));

            // Siap untuk konfirmasi
            setPageStatus("ready");

        } catch (err: any) {
            console.error("Error fetching prerequisites:", err);
            setError(err.message || "Gagal memuat data ujian.");
            setPageStatus("error");
            if (err.code === 'permission-denied') {
                setError("Izin ditolak. Anda mungkin tidak memiliki akses ke soal Ujian ini. Pastikan rules Firestore Anda benar.");
            }
        }
    }, [examId]);

    // --- 2. EFFECT UNTUK MENJALANKAN FETCH ---
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchExamPrerequisites(user.uid);
        }
        if (!user && !authLoading) {
            setPageStatus("error");
            setError("Harap login sebagai siswa untuk mengerjakan ujian.");
        }
    }, [user, authLoading, examId, fetchExamPrerequisites]);


    // --- 3. HANDLER UNTUK MEMULAI UJIAN ---
    const handleStartExam = async () => {
        if (!studentData || !examData || !user) return;
        setPageStatus("loading"); // Tampilkan loading singkat

        try {
            // Buat dokumen "student's_answer" baru
            const studentRef = doc(db, "students", user.uid);
            const examRef = doc(db, "exams", examId);

            const submissionData = {
                student_ref: studentRef,
                latihan_ref: examRef,
                kelas_ref: studentData.kelas_ref,
                waktu_mulai: serverTimestamp(),
                waktu_selesai: null,
                status: "sedang dikerjakan",
                jawaban: new Array(soalList.length).fill(""), // Simpan jawaban kosong dulu
                nilai_akhir: null,
                nilai_esai: null
            };

            const docRef = await addDoc(collection(db, "students_answers"), submissionData);
            setCurrentSubmissionId(docRef.id);
            setPageStatus("inProgress"); // Mulai!
            setRemainingSeconds(examData.durasi_menit * 60);

        } catch (err: any) {
            console.error("Error creating submission doc:", err);
            setError("Gagal memulai ujian. Cek koneksi dan coba lagi.");
            setPageStatus("error");
            toast.error("Gagal memulai ujian.");
        }
    };

    // --- 4. HANDLER UNTUK NAVIGASI & JAWABAN ---
    const handleAnswerChange = (index: number, value: string) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    // --- DIPERBAIKI: Handler untuk jawaban Esai Uraian ---
  const handleUraianAnswerChange = (questionIndex: number, answerIndex: number, value: string) => {
const currentSoal = soalList[questionIndex];
const jumlahInput = currentSoal.jumlah_input || 1;
const currentAnswerString = answers[questionIndex];

let currentAnswersArray: string[] = [];

// 1. Coba parse jawaban yang ada (misal: "[\"ss\"]")
try {
  const parsed = JSON.parse(currentAnswerString);
  if (Array.isArray(parsed)) {
currentAnswersArray = parsed; // Hasil: ["ss"]
  }
} catch (e) {
  // Biarkan 'currentAnswersArray' sebagai array kosong
}

// 2. (FIX UTAMA) Buat array BARU dengan panjang yang BENAR (misal: 5)
const newArray = new Array(jumlahInput).fill("");

// 3. Salin jawaban lama ke array baru
for (let i = 0; i < jumlahInput; i++) {
  newArray[i] = currentAnswersArray[i] || "";
}
// Hasil: ["ss", "", "", "", ""]

// 4. Update nilai yang sedang diketik
newArray[answerIndex] = value;
// Hasil (jika ketik "a" di input ke-2): ["ss", "a", "", "", ""]

// 5. Stringify kembali dan simpan ke state 'answers'
const newAnswers = [...answers];
newAnswers[questionIndex] = JSON.stringify(newArray);
setAnswers(newAnswers);
  };

    const handleFlagChange = (index: number) => {
        const newFlags = [...flags];
        newFlags[index] = !newFlags[index];
        setFlags(newFlags);
    };

    const goToQuestion = (index: number) => {
        if (index >= 0 && index < soalList.length) {
            setCurrentQuestionIndex(index);
        }
    };
    
    // --- 5. HANDLER UNTUK SELESAI/SUBMIT ---
    const executeSubmitExam = useCallback(async () => {
        if (pageStatus === 'submitting' || !currentSubmissionId || !examData) return;

        setPageStatus("submitting");
        
        try {
           // --- HAPUS SELURUH LOGIKA KALKULASI SKOR PG DARI SINI (420-an) ---
            // (Hapus total blok forEach dan perhitungan nilai_akhir)

            // Update dokumen student's_answer
            const submissionRef = doc(db, "students_answers", currentSubmissionId);
            await updateDoc(submissionRef, {
                status: "dikerjakan",
                waktu_selesai: serverTimestamp(),
                jawaban: answers, // Simpan array jawaban siswa
                nilai_akhir: null, // <-- PENTING: Set ke null/default. Guru yang akan mengisinya nanti.
            });

            // Selesai! Arahkan ke halaman hasil.
            toast.success("Ujian berhasil dikumpulkan!");
            router.push(`/student/examPage/result/${currentSubmissionId}`);
        } catch (err: any) {
            console.error("Error submitting exam:", err);
            setError("Gagal menyimpan jawaban Anda. Cek koneksi dan hubungi guru.");
            setPageStatus("error"); // Biarkan siswa melihat errornya
            toast.error("Gagal mengirim jawaban.");
        }
    }, [pageStatus, currentSubmissionId, examData,  answers, router]);

     const handleSubmitExam = useCallback((isTimeUp: boolean = false) => {
        if (pageStatus === 'submitting') return; // Mencegah klik ganda

            if (isTimeUp) {
                toast.error("Waktu Habis! Jawaban Anda dikumpulkan secara otomatis.", {
                    duration: 4000
                });
                executeSubmitExam(); // Langsung kumpulkan
                return;
            }
        
        // --- GANTI `window.confirm` DENGAN `toast` ---
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-10 h-10 text-yellow-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Kumpulkan Ujian?</p>
                        <p className="text-sm text-gray-600">
                            Apakah Anda yakin ingin menyelesaikan ujian ini? Jawaban tidak dapat diubah lagi.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="py-1.5 px-3 rounded-md text-sm font-medium bg-white border border-gray-300 hover:bg-gray-100"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeSubmitExam(); // Panggil fungsi inti
                        }}
                        className="py-1.5 px-3 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                    >
                        Ya, Kumpulkan
                    </button>
                </div>
            </div>
        ), { duration: 60000 }); // Beri waktu 60 detik sebelum toast hilang otomatis

    }, [pageStatus, executeSubmitExam]); 

    // --- 6. RENDER KONTEN BERDASARKAN STATUS ---

    // Render Soal Saat Ini
    const renderCurrentQuestion = () => {
        if (!examData || soalList.length === 0) return null;
        const soal = soalList[currentQuestionIndex];
        const jawabanSiswa = answers[currentQuestionIndex];
        const isFlagged = flags[currentQuestionIndex];

        return (
            <div className="bg-white p-5 rounded-xl shadow border border-gray-100">
                {/* Header Soal */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-lg font-semibold text-gray-800">
                        Soal Nomor {currentQuestionIndex + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                        (Poin: {soal.poin} Poin)
                    </span>
                </div>
                
                {/* Pertanyaan */}
                <p className="text-base text-gray-800 my-5 whitespace-pre-wrap leading-relaxed">
                    {soal.pertanyaan}
                </p>

                {/* Opsi Jawaban */}
                <div className="space-y-3">
                    {soal.tipe_soal === "Pilihan Ganda" && soal.opsi && (
                        ['A', 'B', 'C', 'D'].map(key => (
                            <label 
                                key={key} 
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer
                                    ${jawabanSiswa === key 
                                        ? 'border-blue-600 bg-blue-50' 
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-base font-semibold text-gray-800">{key}.</span>
                                <input 
                                    type="radio"
                                    name={`soal_${soal.id}`}
                                    value={key}
                                    checked={jawabanSiswa === key}
                                    onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                                    className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-base text-gray-800">{soal.opsi?.[key]}</span>
                            </label>
                        ))
                    )}
                    
                    {soal.tipe_soal === "Esai" && (
                        <div>
                            <label htmlFor="jawaban_esai" className="block text-sm font-medium text-gray-700 mb-1">Jawaban Anda:</label>
                            <textarea 
                                id="jawaban_esai"
                                rows={8}
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Tuliskan jawaban esai Anda di sini..."
                                value={jawabanSiswa}
                                onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
                            />
                        </div>
                    )}

{/* --- BARU: BLOK ESAI URAIAN (LOGIKA DIPERBAIKI TOTAL) --- */}
{soal.tipe_soal === "Esai Uraian" && (() => {
// 1. Tentukan jumlah input yang SEHARUSNYA tampil (misal: 5)
const jumlahInput = soal.jumlah_input || 1;

// 2. Parse jawaban yang TERSIMPAN (misal: "[\"ss\"]")
let savedAnswers: string[] = [];
try {
const parsed = JSON.parse(jawabanSiswa);
if (Array.isArray(parsed)) {
savedAnswers = parsed; // Hasil: ["ss"]
}
} catch (e) {
// Biarkan 'savedAnswers' sebagai array kosong
}

// 3. Buat array TAMPILAN dengan panjang yang BENAR (misal: 5)
const displayAnswers = Array.from({ length: jumlahInput }, (_, index) => {
// Ambil jawaban dari savedAnswers, atau isi ""
return savedAnswers[index] || ""; 
});
// Hasil: ["ss", "", "", "", ""]

// 4. Render 'displayAnswers' (yang panjangnya 5)
return (
<div className="space-y-4">
<p className="block text-sm font-medium text-gray-700">Tuliskan {jumlahInput} jawaban Anda:</p>
{displayAnswers.map((jawaban, index) => (
<div key={index} className="flex items-center gap-3">
<span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-semibold text-sm flex-shrink-0">
{index + 1}
</span>
<input 
type="text"
className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
placeholder={`Jawaban ${index + 1}...`}
value={jawaban}
onChange={(e) => handleUraianAnswerChange(currentQuestionIndex, index, e.target.value)}
/>
</div>
))}
</div>
);
})()}

                </div>

                {/* Tombol Ragu-ragu */}
                <div className="border-t mt-5 pt-4">
                     <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                        <input 
                            type="checkbox"
                            className="form-checkbox h-5 w-5 text-yellow-500 rounded focus:ring-yellow-400"
                            checked={isFlagged}
                            onChange={() => handleFlagChange(currentQuestionIndex)}
                        />
                        <Flag className={`w-5 h-5 ${isFlagged ? 'text-yellow-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Tandai (Ragu-ragu)</span>
                    </label>
                </div>
            </div>
        );
    };

    // Render Halaman Utama berdasarkan Status
    const renderByPageStatus = () => {
        switch (pageStatus) {
            case "loading":
                return (
                    <div className="flex flex-col justify-center items-center h-[80vh]">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                        <span className="ml-4 text-gray-600 text-lg mt-4">Memuat data ujian...</span>
                    </div>
                );

            case "error":
                return (
                    <div className="flex flex-col justify-center items-center h-[80vh] text-center">
                        <AlertTriangle className="w-16 h-16 text-red-500" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-800">Terjadi Kesalahan</h2>
                        <p className="text-gray-600 mt-1">{error}</p>
                        <Link href="/student/examPage" className="mt-6 py-2 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                            Kembali ke Daftar Ujian
                        </Link>
                    </div>
                );

            case "alreadyTaken":
                return (
                    <div className="flex flex-col justify-center items-center h-[80vh] text-center">
                        <BookCheck className="w-16 h-16 text-green-500" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-800">Ujian Telah Selesai</h2>
                        <p className="text-gray-600 mt-1">Anda sudah pernah mengerjakan ujian ini.</p>
                        <Link 
                            href={`/student/examPage/result/${existingSubmissionId}`} 
                            className="mt-6 py-2 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-2"
                        >
                            <Eye className="w-5 h-5" />
                            Lihat Hasil Anda
                        </Link>
                    </div>
                );
            
            case "deadlinePassed":
                 return (
                    <div className="flex flex-col justify-center items-center h-[80vh] text-center">
                        <Clock className="w-16 h-16 text-red-500" />
                        <h2 className="mt-4 text-xl font-semibold text-gray-800">Batas Waktu Terlewat</h2>
                        <p className="text-gray-600 mt-1">Batas waktu pengerjaan untuk ujian ini telah berakhir.</p>
                        <Link href="/student/examPage" className="mt-6 py-2 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                            Kembali ke Daftar Ujian
                        </Link>
                    </div>
                );

            case "ready":
                return (
                    <div className="max-w-2xl mx-auto  text-center">
                        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                            <h1 className="text-2xl font-bold text-gray-800">{examData?.judul}</h1>
                            <p className="text-md text-gray-600 mt-2">Anda akan memulai ujian. Harap perhatikan informasi di bawah ini.</p>
                            
                            <div className="flex justify-center gap-6 my-8">
                                <div className="text-center">
                                    <Clock className="w-10 h-10 text-blue-600 mx-auto" />
                                    <p className="text-sm text-gray-500 mt-2">Durasi</p>
                                    <p className="text-lg font-bold text-gray-800">{examData?.durasi_menit} Menit</p>
                                </div>
                                 <div className="text-center">
                                    <ListChecks className="w-10 h-10 text-blue-600 mx-auto" />
                                    <p className="text-sm text-gray-500 mt-2">Jumlah Soal</p>
                                    <p className="text-lg font-bold text-gray-800">{soalList.length} Soal</p>
                                </div>
                                <div className="text-center">
                                    <FileText className="w-10 h-10 text-blue-600 mx-auto" />
                                    <p className="text-sm text-gray-500 mt-2">Tipe</p>
                                    <p className="text-lg font-bold text-gray-800">{examData?.tipe}</p>
                                </div>
                            </div>

                            {/* --- BARU: Panel Peringatan Kejujuran --- */}
                            <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                                <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-semibold text-yellow-800">Harap Kerjakan dengan Jujur</p>
                                    <p className="text-sm text-yellow-700 mt-1">
                                    Dilarang menyontek, bekerja sama, atau membuka tab/aplikasi lain selama ujian berlangsung.
                                    </p>
                                </div>
                                </div>
                            </div>

                            <ul className="text-left text-gray-600 space-y-2 mb-8">
                                <li><CheckCircle className="w-5 h-5 text-green-500 inline mr-2" /> Pastikan koneksi internet Anda stabil.</li>
                                <li><CheckCircle className="w-5 h-5 text-green-500 inline mr-2" /> Waktu akan berjalan setelah Anda menekan tombol Mulai.</li>
                                <li><CheckCircle className="w-5 h-5 text-green-500 inline mr-2" /> Jika waktu habis, jawaban akan dikumpulkan secara otomatis.</li>
                            </ul>

                            <button
                                onClick={handleStartExam}
                                className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all"
                            >
                                <Play className="w-6 h-6" />
                                Mulai Ujian
                            </button>
                        </div>
                    </div>
                );
            
            case "submitting":
                return (
                    <div className="flex flex-col justify-center items-center h-[80vh]">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                        <span className="ml-4 text-gray-600 text-lg mt-4">Mengumpulkan jawaban Anda...</span>
                        <p className="text-gray-500">Jangan tutup halaman ini.</p>
                    </div>
                );

            case "inProgress":
                if (!examData || remainingSeconds === null) {
                    return(
                        <div className='flex flex-col justify-center items-center h-[80vh]'>
                            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                        </div>
                    );
                    // --- BARU: Logika untuk mengecek apakah semua soal sudah terjawab ---
                    } 
                return (
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Kolom Kiri (Utama): Soal */}
                        <div className="w-full lg:flex-1">
                            {renderCurrentQuestion()}
                        </div>
                        
                        {/* Kolom Kanan (Navigasi): Timer & Palet */}
                        <div className="w-full lg:w-80">
                            <div className="sticky top-6 space-y-4">
                                {/* Timer */}
                                <div className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-col items-center">
                                    <h3 className="text-base font-semibold text-gray-800 mb-2">Sisa Waktu</h3>
                                    <TimerDisplay 
                                        initialSeconds={remainingSeconds} 
                                        onTimeUp={() => handleSubmitExam(true)} 
                                    />
                                </div>
                                
                                {/* Palet */}
                                <QuestionPalette 
                                    count={soalList.length}
                                    currentIndex={currentQuestionIndex}
                                    answers={answers}
                                    flags={flags}
                                    onSelect={goToQuestion}
                                />

                                {/* Tombol Navigasi Bawah */}
                                <div className="flex justify-between items-center mt-4">
                                    <button
                                        onClick={() => goToQuestion(currentQuestionIndex - 1)}
                                        disabled={currentQuestionIndex === 0}
                                        className="flex items-center gap-1 py-2 px-4 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Sebelumnya
                                    </button>
                                    <button
                                        onClick={() => goToQuestion(currentQuestionIndex + 1)}
                                        disabled={currentQuestionIndex === soalList.length - 1}
                                        className="flex items-center gap-1 py-2 px-4 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        Berikutnya
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Tombol Selesai */}
                                {isAllAnswered ? (
                                    <button
                                    onClick={() => handleSubmitExam(false)}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all mt-4"
                                >
                                    <Send className="w-5 h-5" />
                                    Selesai & Kumpulkan Ujian
                                </button>
                                ) : (
                                      <div className='w-full flex items-center justify-center gap-2 py-3 px-5 bg-gray-300 text-gray-500 font-semibold rounded-lg cursor-not-allowed mt-4'>
                                        <span>jawab semua soal terlebih dahulu</span>
                                      </div>  

                                )}
                                
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* Header (hanya tampil saat pengerjaan) */}
            {pageStatus === "inProgress" && (
                <div className="mb-6 pb-4 border-b">
                    <h1 className="text-2xl font-bold text-gray-800">{examData?.judul}</h1>
                    <p className="text-base text-gray-600">
                        Soal {currentQuestionIndex + 1} dari {soalList.length}
                    </p>
                </div>
            )}
            
            {/* Konten Utama */}
            {renderByPageStatus()}
        </div>
    );
};

export default StudentExamStartPage;
