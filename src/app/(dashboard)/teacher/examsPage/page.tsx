"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext'; // <-- Impor ASLI
import { db } from '@/lib/firebaseConfig'; // <-- Impor ASLI
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    addDoc, 
    serverTimestamp, 
    DocumentReference,
    Timestamp,
    updateDoc,
    deleteDoc,
    writeBatch
} from 'firebase/firestore'; // <-- Impor ASLI

// Import ikon-ikon
import { PlusSquare, Trash2, Edit2, List, CheckCircle, Clock, XCircle, ChevronRight, Loader2, FileText, AlertTriangle, Award } from 'lucide-react';
import { toast } from 'react-hot-toast'; // <-- Asumsi Anda pakai 'sonner' untuk notifikasi
import Link from 'next/link';

// --- DEFINISI TIPE & DATA ---

// Tipe untuk dropdown
interface DropdownItem {
    id: string;
    nama: string;
}

// Tipe untuk dokumen 'exams' dari Firestore
interface ExamDoc {
    id: string;
    judul: string;
    deskripsi: string;
    tipe: "Pilihan Ganda" | "Esai" | "Esai Uraian" | "PG dan Esai";
    mapel_ref: DocumentReference;
    kelas_ref: DocumentReference;
    guru_ref: DocumentReference;
    tanggal_dibuat: Timestamp;
    tanggal_selesai: Timestamp;
    status: "Draft" | "Dipublikasi" | "Ditutup";
    // Data yang sudah digabung untuk ditampilkan
    mapelNama?: string;
    kelasNama?: string;
}

// Tipe untuk data formulir
type ExamFormData = {
    judul: string;
    deskripsi: string;
    tipe: "Pilihan Ganda" | "Esai" | "Esai Uraian" | "PG dan Esai";
    mapel_ref: string; // Akan menyimpan ID (string) dari dropdown
    kelas_ref: string; // Akan menyimpan ID (string) dari dropdown
    tanggal_selesai: string; // Akan menyimpan string tanggal-waktu
    durasi_menit: number;
}

const initialFormData: ExamFormData = {
    judul: "",
    deskripsi: "",
    tipe: "PG dan Esai",
    mapel_ref: "",
    kelas_ref: "",
    tanggal_selesai: "",
    durasi_menit: 60,
};

// --- KOMPONEN UTAMA ---

const TeacherExamPage = () => {
    const { user, loading: authLoading } = useAuth();
    
    // State untuk UI
    const [view, setView] = useState<'list' | 'create'>('list'); // Tampilan 'Daftar' or 'Buat Baru'
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // State untuk Data
    const [examList, setExamList] = useState<ExamDoc[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [formData, setFormData] = useState<ExamFormData>(initialFormData);
    const [editingExamId, setEditingExamId] = useState<string | null>(null);

    // --- PENGAMBILAN DATA (FETCHING) ---

    // Fungsi untuk mengambil data Mapel & Kelas (untuk dropdown)
    const fetchDropdownData = useCallback(async () => {
        // Hanya fetch jika data belum ada
        if (availableMapel.length > 0 && availableKelas.length > 0) return;

        try {
            // Ambil Mata Pelajaran
            const mapelQuery = query(collection(db, "subjects")); // Asumsi nama koleksi 'subjects'
            const mapelSnapshot = await getDocs(mapelQuery);
            const mapelData = mapelSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            setAvailableMapel(mapelData);

            // Ambil Kelas
            const kelasQuery = query(collection(db, "classes")); // Asumsi nama koleksi 'classes'
            const kelasSnapshot = await getDocs(kelasQuery);
            const kelasData = kelasSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            setAvailableKelas(kelasData);

        } catch (err: any) {
            console.error("Error fetching dropdown data:", err);
            setError("Gagal memuat data mapel & kelas. " + err.message);
            toast.error("Gagal memuat data mapel & kelas.");
        }
    }, [availableMapel, availableKelas]); // Dependensi agar tidak fetch ulang

    // Fungsi untuk mengambil daftar Ujian yang sudah ada
    const fetchExamList = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        try {
            const guruRef = doc(db, "teachers", userUid);
            const q = query(
                collection(db, "exams"), 
                where("guru_ref", "==", guruRef)
            );
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setExamList([]);
                setLoading(false);
                return;
            }

            // Ambil data referensi (mapel & kelas) secara paralel
            const examsPromise = querySnapshot.docs.map(async (examDoc) => {
                const examData = examDoc.data() as ExamDoc;
                
                let mapelNama = "N/A";
                let kelasNama = "N/A";

                try {
                    if (examData.mapel_ref) {
                        const mapelSnap = await getDoc(examData.mapel_ref);
                        mapelNama = mapelSnap.data()?.nama_mapel || "Mapel Dihapus";
                    }
                } catch (e) { mapelNama = "Ref. Error"; }
                
                try {
                    if (examData.kelas_ref) {
                        const kelasSnap = await getDoc(examData.kelas_ref);
                        const kls = kelasSnap.data();
                        kelasNama = `${kls?.tingkat || ''} ${kls?.nama_kelas || 'Kelas Dihapus'}`.trim();
                    }
                } catch (e) { kelasNama = "Ref. Error"; }


                return {
                    ...examData,
                    id: examDoc.id,
                    mapelNama,
                    kelasNama,
                };
            });

            const combinedExams = await Promise.all(examsPromise);
            combinedExams.sort((a, b) => {
                const statusOrder = { "Draft": 1, "Dipublikasi": 2, "Ditutup": 3 };
                const dateA = a.tanggal_dibuat?.toDate() || new Date(0);
                const dateB = b.tanggal_dibuat?.toDate() || new Date(0);

                // Sort by status first
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status];
                }
                // If status is same, sort by newest date first
                return dateB.getTime() - dateA.getTime();
            });
            setExamList(combinedExams);

        } catch (err: any) {
            console.error("Error fetching exam list:", err);
            setError("Gagal memuat daftar Ujian. " + err.message);
            if (err.code === 'permission-denied') {
                setError("Gagal memuat: Periksa Security Rules untuk koleksi 'exams'.");
            }
            toast.error("Gagal memuat daftar Ujian.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect utama: Ambil semua data saat komponen dimuat
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchExamList(user.uid);
            fetchDropdownData(); // Panggil juga data dropdown
        }
        
        if (!user && !authLoading) {
            setLoading(false);
            setError("User tidak ditemukan, silakan login.");
        }

    }, [user, authLoading, fetchExamList, fetchDropdownData]);


    // --- HANDLER UNTUK FORMULIR ---

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'durasi_menit' ? parseInt(value) : value
        }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("Anda harus login untuk membuat Ujian.");
            return;
        }

        setFormLoading(true);
        try {
            // Validasi sederhana
            if (!formData.judul || !formData.mapel_ref || !formData.kelas_ref || !formData.tanggal_selesai) {
                throw new Error("Judul, Mapel, Kelas, dan Tanggal Selesai wajib diisi.");
            }

            // Siapkan data untuk disimpan
        const examDataToSave = {
        judul: formData.judul,
        deskripsi: formData.deskripsi,
        tipe: formData.tipe,
        mapel_ref: doc(db, "subjects", formData.mapel_ref),
        kelas_ref: doc(db, "classes", formData.kelas_ref),
        guru_ref: doc(db, "teachers", user.uid),
        tanggal_selesai: Timestamp.fromDate(new Date(formData.tanggal_selesai)),
        durasi_menit: formData.durasi_menit,
      };

      // --- MODIFIKASI: Cek apakah ini EDIT atau CREATE ---
      if (editingExamId) {
        // --- LOGIKA UPDATE (EDIT) ---
        const examRef = doc(db, "exams", editingExamId);
        await updateDoc(examRef, {
          ...examDataToSave
          // Kita tidak mengubah status atau jumlah_soal saat mengedit
        });
        
        toast.success("Info Ujian Berhasil Diperbarui!");
        // Tidak perlu router.push, cukup kembali ke list
        setEditingExamId(null);
        setFormData(initialFormData);
        setView('list');
        fetchExamList(user.uid); // Refresh data list

      } else {
        // --- LOGIKA CREATE (YANG SUDAH ADA) ---
        const examDataToCreate = {
          ...examDataToSave,
          tanggal_dibuat: serverTimestamp(),
          tanggal_mulai: serverTimestamp(),
          status: "Draft", 
          jumlah_soal: 0, 
        };
        
        const docRef = await addDoc(collection(db, "exams"), examDataToCreate);
            
            toast.success("Info Ujian Berhasil Disimpan!", {
                duration: 3000, // 2 detik
            });
            setTimeout(() => {
                router.push(`/teacher/examsPage/${docRef.id}`);
            }, 1000);
        } 
    }
    catch (err: any) {
            console.error("Error creating exam:", err);
            toast.error(err.message || "Gagal menyimpan Ujian.");
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    // --- BARU: Fungsi untuk mengeksekusi penghapusan ---
const executeDeleteExam = async (examId: string, examJudul: string) => {
const loadingToastId = toast.loading(`Menghapus "${examJudul}" dan semua soalnya...`);

try {
const examRef = doc(db, "exams", examId);

// 1. Hapus semua soal di dalam sub-koleksi "soal"
const soalCollectionRef = collection(db, "exams", examId, "soal");
const soalSnap = await getDocs(soalCollectionRef);

if (!soalSnap.empty) {
// console.log(`Menghapus ${soalSnap.size} soal dari sub-koleksi...`);
const batch = writeBatch(db);
soalSnap.docs.forEach(soalDoc => {
batch.delete(soalDoc.ref);
});
 await batch.commit();
 }

 // 2. Setelah soal terhapus, hapus dokumen ujian utama
 await deleteDoc(examRef);

 // 3. Refresh daftar ujian di UI
 toast.success(`Ujian "${examJudul}" berhasil dihapus.`, { id: loadingToastId });
 if(user) fetchExamList(user.uid); // Panggil ulang fetch

 } catch (err: any) {
 console.error("Error deleting exam:", err);
 toast.error(err.message || "Gagal menghapus ujian.", { id: loadingToastId });
 }
};

// --- BARU: Fungsi konfirmasi sebelum hapus ---
 const handleDeleteExam = (examId: string, examJudul: string) => {
 // Tampilkan toast konfirmasi
 toast(
(t) => ( 
<div className="flex flex-col gap-3 p-2">
<div className="flex items-center gap-2">
<AlertTriangle className="w-6 h-6 text-red-500" />
<p className="font-semibold text-gray-900">
 Hapus Ujian Ini?
</p>
</div>
<p className="text-sm text-gray-600">
 Anda yakin ingin menghapus <strong>{examJudul}</strong>?
 <br/>Semua soal di dalamnya juga akan terhapus.
</p>
<div className="flex gap-2 justify-end">
 <button
className="py-1.5 px-3 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
onClick={() => toast.dismiss(t.id)} >
 Batal
 </button>
<button
className="py-1.5 px-3 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
onClick={() => {
toast.dismiss(t.id); 
 executeDeleteExam(examId, examJudul); 
}} >
 Ya, Hapus
</button>
</div>
</div>
 ),
{ duration: 6000, position: "top-center" }
 );
};

const handleCancelEdit = () => {
    setEditingExamId(null);  // Hapus ID yang diedit
    setFormData(initialFormData); // Kosongkan form
    setView('list');      // Kembali ke daftar
  };

  // --- MODIFIKASI: Fungsi untuk menangani klik edit ---
  const handleEditExam = (exam: ExamDoc) => {
    // 1. Cek status (sesuai permintaan Anda)
    if (exam.status !== 'Draft') {
      toast.error("Harap kembalikan Ujian ke status 'Draft' terlebih dahulu untuk mengedit.", {
        icon: <AlertTriangle className="text-red-500" />
      });
      return; // Hentikan fungsi
    }

    // 2. Jika 'Draft', siapkan form untuk diedit
//     console.log("Mengedit:", exam);
   
    // 3. Konversi Timestamp ke string YYYY-MM-DDTHH:MM
    const deadlineString = exam.tanggal_selesai.toDate().toISOString().slice(0, 16);
   
    // 4. Isi state form dengan data ujian yang ada
    setFormData({
      judul: exam.judul,
      deskripsi: exam.deskripsi,
      tipe: exam.tipe,
      mapel_ref: exam.mapel_ref.id, // Simpan ID-nya saja
      kelas_ref: exam.kelas_ref.id, // Simpan ID-nya saja
      tanggal_selesai: deadlineString,
      // durasi_menit mungkin tidak ada di ExamDoc, tambahkan jika perlu
      durasi_menit: (exam as any).durasi_menit || 60 
    });
   
    // 5. Set ID ujian yang sedang diedit
    setEditingExamId(exam.id);
   
    // 6. Pindahkan view ke form
    setView('create');
  };

    // --- TAMPILAN (RENDER) ---
return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            
            {/* Header Halaman */}
            {/* RESPONSIF: Dibuat flex-col di HP, dan sm:flex-row di layar lebih besar */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0">
                {/* RESPONSIF: Ukuran font diubah di HP */}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manajemen Ujian</h1>
                
                {/* Tombol Ganti Tampilan */}
                {/* RESPONSIF: Dibuat flex-col di HP, dan sm:flex-row di layar lebih besar */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setView('list')}
                        // RESPONSIF: Tambahkan w-full sm:w-auto dan justify-center
                        className={`flex items-center justify-center sm:justify-start gap-2 py-2 px-4 rounded-lg transition-all w-full sm:w-auto ${
                            view === 'list' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                    >
                        <List className="w-5 h-5" />
                        <span>Daftar Ujian</span>
                    </button>
                    <button
                        onClick={() => setView('create')}
                        // RESPONSIF: Tambahkan w-full sm:w-auto dan justify-center
                        className={`flex items-center justify-center sm:justify-start gap-2 py-2 px-4 rounded-lg transition-all w-full sm:w-auto ${
                            view === 'create' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                    >
                        {editingExamId ? (
              <Edit2 className="w-5 h-5" />
            ) : (
              <PlusSquare className="w-5 h-5" />
            )}
            
            {/* --- BARU: Teks Dinamis --- */}
            <span>
              {editingExamId ? "Edit Ujian" : "Buat Ujian Baru"}
            </span>
                    </button>
                </div>
            </div>

            {/* Konten Error Global */}
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Tampilan Daftar Ujian */}
            {view === 'list' && (
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Daftar Ujian Dibuat</h2>
                    {loading ? (
                        <div className="flex justify-center items-center h-60">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-gray-600">Memuat data Ujian...</span>
                        </div>
                    ) : examList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                            <FileText className="w-16 h-16 text-gray-300" />
                            <h3 className="text-xl font-semibold mt-4">Belum Ada Ujian</h3>
                            <p className="text-center">Klik tombol Buat Ujian Baru untuk memulai.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {examList.map(exam => (
                                <ExamListItem key={exam.id} exam={exam} onDelete={handleDeleteExam} onEdit={handleEditExam} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tampilan Form Buat Ujian Baru */}
            {view === 'create' && (
                // (Form ini sudah responsif karena menggunakan md:grid-cols-2)
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">{editingExamId ? "Edit Informasi Ujian" : "Buat Ujian Baru (Informasi Umum)"}</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        <AlertTriangle className="w-4 h-4 inline-block mr-2 text-yellow-500" />
                        Anda akan membuat sampul Ujiannya terlebih dahulu. Soal-soal akan ditambahkan di langkah berikutnya (di halaman kelola soal).
                    </p>
                    
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Kolom Kiri */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul Ujian <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        id="judul"
                                        name="judul"
                                        value={formData.judul}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Contoh: Ujian tengah semester matematika"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="tipe" className="block text-sm font-medium text-gray-700 mb-1">Tipe Ujian <span className="text-red-500">*</span></label>
                                    <select
                                        id="tipe"
                                        name="tipe"
                                        value={formData.tipe}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        required
                                        disabled={!!editingExamId}
                                    >
                                        <option value="PG dan Esai">PG dan Esai</option>
                                        <option value="Pilihan Ganda">Pilihan Ganda</option>
                                        <option value="Esai">Esai</option>
                                        <option value="Esai Uraian">Esai Uraian</option>
                                        {/* <option value="Tugas (Upload File)">Tugas (Upload File)</option> */}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi / Petunjuk</label>
                                    <textarea
                                        id="deskripsi"
                                        name="deskripsi"
                                        value={formData.deskripsi}
                                        onChange={handleFormChange}
                                        rows={5}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Tuliskan petunjuk pengerjaan atau deskripsi singkat di sini..."
                                    ></textarea>
                                </div>
                            </div>

                            {/* Kolom Kanan */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="mapel_ref" className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran <span className="text-red-500">*</span></label>
                                    <select
                                        id="mapel_ref"
                                        name="mapel_ref"
                                        value={formData.mapel_ref}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="" disabled>-- Pilih Mata Pelajaran --</option>
                                        {availableMapel.map(mapel => (
                                            <option key={mapel.id} value={mapel.id}>{mapel.nama}</option>
                                        ))}
                                    </select>
                                </div>
                                 <div>
                                    <label htmlFor="kelas_ref" className="block text-sm font-medium text-gray-700 mb-1">Target Kelas <span className="text-red-500">*</span></label>
                                    <select
                                        id="kelas_ref"
                                        name="kelas_ref"
                                        value={formData.kelas_ref}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="" disabled>-- Pilih Kelas --</option>
                                         {availableKelas.map(kelas => (
                                            <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="tanggal_selesai" className="block text-sm font-medium text-gray-700 mb-1">Batas Akhir Pengerjaan (Deadline) <span className="text-red-500">*</span></label>
                                    <input
                                        type="datetime-local"
                                        id="tanggal_selesai"
                                        name="tanggal_selesai"
                                        value={formData.tanggal_selesai}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="durasi_menit" className="block text-sm font-medium text-gray-700 mb-1">Durasi Pengerjaan (Menit) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        id="durasi_menit"
                                        name="durasi_menit"
                                        value={formData.durasi_menit}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Contoh: 90"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Isi 0 jika tidak ada batas waktu.</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Tombol Aksi */}
            <div className="flex justify-end gap-3 items-center pt-4">
              {/* Tombol Batal (Hanya muncul saat edit) */}
              {editingExamId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="py-2 px-5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Batal 
                </button>
              )} 

              {/* Tombol Simpan (Dinamis) */}
              <button
                type="submit"
                disabled={formLoading}
                className="flex items-center justify-center gap-2 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 w-full sm:w-auto"
              >
                {formLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                <span>{editingExamId ? "Simpan Perubahan" : "Simpan & Lanjut Tambah Soal"}</span>
             </button>
            </div>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- KOMPONEN PENDUKUNG ---

// Komponen kecil untuk menampilkan satu item Ujian di daftar
const ExamListItem = ({ exam, onDelete, onEdit }: { exam: ExamDoc, onDelete: (examId: string, examJudul: string) => void, onEdit: (exam: ExamDoc) => void }) => {
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
        // RESPONSIF: Dibuat flex-col di HP, sm:flex-row di layar lebih besar, items-start di HP
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between hover:bg-gray-50 transition-all">
            {/* RESPONSIF: Dibuat w-full agar memenuhi container di HP */}
            <div className="flex items-center gap-4 w-full">
                {/* Ikon Tipe */}
                <div className="flex-shrink-0">
                    {exam.tipe === 'PG dan Esai' && <FileText className="w-6 h-6 text-yellow-500" />}
                    {exam.tipe === 'Pilihan Ganda' && <List className="w-6 h-6 text-blue-500" />}
                    {exam.tipe === 'Esai' && <FileText className="w-6 h-6 text-green-500" />}
                    {exam.tipe === 'Esai Uraian' && <FileText className="w-6 h-6 text-purple-500" />}
                    {/* {exam.tipe === 'Tugas (Upload File)' && <FileText className="w-6 h-6 text-purple-500" />} */}
                </div>
                {/* Info */}
                {/* RESPONSIF: Dibuat w-full agar mengambil sisa ruang */}
                <div className="w-full">
                    {/* RESPONSIF: Ukuran font diubah di HP */}
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">{exam.judul}</h3>
                    {/* RESPONSIF: Dibuat flex-col di HP, sm:flex-row di layar lebih besar, items-start di HP */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4 text-sm text-gray-600 mt-1">
                        <span>{exam.mapelNama}</span>
                        {/* RESPONSIF: Sembunyikan pembatas di HP */}
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{exam.kelasNama}</span>
                        {/* RESPONSIF: Sembunyikan pembatas di HP */}
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {deadline}
                        </span>
                    </div>
                </div>
            </div>
            {/* Aksi & Status */}
            {/* RESPONSIF: Dibuat flex-col di HP, sm:flex-row, w-full, dan diberi batas atas di HP */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                {getStatusChip(exam.status)}
                
                {(exam.status === 'Dipublikasi' || exam.status === 'Ditutup') && (
                     <Link 
                        href={`/teacher/examsPage/${exam.id}/results`} 
                        // RESPONSIF: Dibuat w-full di HP
                        className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-green-600 hover:text-green-800 font-medium py-1 px-2 rounded-md hover:bg-green-50 w-full sm:w-auto"
                    >
                        <Award className="w-4 h-4" />
                        Lihat Hasil
                    </Link>
                )}
                <Link 
                    href={`/teacher/examsPage/${exam.id}`} // <-- Path dinamis
                    // RESPONSIF: Dibuat w-full di HP
                    className="flex items-center justify-center sm:justify-start gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium w-full sm:w-auto"
                >
                    Kelola Soal <ChevronRight className="w-4 h-4" />
                </Link>
                {/* --- GRUP TOMBOL AKSI (EDIT & HAPUS) --- */}
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          {/* Tombol Edit Baru */}
          <button
            onClick={() => onEdit(exam)} // Panggil handler baru
            className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-yellow-600 hover:text-yellow-800 font-medium py-1 px-2 rounded-md hover:bg-yellow-50 w-full"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          
          {/* Tombol Hapus Lama (dimasukkan ke div) */}
          <button
            onClick={() => onDelete(exam.id, exam.judul)}
            className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-red-600 hover:text-red-800 font-medium py-1 px-2 rounded-md hover:bg-red-50 w-full"
          >
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
        </div>
            </div>
        </div>
    );
};

export default TeacherExamPage;