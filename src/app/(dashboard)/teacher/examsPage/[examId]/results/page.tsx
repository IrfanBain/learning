"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    ClipboardCheck, 
    User, 
    Clock, 
    CheckCircle, 
    AlertTriangle,
    FileDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';

declare global {
    interface Window {
        XLSX: any;
        jspdf: any;
    }
}

// Tipe untuk data Ujian (Exam)
interface ExamData {
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Esai Uraian" | "PG dan Esai" | string;
    mapel_ref: DocumentReference;
    guru_ref: DocumentReference;
    kelas_ref: DocumentReference;
    tanggal_selesai: Timestamp;
    mapelNama?: string;
    guruNama?: string;
    kelasNama?: string;
}

// Tipe Submissions (tidak berubah)
interface SubmissionData {
    id: string; 
    latihan_ref: DocumentReference;
    student_ref: DocumentReference;
    status: string;
    nilai_akhir?: number; // Skor PG
    nilai_esai?: number;
    nilai_akhir_scaled?: number;
    waktu_selesai: Timestamp | null;
    studentName?: string;
    studentNisn?: string;
}

// Helper function (tidak berubah)
const getRefName = async (ref: DocumentReference, fieldName: string) => {
    try {
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
            return docSnap.data()[fieldName] || "-";
        }
    } catch (e) { console.warn("Failed to get ref name", e); }
    return "-";
};


const ExamResultsPage = () => {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const examId = params.examId as string;

    const [exam, setExam] = useState<ExamData | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [librariesLoaded, setLibrariesLoaded] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isCreatingSubmission, setIsCreatingSubmission] = useState(false);

    // Effect untuk memuat library export
    useEffect(() => {
        // ... (kode ini tidak berubah) ...
        const loadScript = (src: string, id: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                if (document.getElementById(id)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.id = id;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load script ${src}`));
                document.body.appendChild(script);
            });
        };

        Promise.all([
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "xlsx-script"),
            loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "jspdf-script")
        ])
        .then(() => {
            return loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js", "jspdf-autotable-script");
        })
        .then(() => {
            setLibrariesLoaded(true);
        })
        .catch(err => {
            console.error(err);
            toast.error("Gagal memuat library export.");
        });
    }, []);

    // fetchResultsData
    const fetchResultsData = useCallback(async () => {
        // ... (fungsi ini tidak berubah, sudah mengambil semua data) ...
        if (!examId || !user) return;
        setLoading(true);
        setError(null);

        try {
            const examRef = doc(db, "exams", examId);
            const examSnap = await getDoc(examRef);
            if (!examSnap.exists()) {
                throw new Error("Ujian tidak ditemukan.");
            }
            const examData = examSnap.data() as ExamData;

            const [mapelNama, guruNama, kelasSnap] = await Promise.all([
                getRefName(examData.mapel_ref, 'nama_mapel'), 
                getRefName(examData.guru_ref, 'nama_lengkap'),
                getDoc(examData.kelas_ref) 
            ]);
            
            const kls = kelasSnap.exists() ? kelasSnap.data() : null;
            const kelasNama = kls ? `${kls.tingkat || ''} ${kls.nama_kelas || '-'}`.trim() : "-";

            setExam({ ...examData, mapelNama, guruNama, kelasNama }); 

            // --- LOGIKA BARU (Berbasis Siswa) ---

      // 1. Ambil SEMUA siswa di kelas ini
      const studentsQuery = query(
        collection(db, "students"),
        where("kelas_ref", "==", examData.kelas_ref)
      );
      const studentsSnapshot = await getDocs(studentsQuery);

      // 2. Ambil SEMUA submission untuk ujian ini
      const submissionsQuery = query(
        collection(db, "students_answers"),
        where("latihan_ref", "==", examRef)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);

      // 3. Buat Peta (Map) dari submissions agar mudah dicari
      const submissionMap = new Map<string, SubmissionData>();
      submissionsSnapshot.docs.forEach(doc => {
        const subData = doc.data() as SubmissionData;
        submissionMap.set(subData.student_ref.id, { ...subData, id: doc.id });
      });

      // 4. Tentukan status ujian (untuk siswa yang belum mengerjakan)
      const now = new Date();
      const examDeadline = examData.tanggal_selesai.toDate();

      // 5. Gabungkan data: Loop SEMUA SISWA, lalu cari submission mereka
      const combinedResults: SubmissionData[] = [];

      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
       
        const studentName = studentData.nama_lengkap || studentData.displayName || "Siswa Tanpa Nama";
        const studentNisn = studentData.nisn || "";

        const submission = submissionMap.get(studentId);

        if (submission) {
          // KASUS 1: Siswa SUDAH mengerjakan
          combinedResults.push({
            ...submission,
            studentName,
            studentNisn,
          });
        } else {
          // KASUS 2: Siswa BELUM mengerjakan
          let syntheticStatus = "";
          if (now < examDeadline) {
            syntheticStatus = "Belum Mengerjakan"; // Sesuai permintaan Anda
          } else {
            syntheticStatus = "Tidak Mengerjakan"; // Sesuai permintaan Anda
          }

          combinedResults.push({
            id: studentId, // Gunakan ID siswa sebagai key
            latihan_ref: examRef,
            student_ref: doc(db, "students", studentId),
            status: syntheticStatus,
            nilai_akhir: undefined,
            nilai_esai: undefined,
            waktu_selesai: null,
            studentName,
            studentNisn,
          });
        }
      }

      // 6. Sortir dan simpan ke state
      combinedResults.sort((a, b) => (b.nilai_akhir || 0) - (a.nilai_akhir || 0));
      setSubmissions(combinedResults);

        } catch (err: any) {
            console.error("Error fetching results:", err);
            setError(err.message || "Gagal memuat hasil.");
            if (err.code === 'failed-precondition') {
                setError("Query gagal: Anda memerlukan indeks Firestore. Silakan cek konsol Firebase Anda (error) untuk link membuat indeks.");
                toast.error("Gagal: Indeks Firestore tidak ditemukan.");
            } else {
                toast.error(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [examId, user]);

    const handleCreateManualSubmission = async (studentRef: DocumentReference, studentId: string) => {
        // Cek apakah submission sudah ada (untuk mencegah duplikat)
        const submissionExists = submissions.find(s => s.student_ref.id === studentId && s.status === 'dikerjakan');
        if (submissionExists) {
            // Jika sudah ada, langsung arahkan ke sana
            toast.success("Siswa ini sudah memiliki data. Mengarahkan...");
            router.push(`/teacher/examsPage/${examId}/results/${submissionExists.id}`);
            return;
        }

        if (isCreatingSubmission || !exam) return;
        setIsCreatingSubmission(true);
        const toastId = toast.loading("Membuat lembar jawaban manual...");

        try {
            const examRef = doc(db, "exams", examId);
            
            // Kita perlu tahu jumlah soal untuk membuat array jawaban kosong
            const soalCollectionRef = collection(db, "exams", examId, "soal");
            const soalSnap = await getDocs(soalCollectionRef);
            const soalCount = soalSnap.size;

            if (soalCount === 0) {
                throw new Error("Tidak bisa memberi nilai: Ujian ini tidak memiliki soal.");
            }

            // Buat data submission baru
            const submissionData = {
                student_ref: studentRef,
                latihan_ref: examRef,
                kelas_ref: exam.kelas_ref,
                waktu_mulai: serverTimestamp(),
                waktu_selesai: serverTimestamp(), // Dianggap langsung selesai
                status: "dikerjakan", // Langsung set "dikerjakan"
                jawaban: new Array(soalCount).fill(""), // Array jawaban kosong
                nilai_akhir: 0, // Default 0
                nilai_esai: 0,  // Default 0 (ini yang akan Anda isi)
            };

            // Simpan ke database
            const docRef = await addDoc(collection(db, "students_answers"), submissionData);
            
            toast.success("Lembar jawaban dibuat. Mengarahkan...", { id: toastId });

            // Refresh data di tabel (agar statusnya berubah)
            fetchResultsData(); 
            
            // Arahkan guru ke halaman grading untuk dokumen BARU ini
            router.push(`/teacher/examsPage/${examId}/results/${docRef.id}`);

        } catch (err: any) {
            console.error("Error creating manual submission:", err);
            toast.error(err.message || "Gagal membuat lembar jawaban.", { id: toastId });
        } finally {
            setIsCreatingSubmission(false);
        }
    };

    useEffect(() => {
        fetchResultsData();
    }, [fetchResultsData]);

    // --- MODIFIKASI: getFormattedData ---
   const getFormattedData = () => {
    if (!exam) return { header: [], body: [] };
    
    // Tentukan tipe ujian
    const isMixed = exam.tipe === 'PG dan Esai';
    const isPGOnly = exam.tipe === 'Pilihan Ganda';
    const isEsaiOnly = exam.tipe === 'Esai' || exam.tipe === 'Esai Uraian';

    let header = ["No", "Nama Siswa", "NISN", "Status"];

    // LOGIC HEADER BARU:
    if (isMixed) {
        // PERMINTAAN 1: Tetap munculkan PG dan Esai
        header.push("SKOR PG");
        header.push("SKOR ESAI");
        // PERMINTAAN 2: Tambahkan Nilai Akhir
        header.push("NILAI AKHIR"); 
    } else if (isPGOnly) {
        header.push("Skor PG");
    } else if (isEsaiOnly) {
        header.push("Skor Esai");
    }
    
    // Tanda Tangan DIHAPUS dari header export

    const body = submissions.map((sub, index) => {
        let row: (string | number | null)[] = [
            index + 1,
            sub.studentName || '',
            sub.studentNisn || '',
            sub.status === 'dikerjakan' ? 'Selesai' : sub.status,
        ];
        
        // LOGIC BODY BARU:
        if (isMixed) {
            // 1. Skor PG (Ambil dari nilai_akhir yang menampung skor mentah PG)
            row.push(sub.nilai_akhir ?? '-'); 
            // 2. Skor Esai (Ambil dari nilai_esai)
            row.push(sub.nilai_esai ?? '-');
            // 3. Nilai Akhir (Ambil dari nilai_akhir_scaled yang dinormalisasi)
            row.push(sub.nilai_akhir_scaled ?? 'Belum Dinilai'); 
        } else if (isPGOnly) {
            // Skor PG (Tipe lama)
            row.push(sub.nilai_akhir ?? '-');
        } else if (isEsaiOnly) {
            // Skor Esai (Tipe lama)
            row.push(sub.nilai_esai ?? '-');
        }
        
        // Tanda Tangan DIHAPUS dari body export
        return row;
    });
    
    return { header, body };
};

    // --- MODIFIKASI: handleExportExcel ---
    const handleExportExcel = () => {
        if (!librariesLoaded || !window.XLSX) {
            toast.error("Library Excel belum siap. Coba lagi.");
            return;
        }
        if (!exam) return;
        
        setIsExporting(true);
        toast.loading("Membuat file Excel...", { id: "export-toast" });

        try {
            const { header, body } = getFormattedData(); // <-- Data sudah kondisional
            const exportDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

            const title = [
                [`Judul Ujian:`, exam.judul],
                [`Mata Pelajaran:`, exam.mapelNama ?? '-'],
                [`Kelas:`, exam.kelasNama ?? '-'], 
                [`Nama Guru:`, exam.guruNama ?? '-'],
                [`Tipe:`, exam.tipe],
                [`Tanggal Export:`, exportDate],
                [] // Baris kosong
            ];
            
            const dataToExport = [
                ...title,
                header,
                ...body
            ];

            const ws = window.XLSX.utils.aoa_to_sheet(dataToExport);
            
            // --- MODIFIKASI: Lebar kolom (Total 6 kolom) ---
            ws['!cols'] = [
                { wch: 4 },  // A (No)
                { wch: 30 }, // B (Nama Siswa)
                { wch: 20 }, // C (NISN)
                { wch: 10 }, // D (Status)
                { wch: 10 }, // E (Skor PG atau Skor Esai) <-- BARU
                { wch: 20 }  // F (Tanda Tangan)
            ];

            // --- MODIFIKASI: Merge sel (sampai kolom F, index 5) ---
            ws['!merges'] = [
                { s: { r: 0, c: 1 }, e: { r: 0, c: 5 } }, // Judul
                { s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }, // Mapel
                { s: { r: 2, c: 1 }, e: { r: 2, c: 5 } }, // Kelas
                { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } }, // Guru
                { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } }, // Tipe
                { s: { r: 5, c: 1 }, e: { r: 5, c: 5 } }  // Tanggal
            ];
            
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");

            const fileName = `Rekap Nilai - ${exam.mapelNama?.replace(/[^a-z0-9]/gi, '_')} - ${exam.kelasNama?.replace(/[^a-z0-9]/gi, '_')} - ${exam.judul.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
            window.XLSX.writeFile(wb, fileName);
            toast.success("File Excel berhasil dibuat!", { id: "export-toast" });

        } catch (err: any) {
            console.error("Error exporting Excel:", err);
            toast.error(err.message || "Gagal membuat file Excel.", { id: "export-toast" });
        } finally {
            setIsExporting(false);
        }
    };
    
    // --- MODIFIKASI: handleExportPDF ---
    const handleExportPDF = () => {
        if (!librariesLoaded || !window.jspdf) {
            toast.error("Library PDF (jsPDF) belum siap. Coba lagi.");
            return;
        }
        if (!exam) return;

        setIsExporting(true);
        toast.loading("Membuat file PDF...", { id: "export-toast" });

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            if (typeof (doc as any).autoTable !== 'function') {
                throw new Error("Plugin PDF (autoTable) gagal dimuat. Coba refresh halaman.");
            }
            
            const { header, body } = getFormattedData(); // <-- Data sudah kondisional
            const exportDate = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
            
            doc.setFontSize(18);
            doc.text(`Rekap Nilai: ${exam.judul}`, 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100); 
            doc.text(`Mata Pelajaran: ${exam.mapelNama ?? '-'}`, 14, 30);
            doc.text(`Kelas: ${exam.kelasNama ?? '-'}`, 14, 36); 
            doc.text(`Nama Guru: ${exam.guruNama ?? '-'}`, 14, 42); 
            doc.text(`Tipe Ujian: ${exam.tipe}`, 14, 48); 
            doc.text(`Tanggal Export: ${exportDate}`, 14, 54); 
            
            (doc as any).autoTable({
                startY: 60, 
                head: [header], 
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] } 
            });

            const fileName = `Rekap Nilai - ${exam.mapelNama?.replace(/[^a-z0-9]/gi, '_')} - ${exam.kelasNama?.replace(/[^a-z0-9]/gi, '_')} - ${exam.judul.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            doc.save(fileName);
            toast.success("File PDF berhasil dibuat!", { id: "export-toast" });

        } catch (err: any) {
            console.error("Error exporting PDF:", err);
            toast.error(err.message || "Gagal membuat file PDF.", { id: "export-toast" });
        } finally {
            setIsExporting(false);
        }
    };


    if (loading) {
        // ... (render loading tidak berubah)
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat hasil siswa...</span>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/teacher/examsPage')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar Ujian
            </button>

            {error && (
                // ... (render error tidak berubah)
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    {/* ... (render header & tombol export tidak berubah) ... */}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">
                            Hasil Ujian
                        </h1>
                        <p className="text-lg text-gray-600 mt-1">{exam?.judul}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={!librariesLoaded || isExporting || submissions.length === 0}
                            className="flex items-center gap-2 py-2 px-4 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileDown className="w-4 h-4" />
                            Export Excel
                        </button>
                         <button
                            onClick={handleExportPDF}
                            disabled={!librariesLoaded || isExporting || submissions.length === 0}
                            className="flex items-center gap-2 py-2 px-4 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileDown className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>
                </div>
                
                {submissions.length === 0 && !loading && !error && (
                    // ... (render "Belum Ada Hasil" tidak berubah)
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500 border-t mt-4 pt-4">
                        <AlertTriangle className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Hasil</h3>
                        <p className="text-center">Belum ada siswa yang menyelesaikan Ujian ini.</p>
                    </div>
                )}

                {submissions.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Nama Siswa
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Waktu Selesai
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    
                                    {/* --- MODIFIKASI: Kolom Skor Kondisional --- */}
                                    {exam?.tipe === 'Pilihan Ganda'  && (
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Skor PG
                                        </th>
                                    )}
                                    {(exam?.tipe === 'Esai' || exam?.tipe === 'Esai Uraian') && (
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Skor Esai
                                        </th>
                                    )}
                                    {exam?.tipe === 'PG dan Esai' && (
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Nilai Akhir
                                        </th>
                                    )}

                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Detail
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {submissions.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* ... (render nama tidak berubah) ... */}
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{sub.studentName}</div>
                                                    <div className="text-sm text-gray-500">{sub.studentNisn}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* Cek apakah waktu_selesai ada (tidak null) */}
                                            {sub.waktu_selesai ? (
                                                <>
                                                    <div className="text-sm text-gray-900">
                                                        {sub.waktu_selesai.toDate().toLocaleDateString('id-ID', {
                                                            day: '2-digit', month: 'short', year: 'numeric'
                                                        })}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {sub.waktu_selesai.toDate().toLocaleTimeString('id-ID', {
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                // Tampilkan ini jika 'waktu_selesai' masih null
                                                <div className="text-sm text-yellow-600">-</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* ... (render status tidak berubah) ... */}
                                            {sub.status === 'dikerjakan' && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Selesai
                                                </span>
                                            )} 
                                            {sub.status === 'Belum Mengerjakan' && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    Belum Mengerjakan
                                                </span>
                                            )} 
                                            {sub.status === 'Tidak Mengerjakan' && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                    Tidak Mengerjakan
                                                </span>
                                            )} 
                                            {sub.status === 'sedang dikerjakan' && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    Sedang Dikerjakan
                                                </span>
                                            )} 
                                        </td>
                                        
                                        {/* --- MODIFIKASI: Tampilan Skor Kondisional --- */}
                                        {exam?.tipe === 'Pilihan Ganda'  && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="text-lg font-bold text-blue-600">
                                                    {sub.nilai_akhir ?? '-'}
                                                </span>
                                            </td>
                                        )}
                                        {(exam?.tipe === 'Esai' ||exam?.tipe === 'Esai Uraian' ) && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="text-md font-bold text-yellow-600">
                                                    {sub.nilai_esai ?? 'Belum Dinilai'}
                                                </span>
                                            </td>
                                        )}
                                        {exam?.tipe === 'PG dan Esai' && (
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-green-600 text-lg">
                                                <span className="text-sm font-bold text-green-600">
                                                     {sub.nilai_akhir_scaled ?? 'Belum Dinilai'}
                                                </span>
                                               
                                            </td>
                                        )}
                                       
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {/* ... (render link detail tidak berubah) ... */}
                                            {sub.status === 'dikerjakan' && (
                                                <Link 
                                                href={`/teacher/examsPage/${examId}/results/${sub.id}`}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Lihat Detail Jawaban
                                            </Link>
                                            )}
                                            {(sub.status === 'Belum Mengerjakan' || sub.status === 'sedang dikerjakan')  && (
                                               <span className="text-gray-400 cursor-not-allowed" title="Siswa belum menyelesaikan ujian">{sub.status === 'sedang dikerjakan' ? '(Sedang dikerjakan)' : '(Belum dikerjakan)'}</span>
                                            )}
                                            {sub.status === 'Tidak Mengerjakan'  && (
                                                <button
                                                    onClick={() => handleCreateManualSubmission(sub.student_ref, sub.id)}
                                                    disabled={isCreatingSubmission}
                                                    className="text-green-600 hover:text-green-900 disabled:opacity-50">
                                                    Beri Nilai Manual
                                                </button>
                                            )}
                                            

                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExamResultsPage;

