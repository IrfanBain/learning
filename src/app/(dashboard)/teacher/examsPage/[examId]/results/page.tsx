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
    DocumentReference
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

// Tipe untuk data Latihan (Exam)
interface ExamData {
    judul: string;
    tipe: string;
    mapel_ref: DocumentReference;
    guru_ref: DocumentReference;
    kelas_ref: DocumentReference;
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
    waktu_selesai: Timestamp;
    studentName?: string;
    studentNisn?: string;
}

// Helper function (tidak berubah)
const getRefName = async (ref: DocumentReference, fieldName: string) => {
    try {
        const docSnap = await getDoc(ref);
        if (docSnap.exists()) {
            return docSnap.data()[fieldName] || "N/A";
        }
    } catch (e) { console.warn("Failed to get ref name", e); }
    return "N/A";
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
                throw new Error("Latihan tidak ditemukan.");
            }
            const examData = examSnap.data() as ExamData;

            const [mapelNama, guruNama, kelasSnap] = await Promise.all([
                getRefName(examData.mapel_ref, 'nama_mapel'), 
                getRefName(examData.guru_ref, 'nama_lengkap'),
                getDoc(examData.kelas_ref) 
            ]);
            
            const kls = kelasSnap.exists() ? kelasSnap.data() : null;
            const kelasNama = kls ? `${kls.tingkat || ''} ${kls.nama_kelas || 'N/A'}`.trim() : "N/A";

            setExam({ ...examData, mapelNama, guruNama, kelasNama }); 

            const submissionsQuery = query(
                collection(db, "students_answers"),
                where("latihan_ref", "==", examRef)
            );

            const submissionsSnapshot = await getDocs(submissionsQuery);
            if (submissionsSnapshot.empty) {
                setSubmissions([]);
                setLoading(false);
                return;
            }

            const submissionsPromises = submissionsSnapshot.docs.map(async (subDoc) => {
                const subData = subDoc.data() as SubmissionData;
                
                let studentName = "Siswa (Ref. Error)";
                let studentNisn = ""; 

                try {
                    const studentSnap = await getDoc(subData.student_ref);
                    if (studentSnap.exists()) {
                        studentName = studentSnap.data().nama_lengkap || studentSnap.data().displayName || "Siswa Tanpa Nama";
                        studentNisn = studentSnap.data().nisn || "";
                    } else {
                        studentName = "Siswa (Telah Dihapus)";
                    }
                } catch (err) {
                    console.error("Error fetching student ref:", err);
                }

                return {
                    ...subData,
                    id: subDoc.id,
                    studentName,
                    studentNisn,
                };
            });

            const combinedSubmissions = await Promise.all(submissionsPromises);
            
            combinedSubmissions.sort((a, b) => (b.nilai_akhir || 0) - (a.nilai_akhir || 0));

            setSubmissions(combinedSubmissions);

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

    useEffect(() => {
        fetchResultsData();
    }, [fetchResultsData]);

    // --- MODIFIKASI: getFormattedData ---
    const getFormattedData = () => {
        if (!exam) return { header: [], body: [] }; // Kembalikan array kosong jika exam belum load

        const isPG = exam.tipe === 'Pilihan Ganda';
        const isEsai = exam.tipe === 'Esai';

        // Buat header dinamis
        let header = ["No", "Nama Siswa", "NISN", "Status"];
        if (isPG) header.push("Skor PG");
        if (isEsai) header.push("Skor Esai");
        header.push("Tanda Tangan");
        
        // Buat body dinamis
        const body = submissions.map((sub, index) => {
            let row: (string | number | null)[] = [
                index + 1,
                sub.studentName || '',
                sub.studentNisn || '',
                sub.status === 'dikerjakan' ? 'Selesai' : sub.status,
            ];
            
            if (isPG) row.push(sub.nilai_akhir ?? 'N/A');
            if (isEsai) row.push(sub.nilai_esai ?? 'N/A');
            
            row.push(""); // Kolom Tanda Tangan
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
                [`Judul Latihan:`, exam.judul],
                [`Mata Pelajaran:`, exam.mapelNama ?? 'N/A'],
                [`Kelas:`, exam.kelasNama ?? 'N/A'], 
                [`Nama Guru:`, exam.guruNama ?? 'N/A'],
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
            doc.text(`Mata Pelajaran: ${exam.mapelNama ?? 'N/A'}`, 14, 30);
            doc.text(`Kelas: ${exam.kelasNama ?? 'N/A'}`, 14, 36); 
            doc.text(`Nama Guru: ${exam.guruNama ?? 'N/A'}`, 14, 42); 
            doc.text(`Tipe Latihan: ${exam.tipe}`, 14, 48); 
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
                Kembali ke Daftar Latihan
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
                            Hasil Latihan
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
                        <p className="text-center">Belum ada siswa yang menyelesaikan latihan ini.</p>
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
                                    {exam?.tipe === 'Pilihan Ganda' && (
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Skor PG
                                        </th>
                                    )}
                                    {exam?.tipe === 'Esai' && (
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Skor Esai
                                        </th>
                                    )}
                                    
                                    <th scope="col" className="relative px-6 py-3">
                                        <span className="sr-only">Detail</span>
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
                                                <div className="text-sm text-yellow-600">Masih Mengerjakan</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* ... (render status tidak berubah) ... */}
                                            {sub.status === 'dikerjakan' ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Selesai
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    {sub.status}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* --- MODIFIKASI: Tampilan Skor Kondisional --- */}
                                        {exam?.tipe === 'Pilihan Ganda' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="text-lg font-bold text-blue-600">
                                                    {sub.nilai_akhir ?? '-'}
                                                </span>
                                            </td>
                                        )}
                                        {exam?.tipe === 'Esai' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="text-lg font-bold text-green-600">
                                                    {sub.nilai_esai ?? 'Belum Dinilai'}
                                                </span>
                                            </td>
                                        )}

                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {/* ... (render link detail tidak berubah) ... */}
                                            <Link 
                                                href={`/teacher/examsPage/${examId}/results/${sub.id}`}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Lihat Detail Jawaban
                                            </Link>
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

