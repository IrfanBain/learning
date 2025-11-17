"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // <-- Import useMemo
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebaseConfig'; 
import { 
    collection, 
    query, 
    getDocs, 
    doc, 
    getDoc, 
    deleteDoc,
    DocumentReference,
    Timestamp,
    orderBy 
} from 'firebase/firestore'; 
import { 
    List, 
    Clock, 
    XCircle, 
    ChevronRight, 
    Loader2, 
    FileText, 
    AlertTriangle,
    Trash2, 
    Eye,
    Shield,
    Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// --- DEFINISI TIPE ---

// --- BARU: Tipe untuk dropdown ---
interface DropdownItem {
    id: string;
    nama: string;
}

// Tipe untuk dokumen 'exams' dari Firestore
interface ExamDoc {
    id: string;
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)";
    mapel_ref: DocumentReference;
    kelas_ref: DocumentReference;
    guru_ref: DocumentReference;
    tanggal_dibuat: Timestamp;
    tanggal_selesai: Timestamp;
    status: "Draft" | "Dipublikasi" | "Ditutup";
    // Data yang sudah digabung untuk ditampilkan
    mapelNama?: string;
    kelasNama?: string;
    guruNama?: string; 
}

// --- KOMPONEN UTAMA ---

const AdminExamPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [examList, setExamList] = useState<ExamDoc[]>([]); // Ini akan jadi list utama

    // --- BARU: State untuk filter ---
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [selectedMapel, setSelectedMapel] = useState<string>("all");
    const [selectedKelas, setSelectedKelas] = useState<string>("all");


    // --- BARU: Fungsi untuk mengambil data filter dropdown ---
    const fetchDropdownData = useCallback(async () => {
        try {
            // Ambil Mata Pelajaran
            const mapelQuery = query(collection(db, "subjects"));
            const mapelSnapshot = await getDocs(mapelQuery);
            const mapelData = mapelSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            setAvailableMapel(mapelData);

            // Ambil Kelas
            const kelasQuery = query(collection(db, "classes"));
            const kelasSnapshot = await getDocs(kelasQuery);
            const kelasData = kelasSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            setAvailableKelas(kelasData);
        } catch (err: any) {
            console.error("Error fetching dropdown data:", err);
            toast.error("Gagal memuat data filter mapel & kelas.");
        }
    }, []);

    // Fungsi untuk mengambil *SEMUA* latihan (tidak berubah)
    const fetchExamList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const q = query(
                collection(db, "exams"), 
                orderBy("tanggal_dibuat", "desc") 
            );
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setExamList([]);
                setLoading(false);
                return;
            }

            const examsPromise = querySnapshot.docs.map(async (examDoc) => {
                const examData = examDoc.data() as Omit<ExamDoc, 'id'>;
                
                let mapelNama = "N/A";
                let kelasNama = "N/A";
                let guruNama = "N/A"; 

                const getRefName = async (ref: DocumentReference, field: string) => {
                    try {
                        if (ref) {
                            const snap = await getDoc(ref);
                            return snap.data()?.[field] || "Ref. Dihapus";
                        }
                    } catch (e) { /* Biarkan N/A */ }
                    return "Ref. Error";
                }

                const [mapel, klsSnap, guru] = await Promise.all([
                    getRefName(examData.mapel_ref, 'nama_mapel'),
                    getDoc(examData.kelas_ref), 
                    getRefName(examData.guru_ref, 'nama_lengkap') 
                ]);

                mapelNama = mapel;
                guruNama = guru;
                if (klsSnap.exists()) {
                    const kls = klsSnap.data();
                    kelasNama = `${kls?.tingkat || ''} ${kls?.nama_kelas || 'Kelas Dihapus'}`.trim();
                } else {
                    kelasNama = "Ref. Error";
                }

                return {
                    ...examData,
                    id: examDoc.id,
                    mapelNama,
                    kelasNama,
                    guruNama, 
                };
            });

            const combinedExams = await Promise.all(examsPromise);
            setExamList(combinedExams as ExamDoc[]);

        } catch (err: any) {
            console.error("Error fetching all exams:", err);
            let userMessage = "Gagal memuat daftar Ujian. ";
            if (err.code === 'permission-denied') {
                userMessage += "Izin ditolak. Pastikan Anda login sebagai Admin.";
            } else if (err.code === 'failed-precondition') {
                userMessage += "Indeks Firestore diperlukan. Cek konsol (F12) untuk link membuat indeks 'tanggal_dibuat'.";
            } else {
                userMessage += err.message;
            }
            setError(userMessage);
            toast.error(userMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- MODIFIKASI: Effect utama ---
    useEffect(() => {
        fetchExamList();
        fetchDropdownData(); // <-- Panggil fungsi data dropdown
    }, [fetchExamList, fetchDropdownData]); // <-- Tambah dependensi


    // Handler Hapus (tidak berubah)
    const executeDelete = async (examId: string, title: string) => {
        const loadingToastId = toast.loading(`Menghapus Ujian "${title}"...`);
        try {
            await deleteDoc(doc(db, "exams", examId));
            
            toast.success("Ujian berhasil dihapus.", { id: loadingToastId });
            fetchExamList(); 
            
        } catch (err: any) {
            console.error("Error deleting exam:", err);
            toast.error(err.message || "Gagal menghapus Ujian.", { id: loadingToastId });
        }
    };

    const handleDeleteExam = (examId: string, title: string) => {
        // (Fungsi ini tidak berubah)
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Hapus Ujian Ini?</p>
                        <p className="text-sm text-gray-600">
                            Anda akan menghapus <span className="font-bold">{title}</span>. Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <p className="text-xs text-red-600 mt-2">
                            Catatan: Ini mungkin tidak menghapus data soal atau jawaban siswa yang terkait secara otomatis.
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
                            executeDelete(examId, title); 
                        }}
                        className="py-1.5 px-3 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                    >
                        Ya, Hapus
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    // --- BARU: Memoize list yang difilter ---
    const filteredExamList = useMemo(() => {
        // Mulai dengan semua data
        return examList.filter(exam => {
            // Cek filter mapel
            const mapelMatch = selectedMapel === "all" || exam.mapel_ref?.id === selectedMapel;
            // Cek filter kelas
            const kelasMatch = selectedKelas === "all" || exam.kelas_ref?.id === selectedKelas;
            
            // Kembalikan true hanya jika kedua filter cocok (atau "all")
            return mapelMatch && kelasMatch;
        });
    }, [examList, selectedMapel, selectedKelas]);


    // --- TAMPILAN (RENDER) ---
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* Header Halaman */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Manajemen Ujian (Admin)</h1>
            </div>

            {/* Konten Error Global */}
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* --- MODIFIKASI: Tampilan Daftar Latihan --- */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-gray-800">Semua Ujian ({filteredExamList.length})</h2>
                    
                    {/* --- BARU: Filter Dropdowns --- */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={selectedMapel}
                            onChange={(e) => setSelectedMapel(e.target.value)}
                            className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="all">Semua Mata Pelajaran</option>
                            {availableMapel.map(mapel => (
                                <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
                            ))}
                        </select>
                        <select
                            value={selectedKelas}
                            onChange={(e) => setSelectedKelas(e.target.value)}
                            className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                            <option value="all">Semua Kelas</option>
                            {availableKelas.map(kelas => (
                                <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat semua Ujian...</span>
                    </div>
                // --- MODIFIKASI: Cek filteredExamList.length ---
                ) : filteredExamList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <FileText className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Tidak Ada Ujian</h3>
                        {/* --- BARU: Pesan dinamis --- */}
                        <p className="text-center">
                            {examList.length > 0 ? "Tidak ada Ujian yang cocok dengan filter Anda." : "Belum ada guru yang membuat Ujian."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* --- MODIFIKASI: Render filteredExamList --- */}
                        {filteredExamList.map(exam => (
                            <AdminExamListItem 
                                key={exam.id} 
                                exam={exam} 
                                onDelete={handleDeleteExam}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- KOMPONEN PENDUKUNG ---
// (Tidak ada perubahan di AdminExamListItem)
const AdminExamListItem = ({ exam, onDelete }: { exam: ExamDoc, onDelete: (id: string, title: string) => void }) => {
    
    const getStatusChip = (status: string) => {
        switch (status) {
            case 'Dipublikasi':
                return <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{status}</span>;
            case 'Draft':
                return <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{status}</span>;
            case 'Ditutup':
                return <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{status}</span>;
            default:
                return <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">{status}</span>;
        }
    };
    
    const deadline = exam.tanggal_selesai ? (exam.tanggal_selesai as Timestamp).toDate().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'N/A';


    return (
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition-all">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                    {exam.tipe === 'Pilihan Ganda' && <List className="w-6 h-6 text-blue-500" />}
                    {exam.tipe === 'Esai' && <FileText className="w-6 h-6 text-green-500" />}
                    {exam.tipe === 'Tugas (Upload File)' && <FileText className="w-6 h-6 text-purple-500" />}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{exam.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span className="font-medium text-blue-600">{exam.guruNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{exam.mapelNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{exam.kelasNama}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {getStatusChip(exam.status)}
                
                {/* --- MODIFIKASI: Buka di tab baru --- */}
                <Link 
                    href={`/teacher/examsPage/${exam.id}`} 
                    title="Lihat Detail Soal (Buka di tab baru)"
                    target="_blank" // <-- BARU
                    rel="noopener noreferrer" // <-- BARU
                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-gray-100"
                >
                    <Eye className="w-4 h-4" />
                </Link>

                {/* --- MODIFIKASI: Buka di tab baru --- */}
                {(exam.status === 'Dipublikasi' || exam.status === 'Ditutup') && (
                     <Link 
                        href={`/teacher/examsPage/${exam.id}/results`}
                        title="Lihat Hasil Siswa (Buka di tab baru)" 
                        target="_blank" // <-- BARU
                        rel="noopener noreferrer" // <-- BARU
                        className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800 font-medium py-1 px-2 rounded-md hover:bg-green-50"
                    >
                        <Award className="w-4 h-4" />
                    </Link>
                )}
               
                {/* <button 
                    onClick={() => onDelete(exam.id, exam.judul)}
                    title="Hapus Ujian Ini"
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium py-1 px-2 rounded-md hover:bg-red-50"
                >
                    <Trash2 className="w-4 h-4" />
                </button> */}
            </div>
        </div>
    );
};

export default AdminExamPage;


