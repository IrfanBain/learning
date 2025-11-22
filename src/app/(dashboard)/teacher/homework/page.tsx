"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
    orderBy,
    updateDoc, // <-- BARU: Untuk update status
    deleteDoc  // <-- BARU: Untuk hapus
} from 'firebase/firestore';
import { 
    Loader2, 
    List, 
    PlusSquare, 
    BookUp, 
    AlertTriangle, 
    FileText, 
    Clock, 
    CheckCircle,
    UploadCloud,
    X,
    Trash2,
    Eye,
    ChevronRight,
    Edit,
    Lock,
    EyeOff, // <-- BARU
    LockOpen,

} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// --- DEFINISI TIPE ---
// (Definisi tipe tidak berubah)
interface DropdownItem {
    id: string;
    nama: string;
}
interface UploadedFileInfo {
    url: string;      
    path: string;     
    namaFile: string; 
}
interface HomeworkDoc {
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
    kelasNama?: string;
}
type HomeworkFormData = {
    judul: string;
    deskripsi: string;
    mapel_ref: string; 
    kelas_ref: string; 
    tanggal_selesai: string; 
    status: "Draft" | "Dipublikasi" | "Ditutup";
};
const initialFormData: HomeworkFormData = {
    judul: "",
    deskripsi: "",
    mapel_ref: "",
    kelas_ref: "",
    tanggal_selesai: "",
    status: "Dipublikasi",
};

// --- KOMPONEN UTAMA ---
const TeacherHomeworkPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    const router = useRouter();

    // (State tidak berubah)
    const [view, setView] = useState<'list' | 'create'>('list');
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [homeworkList, setHomeworkList] = useState<HomeworkDoc[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [formData, setFormData] = useState<HomeworkFormData>(initialFormData);
    const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null);

    // --- PENGAMBILAN DATA (FETCHING) ---
    // (fetchDropdownData tidak berubah)
    const fetchDropdownData = useCallback(async () => {
        if (availableMapel.length > 0 && availableKelas.length > 0) return;
        try {
            const mapelQuery = query(collection(db, "subjects"));
            const mapelSnapshot = await getDocs(mapelQuery);
            const mapelData = mapelSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            setAvailableMapel(mapelData);

            const kelasQuery = query(collection(db, "classes"));
            const kelasSnapshot = await getDocs(kelasQuery);
            const kelasData = kelasSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            setAvailableKelas(kelasData);
        } catch (err: any) {
            console.error("Error fetching dropdown data:", err);
            toast.error("Gagal memuat data mapel & kelas.");
        }
    }, [availableMapel, availableKelas]);

    // (fetchHomeworkList tidak berubah)
    const fetchHomeworkList = useCallback(async (userUid: string) => {
        setLoading(true);
        setError(null);
        try {
            const guruRef = doc(db, "teachers", userUid);
            const q = query(
                collection(db, "homework"),
                where("guru_ref", "==", guruRef),
                orderBy("tanggal_dibuat", "desc")
            );

            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setHomeworkList([]);
                setLoading(false);
                return;
            }

            const homeworkPromises = querySnapshot.docs.map(async (hwDoc) => {
                const hwData = hwDoc.data() as Omit<HomeworkDoc, 'id'>;
                
                let mapelNama = "N/A";
                let kelasNama = "N/A";

                try {
                    if (hwData.mapel_ref) {
                        const mapelSnap = await getDoc(hwData.mapel_ref);
                        mapelNama = mapelSnap.data()?.nama_mapel || "Mapel Dihapus";
                    }
                } catch (e) { mapelNama = "Ref. Error"; }
                
                try {
                    if (hwData.kelas_ref) {
                        const kelasSnap = await getDoc(hwData.kelas_ref);
                        const kls = kelasSnap.data();
                        kelasNama = `${kls?.tingkat || ''} ${kls?.nama_kelas || 'Kelas Dihapus'}`.trim();
                    }
                } catch (e) { kelasNama = "Ref. Error"; }

                return {
                    ...hwData,
                    id: hwDoc.id,
                    mapelNama,
                    kelasNama,
                } as HomeworkDoc;
            });

            const combinedHomeworks = await Promise.all(homeworkPromises);
            setHomeworkList(combinedHomeworks);

        } catch (err: any) {
            console.error("Error fetching homework list:", err);
            setError("Gagal memuat daftar PR. " + err.message);
            if (err.code === 'permission-denied') {
                setError("Gagal memuat: Periksa Security Rules untuk 'homework'.");
            }
            toast.error("Gagal memuat daftar PR.");
        } finally {
            setLoading(false);
        }
    }, []);

    // (useEffect tidak berubah)
    useEffect(() => {
        if (user?.uid && !authLoading) {
            fetchHomeworkList(user.uid);
            fetchDropdownData();
        }
        if (!user && !authLoading) {
            setLoading(false);
            setError("User tidak ditemukan, silakan login.");
        }
    }, [user, authLoading, fetchHomeworkList, fetchDropdownData]);


    // --- HANDLER UNTUK FORMULIR ---
    // (handleFormChange tidak berubah)
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // (handleFileChange tidak berubah)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);
        setUploadedFile(null);
        
        try {
            const fileExtension = file.name.split('.').pop();
            if (!fileExtension) {
                throw new Error("Tipe file tidak valid (tidak ada ekstensi).");
            }

            const response = await fetch('/api/upload-url', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    contentType: file.type,
                    fileExtension: fileExtension,
                    prefix: "homework_attachments" 
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Gagal mendapatkan URL upload.");
            }
            
            const { uploadUrl, fileUrl, key, namaFile } = await response.json(); 
            
            if (!uploadUrl || !fileUrl || !key || !namaFile) {
                throw new Error("Respon API tidak lengkap.");
            }

            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type }
            });

            if (!uploadResponse.ok) {
                throw new Error("Upload file ke R2 gagal.");
            }

            setUploadedFile({
                url: fileUrl,
                path: key,
                namaFile: namaFile
            });
            toast.success("Lampiran berhasil di-upload!");

        } catch (err: any) {
            console.error("Error uploading file:", err);
            setUploadError(err.message || "Upload gagal.");
            toast.error(err.message || "Upload gagal.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingHomeworkId(null);
        setFormData(initialFormData);
        setUploadedFile(null);
        setView('list');
    };

    // --- BARU: Fungsi Mulai Edit ---
    const handleStartEdit = (hw: HomeworkDoc) => {
        // 1. Cek Status: Hanya boleh edit jika Draft
        if (hw.status !== 'Draft') {
            toast.error("PR ini sudah Dipublikasi. Ubah status ke 'Draft' dulu untuk mengedit. Klik tombol mata untuk mengubah status", {
                icon: <AlertTriangle className="text-red-500" />,
            });
            return;
        }

        // 2. Isi Form dengan data lama
        // Catatan: Kita ambil ID dari referensi (mapel_ref.id)
        setFormData({
            judul: hw.judul,
            deskripsi: hw.deskripsi,
            mapel_ref: hw.mapel_ref.id, 
            kelas_ref: hw.kelas_ref.id,
            // Konversi Timestamp ke format datetime-local (YYYY-MM-DDTHH:MM)
            tanggal_selesai: hw.tanggal_selesai.toDate().toISOString().slice(0, 16),
            status: hw.status,
        });

        // 3. Isi data file jika ada
        if (hw.file_lampiran) {
            setUploadedFile(hw.file_lampiran);
        } else {
            setUploadedFile(null);
        }

        // 4. Set Mode Edit & Pindah View
        setEditingHomeworkId(hw.id);
        setView('create');
    };
    
    // (handleRemoveFile tidak berubah)
    const handleRemoveFile = () => {
        setUploadedFile(null);
        setUploadError(null);
        const fileInput = document.getElementById('file_lampiran') as HTMLInputElement;
        if (fileInput) fileInput.value = "";
    };


    // (handleFormSubmit tidak berubah)
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("Anda harus login untuk membuat PR.");
            return;
        }

        setFormLoading(true);
        try {
            if (!formData.judul || !formData.mapel_ref || !formData.kelas_ref || !formData.tanggal_selesai || !formData.deskripsi) {
                throw new Error("Judul, Deskripsi, Mapel, Kelas, dan Tanggal Selesai wajib diisi.");
            }

           // Siapkan data dasar
            const homeworkBaseData = {
                judul: formData.judul,
                deskripsi: formData.deskripsi,
                mapel_ref: doc(db, "subjects", formData.mapel_ref),
                kelas_ref: doc(db, "classes", formData.kelas_ref),
                guru_ref: doc(db, "teachers", user.uid),
                tanggal_selesai: Timestamp.fromDate(new Date(formData.tanggal_selesai)),
                status: formData.status,
                file_lampiran: uploadedFile, 
            };

            if (editingHomeworkId) {
                // --- LOGIKA UPDATE (EDIT) ---
                const hwRef = doc(db, "homework", editingHomeworkId);
                await updateDoc(hwRef, homeworkBaseData); // Update data
                toast.success("Perubahan PR berhasil disimpan!");
            } else {
                // --- LOGIKA CREATE (BARU) ---
                await addDoc(collection(db, "homework"), {
                    ...homeworkBaseData,
                    tanggal_dibuat: serverTimestamp(), // Hanya set tanggal buat saat baru
                });
                toast.success("Pekerjaan Rumah berhasil dibuat!");
            }
            
            // Reset & Refresh
            handleCancelEdit(); // Reset form & state
            fetchHomeworkList(user.uid);

        } catch (err: any) {
            console.error("Error creating homework:", err);
            toast.error(err.message || "Gagal menyimpan PR.");
        } finally {
            setFormLoading(false);
        }
    };

    // --- BARU: Handler untuk ubah status Draft/Publikasi ---
    // --- MODIFIKASI: Fungsi ubah status lebih fleksibel ---
  const handleToggleStatus = async (id: string, newStatus: "Draft" | "Dipublikasi" | "Ditutup") => {
      try {
          await updateDoc(doc(db, "homework", id), { status: newStatus });
          
          setHomeworkList(prev => prev.map(h => h.id === id ? { ...h, status: newStatus } : h));
          
          let pesan = "";
          if(newStatus === 'Dipublikasi') pesan = "PR Dipublikasikan (Siswa bisa mengerjakan)";
          else if(newStatus === 'Draft') pesan = "PR dikembalikan ke Draft (Siswa tidak bisa lihat)";
          else if(newStatus === 'Ditutup') pesan = "PR Ditutup (Siswa tidak bisa kirim jawaban lagi)";
          
          toast.success(pesan);
      } catch (err) {
          console.error(err);
          toast.error("Gagal mengubah status PR");
      }
  }

    // --- BARU: Handler untuk Hapus PR ---
    const executeDelete = async (hwId: string, title: string) => {
        const loadingToastId = toast.loading(`Menghapus PR "${title}"...`);
        try {
            // PERINGATAN: Ini tidak menghapus file di R2 atau data submission terkait.
            // Itu memerlukan logic API/worker yang lebih kompleks.
            await deleteDoc(doc(db, "homework", hwId));
            
            toast.success("PR berhasil dihapus.", { id: loadingToastId });
            // Hapus dari list di UI
            setHomeworkList(prevList => prevList.filter(hw => hw.id !== hwId));
            
        } catch (err: any) {
            console.error("Error deleting homework:", err);
            toast.error(err.message || "Gagal menghapus PR.", { id: loadingToastId });
        }
    };

    const handleDeleteHomework = (hwId: string, title: string) => {
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Hapus PR Ini?</p>
                        <p className="text-sm text-gray-600">
                            Anda akan menghapus <span className="font-bold">{title}</span>. Tindakan ini tidak dapat dibatalkan.
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
                            executeDelete(hwId, title); 
                        }}
                        className="py-1.5 px-3 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                    >
                        Ya, Hapus
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    // --- TAMPILAN (RENDER) ---
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* ... (Header tidak berubah) ... */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Manajemen Pekerjaan Rumah</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setView('list')}
                        className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all ${
                            view === 'list' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                    >
                        <List className="w-5 h-5" />
                        <span>Daftar PR</span>
                    </button>
                    <button
                        onClick={() => setView('create')}
                        className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all ${
                            view === 'create' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-gray-600 hover:bg-gray-100 border'
                        }`}
                    >
                        <PlusSquare className="w-5 h-5" />
                        <span>
                            {editingHomeworkId ? "Edit PR" : "Buat PR Baru"}
                        </span>
                    </button>
                </div>
            </div>

            {/* ... (Error global tidak berubah) ... */}
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* --- MODIFIKASI: Tampilan Daftar PR --- */}
            {view === 'list' && (
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Daftar PR Dibuat</h2>
                    {loading ? (
                        <div className="flex justify-center items-center h-60">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-gray-600">Memuat data PR...</span>
                        </div>
                    ) : homeworkList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                            <BookUp className="w-16 h-16 text-gray-300" />
                            <h3 className="text-xl font-semibold mt-4">Belum Ada PR</h3>
                            <p className="text-center">Klik tombol Buat PR Baru untuk memulai.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* --- MODIFIKASI: Kirim props baru --- */}
                            {homeworkList.map(hw => (
                                <HomeworkListItem 
                                    key={hw.id} 
                                    hw={hw} 
                                    onToggleStatus={handleToggleStatus}
                                    onDelete={handleDeleteHomework}
                                    onEdit={handleStartEdit}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ... (Tampilan Form "Buat PR" tidak berubah) ... */}
            {view === 'create' && (
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Buat Pekerjaan Rumah Baru</h2>
                    
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Kolom Kiri */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul PR <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        id="judul"
                                        name="judul"
                                        value={formData.judul}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Contoh: Merangkum Bab 5"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi / Instruksi / Soal <span className="text-red-500">*</span></label>
                                    <textarea
                                        id="deskripsi"
                                        name="deskripsi"
                                        value={formData.deskripsi}
                                        onChange={handleFormChange}
                                        rows={8}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Tuliskan instruksi lengkap untuk siswa di sini... atau ketikan soal"
                                        required
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
                                    <label htmlFor="tanggal_selesai" className="block text-sm font-medium text-gray-700 mb-1">Batas Akhir Pengumpulan (Deadline) <span className="text-red-500">*</span></label>
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
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status <span className="text-red-500">*</span></label>
                                    <select
                                        id="status"
                                        name="status"
                                        value={formData.status}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="Dipublikasi">Langsung Publikasikan</option>
                                        <option value="Draft">Simpan sebagai Draft</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* --- Bagian Upload File --- */}
                        <div className="border-t pt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Lampiran File (Opsional)</label>
                            <p className="text-xs text-gray-500 mb-2">Upload file soal (PDF, Word, dll) jika instruksi tidak cukup.</p>
                            
                            {isUploading && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">Mengupload file...</span>
                                </div>
                            )}

                            {uploadError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                    <span className="text-sm font-medium text-red-700">{uploadError}</span>
                                </div>
                            )}

                            {uploadedFile && !isUploading && (
                                <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-medium text-green-700 truncate">{uploadedFile.namaFile}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="p-1 text-red-600 hover:text-red-800"
                                        title="Hapus lampiran"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                            
                            {!uploadedFile && !isUploading && (
                                <input
                                    type="file"
                                    id="file_lampiran"
                                    name="file_lampiran"
                                    onChange={handleFileChange}
                                    className="w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-lg file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100 cursor-pointer"
                                />
                            )}
                        </div>
                        
                        {/* Tombol Aksi Form */}
                        <div className="flex justify-end items-center gap-3 pt-4 border-t">
                            {editingHomeworkId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="py-2 px-5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50"
                                >
                                    Batal
                                </button>
                            )}
                            
                            <button
                                type="submit"
                                disabled={formLoading || isUploading}
                                className="flex items-center justify-center gap-2 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                                {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                <span>{editingHomeworkId ? "Simpan Perubahan" : "Buat PR"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

// --- KOMPONEN PENDUKUNG (MODIFIKASI) ---

const HomeworkListItem = ({ hw, onToggleStatus, onDelete, onEdit }: { 
    hw: HomeworkDoc,
    onToggleStatus: (id: string, status: "Draft" | "Dipublikasi" | "Ditutup") => void,
    onDelete: (id: string, title: string) => void,
    onEdit: (hw: HomeworkDoc) => void
}) => {
    
    // --- PERBAIKAN: Cek apakah deadline valid ---
    const deadlineDate = hw.tanggal_selesai ? hw.tanggal_selesai.toDate() : null;
    const isExpired = deadlineDate ? deadlineDate < new Date() : false;
    
    // Format tanggal yang aman
    const deadlineString = deadlineDate 
        ? deadlineDate.toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        : "Belum diatur";

    const renderStatusChip = () => {
        // 1. Jika Draft, tetap kuning
        if (hw.status === 'Draft') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                    Draft
                </span>
            );
        }
        
        // 2. Cek Ditutup Manual (INI YANG TADI KURANG/TERLEWAT)
        if (hw.status === 'Ditutup') {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    Ditutup 
                </span>
            );
        }
        
        // 3. Cek Expired (Deadline Lewat)
        // Ini hanya berlaku jika statusnya 'Dipublikasi' tapi waktunya habis
        if (isExpired) {
            return (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300">
                    Selesai 
                </span>
            );
        }

        // 3. Jika Dipublikasi dan belum lewat -> "Dipublikasi" (Hijau)
        return (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                Dipublikasi
            </span>
        );
    };
    
    return (
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition-all">
            <div className="flex items-center gap-4">
                {/* Ikon & Info PR (tetap sama) */}
                <div className="flex-shrink-0">
                    <FileText className="w-6 h-6 text-blue-500" /> {/* Saya ganti BookUp jadi FileText jika BookUp tidak ada */}
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{hw.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span>{hw.mapelNama || "Mapel N/A"}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{hw.kelasNama || "Kelas N/A"}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {deadlineString}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Tombol Aksi */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {renderStatusChip()}
                
                {/* Tombol Publikasi / Draft */}
                {/* --- TOMBOL STATUS DINAMIS --- */}
                
                {/* 1. Jika DRAFT -> Tombol PUBLIKASI */}
                {hw.status === "Draft" && (
                    <button
                        onClick={() => onToggleStatus(hw.id, "Dipublikasi")}
                        title="Publikasikan PR"
                        className="p-2 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                )}

                {/* 2. Jika DIPUBLIKASI -> Tombol TUTUP & DRAFT */}
                {hw.status === "Dipublikasi" && (
                    <>
                        {/* Tombol Tutup (Lock) */}
                        <button
                            onClick={() => onToggleStatus(hw.id, "Ditutup")}
                            title="Tutup Pengumpulan (Siswa tidak bisa kirim lagi)"
                            className="p-2 rounded-md text-orange-600 hover:bg-orange-50 transition-colors"
                        >
                            <Lock className="w-4 h-4" />
                        </button>
                        
                        {/* Tombol Balik ke Draft */}
                        <button
                            onClick={() => onToggleStatus(hw.id, "Draft")}
                            title="Kembalikan ke Draft (Sembunyikan)"
                            className="p-2 rounded-md text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                            <EyeOff className="w-4 h-4" />
                        </button>
                    </>
                )}

                {/* 3. Jika DITUTUP -> Tombol BUKA KEMBALI */}
                {hw.status === "Ditutup" && (
                    <button
                        onClick={() => onToggleStatus(hw.id, "Dipublikasi")}
                        title="Buka Kembali Pengumpulan"
                        className="p-2 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                    >
                        <LockOpen className="w-4 h-4" />
                    </button>
                )}

                {/* Tombol Edit */}
                <button
                    onClick={() => onEdit(hw)}
                    title="Edit PR"
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                >
                    <Edit className="w-4 h-4" />
                </button>

                {/* Tombol Hapus */}
                <button
                    onClick={() => onDelete(hw.id, hw.judul)}
                    title="Hapus PR"
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium py-1 px-2 rounded-md hover:bg-red-50"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
               
                {/* Tombol Lihat Pengumpulan */}
                <Link 
                    href={`/teacher/homework/${hw.id}/submissions`}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                >
                    Lihat Pengumpulan <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
};

export default TeacherHomeworkPage;

