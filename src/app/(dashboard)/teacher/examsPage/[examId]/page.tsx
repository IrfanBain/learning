"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/authContext'; 
import { db } from '@/lib/firebaseConfig'; 
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    orderBy, 
    getDocs, 
    addDoc, 
    deleteDoc,
    updateDoc,
    serverTimestamp,
    where,
    writeBatch, 
    DocumentReference,
    Timestamp,
    increment 
} from 'firebase/firestore'; 
import { useParams, useRouter } from 'next/navigation';

import { 
    Plus, 
    PlusSquare, 
    Trash2, 
    Loader2, 
    ArrowLeft, 
    FileText, 
    ListChecks, 
    AlertTriangle, 
    Check, 
    X,
    ShieldCheck, 
    ShieldOff, 
    Eye,
    XCircle,
    Clock, // <-- BARU: Tambahkan ikon Jam
    Edit2, // <-- BARU: Tambahkan ikon Edit
    Save,  // <-- BARU: Tambahkan ikon Simpan
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE & DATA ---

interface ExamData {
// ... (tidak berubah)
    id: string;
    judul: string;
    tipe: "Pilihan Ganda" | "Esai" | "Tugas (Upload File)" | "Esai Uraian" | "PG dan Esai";
    mapel_ref: DocumentReference;
    kelas_ref: DocumentReference;
    jumlah_soal: number;
    status: "Draft" | "Dipublikasi" | "Ditutup";
    tanggal_selesai?: Timestamp;
}

interface SoalData {
// ... (tidak berubah)
    id: string;
    urutan: number;
    pertanyaan: string;
    poin: number;
    tipe_soal: "Pilihan Ganda" | "Esai" | "Esai Uraian";
    opsi?: { [key: string]: string }; 
    kunci_jawaban?: string; 
    rubrik_penilaian?: string;
    jumlah_input?: number; 
}

type SoalFormData = {
// ... (tidak berubah)
    pertanyaan: string;
    poin: number;
    opsiA: string;
    opsiB: string;
    opsiC: string;
    opsiD: string;
    kunci_jawaban: "A" | "B" | "C" | "D";
    rubrik_penilaian: string;
    jumlah_input?: number;
}

const initialFormData: SoalFormData = {
// ... (tidak berubah)
    pertanyaan: "",
    poin: 10,
    opsiA: "",
    opsiB: "",
    opsiC: "",
    opsiD: "",
    kunci_jawaban: "A",
    rubrik_penilaian: "",
    jumlah_input: 3,
};

// --- BARU: Helper function untuk konversi Timestamp ke format input datetime-local ---
/**
 * Mengkonversi objek Date atau Timestamp ke string YYYY-MM-DDTHH:MM
 * @param {Date | Timestamp} dateObj Objek tanggal
 * @returns {string} String yang diformat
 */
const toDateTimeLocalString = (dateObj: Date | Timestamp): string => {
    const date = (dateObj instanceof Timestamp) ? dateObj.toDate() : dateObj;
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// --- KOMPONEN UTAMA ---

const TeacherExamManagePage = () => {
    const { user, loading: authLoading } = useAuth();
    const params = useParams(); 
    const router = useRouter(); 
    const examId = params.examId as string; 

    const [examData, setExamData] = useState<ExamData | null>(null);
    const [soalList, setSoalList] = useState<SoalData[]>([]);
    const [formData, setFormData] = useState<SoalFormData>(initialFormData);
    
    const [loadingExam, setLoadingExam] = useState(true);
    const [loadingSoal, setLoadingSoal] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false); 
    const [error, setError] = useState<string | null>(null);

    // --- BARU: State untuk edit deadline ---
    const [isEditingDeadline, setIsEditingDeadline] = useState(false);
    const [newDeadline, setNewDeadline] = useState("");
    const [deadlineLoading, setDeadlineLoading] = useState(false);
    const [editingSoal, setEditingSoal] = useState<SoalData | null>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<"Pilihan Ganda" | "Esai" | "Esai Uraian">("Pilihan Ganda");

    const examDocRef = useMemo(() => doc(db, "exams", examId), [examId]);

    // --- PENGAMBILAN DATA (FETCHING) ---

    const fetchExamData = useCallback(async () => {
    // ... (tidak berubah, logika cek deadline otomatis sudah ada)
        if (!examId) return;
        setLoadingExam(true);
        try {
            const docSnap = await getDoc(examDocRef);
            if (!docSnap.exists()) {
                throw new Error("Ujian tidak ditemukan.");
            }

            const docData = docSnap.data() as ExamData;
            let currentStatus = docData.status;

            if (currentStatus === "Dipublikasi" && docData.tanggal_selesai) {
                const deadline = docData.tanggal_selesai.toDate();
                const now = new Date();

                if (now > deadline) {
                    console.log("Deadline terlewati, mengubah status ke 'Ditutup'...");
                    await updateDoc(examDocRef, {
                        status: "Ditutup"
                    });
                    currentStatus = "Ditutup"; 
                    docData.status = "Ditutup"; 
                    toast("Ujian ini otomatis ditutup karena telah melewati deadline.", {
                        icon: <Check className="text-green-500" />
                    });
                }
            }

            setExamData({ ...docData, id: docSnap.id } as ExamData);

        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setLoadingExam(false);
        }
    }, [examDocRef, examId]);

    const fetchSoalList = useCallback(async () => {
    // ... (tidak berubah)
        if (!examId) return;
        setLoadingSoal(true);
        try {
            const soalQuery = query(
                collection(db, "exams", examId, "soal"),
                orderBy("urutan", "asc") 
            );
            const querySnapshot = await getDocs(soalQuery);
            
            const soalData = querySnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id     
            } as SoalData));

            setSoalList(soalData);
        } catch (err: any) {
            console.error("Error fetching questions:", err);
            toast.error("Gagal memuat daftar soal.");
            if (err.code === 'permission-denied') {
                setError("Gagal memuat soal: Periksa Security Rules untuk subkoleksi 'soal'.");
            }
        } finally {
            setLoadingSoal(false);
        }
    }, [examId]);

    useEffect(() => {
    // ... (tidak berubah)
        fetchExamData();
        fetchSoalList();
    }, [fetchExamData, fetchSoalList]);

    // --- HANDLER UNTUK FORMULIR ---

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    // ... (tidak berubah)
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'poin' ? parseInt(value) : value
        }));
    };

    const handleAddSoal = async (e: React.FormEvent) => {
    // ... (tidak berubah)
        e.preventDefault();
        if (!examData) return;

        if (examData.status !== 'Draft') {
            toast.error("Tidak bisa menambah soal. Ujian sudah dipublikasi.");
            return;
        }

        setFormLoading(true);
        
        const nextUrutan = soalList.length + 1;

        const targetTipe = examData.tipe === 'PG dan Esai' ? activeTab : examData.tipe;

        let newSoalData: any = {
            urutan: nextUrutan,
            pertanyaan: formData.pertanyaan,
            poin: formData.poin,
            tipe_soal: targetTipe, // Gunakan targetTipe yang sudah dihitung
        };
        
        if (targetTipe === 'Pilihan Ganda') {
            if (!formData.opsiA || !formData.opsiB || !formData.opsiC || !formData.opsiD) {
                toast.error("Semua 4 opsi jawaban harus diisi.");
                setFormLoading(false);
                return;
            }
            newSoalData.opsi = {
                A: formData.opsiA,
                B: formData.opsiB,
                C: formData.opsiC,
                D: formData.opsiD,
            };
            newSoalData.kunci_jawaban = formData.kunci_jawaban;
        } else if (targetTipe === 'Esai') {
            newSoalData.rubrik_penilaian = formData.rubrik_penilaian;
        } else if (targetTipe === 'Esai Uraian') {
            if (!formData.jumlah_input || formData.jumlah_input < 1) {
                toast.error("Jumlah input minimal harus 1.");
                setFormLoading(false);
                return;
            }
            newSoalData.rubrik_penilaian = formData.rubrik_penilaian;
            newSoalData.jumlah_input = formData.jumlah_input;
        }

        try {
            const soalCollectionRef = collection(db, "exams", examId, "soal");
            await addDoc(soalCollectionRef, newSoalData);
            
            await updateDoc(examDocRef, {
                jumlah_soal: increment(1) 
            });
            
            toast.success(`Soal nomor ${nextUrutan} berhasil ditambahkan!`);
            setFormData(initialFormData); 
            fetchSoalList(); 
            fetchExamData(); 

        } catch (err: any) {
            console.error("Error adding question:", err);
            toast.error(err.message || "Gagal menambahkan soal.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateSoal = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!editingSoal || !examData) return;

            if (examData.status !== 'Draft') {
                toast.error("Tidak bisa menyimpan perubahan. Ujian sudah dipublikasi.");
                return;
            }

            setFormLoading(true);

            // --- LOGIC BARU: Tentukan tipe target ---
            const targetTipe = examData.tipe === 'PG dan Esai' ? activeTab : examData.tipe;

            let updatedSoalData: any = {
                pertanyaan: formData.pertanyaan,
                poin: formData.poin,
                tipe_soal: targetTipe, // Update tipe soal
            };

            if (targetTipe === 'Pilihan Ganda') {
                if (!formData.opsiA || !formData.opsiB || !formData.opsiC || !formData.opsiD) {
                    toast.error("Semua 4 opsi jawaban harus diisi.");
                    setFormLoading(false);
                    return;
                }
                updatedSoalData.opsi = {
                    A: formData.opsiA,
                    B: formData.opsiB,
                    C: formData.opsiC,
                    D: formData.opsiD,
                };
                updatedSoalData.kunci_jawaban = formData.kunci_jawaban;
                // Bersihkan field tipe lain
                updatedSoalData.rubrik_penilaian = null;
                updatedSoalData.jumlah_input = null;

            } else if (targetTipe === 'Esai') {
                updatedSoalData.rubrik_penilaian = formData.rubrik_penilaian;
                // Bersihkan field tipe lain
                updatedSoalData.opsi = null;
                updatedSoalData.kunci_jawaban = null;
                updatedSoalData.jumlah_input = null;

            } else if (targetTipe === 'Esai Uraian') {
                if (!formData.jumlah_input || formData.jumlah_input < 1) {
                    toast.error("Jumlah input minimal harus 1.");
                    setFormLoading(false);
                    return;
                }
                updatedSoalData.jumlah_input = formData.jumlah_input;
                updatedSoalData.rubrik_penilaian = formData.rubrik_penilaian;
                // Bersihkan field tipe lain
                updatedSoalData.opsi = null;
                updatedSoalData.kunci_jawaban = null;
            }

            try {
                const soalDocRef = doc(db, "exams", examId, "soal", editingSoal.id);
                await updateDoc(soalDocRef, updatedSoalData);

                toast.success(`Soal nomor ${editingSoal.urutan} berhasil diperbarui!`);
                fetchSoalList();
                handleCancelEdit();

            } catch (err: any) {
                console.error("Error updating question:", err);
                toast.error(err.message || "Gagal memperbarui soal.");
            } finally {
                setFormLoading(false);
            }
        };

    // --- BARU: Fungsi untuk membatalkan mode edit ---
 const handleCancelEdit = () => {
setEditingSoal(null);
setFormData(initialFormData); // Reset form ke kondisi awal
};

    // --- BARU: Fungsi untuk MEMULAI mode edit ---
const handleStartEdit = (soal: SoalData) => {
if (examData?.status !== 'Draft') {
 toast.error("Hanya bisa mengedit soal dalam mode Draft.");
 return;
 }

setEditingSoal(soal); // Set soal yang aktif diedit
setActiveTab(soal.tipe_soal);

// Isi form di kiri dengan data soal yang dipilih
if (soal.tipe_soal === 'Pilihan Ganda' && soal.opsi) {
 setFormData({
pertanyaan: soal.pertanyaan,
poin: soal.poin,
 opsiA: soal.opsi['A'] || "",
opsiB: soal.opsi['B'] || "",
opsiC: soal.opsi['C'] || "",
opsiD: soal.opsi['D'] || "",
kunci_jawaban: (soal.kunci_jawaban as "A" | "B" | "C" | "D") || "A",
 rubrik_penilaian: "", // Kosongkan rubrik untuk PG
 });
 } else if (soal.tipe_soal === 'Esai') { // Esai Biasa
 setFormData({
pertanyaan: soal.pertanyaan,
poin: soal.poin,
opsiA: "", opsiB: "", opsiC: "", opsiD: "",
kunci_jawaban: "A",
rubrik_penilaian: soal.rubrik_penilaian || "",
jumlah_input: 1, // Reset ke default
 });
} else if (soal.tipe_soal === 'Esai Uraian') {
setFormData({
 pertanyaan: soal.pertanyaan,
poin: soal.poin,
 opsiA: "", opsiB: "", opsiC: "", opsiD: "",
 kunci_jawaban: "A",
 rubrik_penilaian: soal.rubrik_penilaian || "", // Reset ke default
jumlah_input: soal.jumlah_input || 1, // Isi dari data soal
});
}

 // Scroll ke atas agar form terlihat (opsional tapi bagus)
window.scrollTo({ top: 0, behavior: 'smooth' });
if (formRef.current) {
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
 toast("Mode edit aktif. Silakan ubah soal di formulir.", {
icon: <Edit2 className="text-blue-500" />
 });
};

const executeDelete = async (soalId: string, urutan: number) => {
// ... (tidak berubah)
const loadingToastId = toast.loading(`Menghapus soal nomor ${urutan}...`);
try {
const soalDocRef = doc(db, "exams", examId, "soal", soalId);
await deleteDoc(soalDocRef);
await updateDoc(examDocRef, { jumlah_soal: increment(-1) });
 const soalCollectionRef = collection(db, "exams", examId, "soal");
const q = query(soalCollectionRef, where("urutan", ">", urutan));

 const querySnapshot = await getDocs(q);

if (!querySnapshot.empty) {
// 2. Gunakan batch write untuk update semua sekaligus
const batch = writeBatch(db);

 querySnapshot.forEach((doc) => {
   // Kurangi 'urutan' dengan 1
   batch.update(doc.ref, { urutan: increment(-1) });
 });

 // 3. Commit batch
 await batch.commit();
 
      } else {

      }
            toast.success(`Soal nomor ${urutan} berhasil dihapus.`, { id: loadingToastId });
            
            fetchSoalList(); 
            fetchExamData();
        } catch (err: any) {
            console.error("Error deleting question:", err);
            toast.error(err.message || "Gagal menghapus soal.", { id: loadingToastId }); 
        }
    };

    const handleDeleteSoal = (soalId: string, urutan: number) => {
    // ... (tidak berubah)
        if (examData?.status !== 'Draft') { 
            toast.error("Tidak bisa menghapus soal jika sudah dipublikasi."); 
            return; 
        }

        toast(
            (t) => ( 
                <div className="flex flex-col gap-3 p-2">
                    <div className="flex items-center gap-2">
                         <AlertTriangle className="w-6 h-6 text-red-500" />
                         <p className="font-semibold text-gray-900">
                            Hapus Soal Nomor {urutan}?
                        </p>
                    </div>
                    <p className="text-sm text-gray-600">
                        Tindakan ini tidak dapat dibatalkan. Anda yakin?
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            className="py-1.5 px-3 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
                            onClick={() => toast.dismiss(t.id)} 
                        >
                            Batal
                        </button>
                        <button
                            className="py-1.5 px-3 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                toast.dismiss(t.id); 
                                executeDelete(soalId, urutan); 
                            }}
                        >
                            Ya, Hapus
                        </button>
                    </div>
                </div>
            ),
            {
                duration: 6000, 
                position: "top-center",
                style: {
                    border: '1px solid #E5E7EB', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                },
            }
        );
    };


    const handleChangeStatus = async (newStatus: "Dipublikasi" | "Draft") => {
    // ... (tidak berubah)
        if (!examData) return;

        if (newStatus === "Dipublikasi" && examData.jumlah_soal === 0) {
            toast.error("Tidak bisa mempublikasi Ujian dengan 0 soal.", {
                icon: <AlertTriangle className="text-red-500" />
            });
            return;
        }

        const actionText = newStatus === "Dipublikasi" 
            ? "mempublikasikan" 
            : "mengembalikan ke draft";
        
        toast(
            (t) => (
                <div className="flex flex-col gap-3 p-2">
                    <p className="font-semibold text-gray-900">
                        Konfirmasi Perubahan Status
                    </p>
                    <p className="text-sm text-gray-600">
                        Anda yakin ingin {actionText} Ujian ini?
                    </p>
                    <div className="flex gap-2 justify-end">
                        <button
                            className="py-1.5 px-3 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800"
                            onClick={() => toast.dismiss(t.id)}
                        >
                            Batal
                        </button>
                        <button
                            className={`py-1.5 px-3 rounded-md text-sm font-medium text-white ${
                                newStatus === 'Dipublikasi' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'
                            }`}
                            onClick={async () => {
                                toast.dismiss(t.id);
                                
                                setStatusLoading(true);
                                const loadingToastId = toast.loading(`Sedang ${actionText} latihan...`);
                                try {
                                    await updateDoc(examDocRef, {
                                        status: newStatus
                                    });
                                    toast.success(`Ujian berhasil ${actionText}!`, { id: loadingToastId });
                                    fetchExamData(); 
                                } catch (err: any) {
                                    console.error("Error changing status:", err);
                                    toast.error(err.message || "Gagal mengubah status.", { id: loadingToastId });
                                } finally {
                                    setStatusLoading(false);
                                }
                            }}
                        >
                            Ya, {newStatus === 'Dipublikasi' ? 'Publikasikan' : 'Simpan ke Draft'}
                        </button>
                    </div>
                </div>
            ),
            {
                duration: 6000,
                position: "top-center",
                style: {
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                },
            }
        );
    };

    // --- BARU: Handler untuk membuka mode edit deadline ---
    const handleOpenEditDeadline = () => {
        if (!examData || !examData.tanggal_selesai) return;
        // Konversi Timestamp ke format YYYY-MM-DDTHH:MM
        const currentDeadlineStr = toDateTimeLocalString(examData.tanggal_selesai);
        setNewDeadline(currentDeadlineStr);
        setIsEditingDeadline(true);
    };

    // --- BARU: Handler untuk batal edit deadline ---
    const handleCancelEditDeadline = () => {
        setIsEditingDeadline(false);
        setNewDeadline("");
    };

    // --- BARU: Handler untuk menyimpan deadline baru ---
    const handleUpdateDeadline = async () => {
        if (!newDeadline) {
            toast.error("Deadline tidak boleh kosong.");
            return;
        }

        // Konversi string input kembali ke Timestamp
        const newTimestamp = Timestamp.fromDate(new Date(newDeadline));

        // Cek apakah deadline baru sudah lewat
        if (new Date(newDeadline) < new Date() && examData?.status !== 'Ditutup') {
             toast.error("Deadline baru tidak boleh di masa lalu.", {
                icon: <AlertTriangle className="text-red-500" />
            });
            return;
        }

        setDeadlineLoading(true);
        const loadingToastId = toast.loading("Memperbarui deadline...");
        try {
            await updateDoc(examDocRef, {
                tanggal_selesai: newTimestamp
            });

            // Panggil fetchExamData() lagi untuk sinkronisasi data
            // Ini PENTING agar UI me-render deadline baru
            await fetchExamData(); 

            toast.success("Deadline berhasil diperbarui.", { id: loadingToastId });
            setIsEditingDeadline(false);
            setNewDeadline("");
        } catch (err: any) {
            console.error("Error updating deadline:", err);
            toast.error(err.message || "Gagal memperbarui deadline.", { id: loadingToastId });
        } finally {
            setDeadlineLoading(false);
        }
    };

    
    // --- TAMPILAN (RENDER) ---

    if (loadingExam) {
    // ... (tidak berubah)
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data latihan...</span>
            </div>
        );
    }
    
    if (error) {
    // ... (tidak berubah)
        return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.back()} 
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Daftar Ujian
                </button>
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative h-60 flex flex-col justify-center items-center" role="alert">
                    <strong className="font-bold text-xl">Error!</strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        );
    }

    if (!examData) {
    // ... (tidak berubah)
        return <div className="p-8 text-center text-gray-500">Data Ujian tidak ditemukan.</div>;
    }

    if (examData.tipe === "Tugas (Upload File)") {
    // ... (tidak berubah, tapi panel status akan di-update)
        return (
            <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Daftar Ujian
                </button>
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                     <h1 className="text-2xl font-bold text-gray-800">{examData.judul}</h1>
                     <p className="text-lg text-gray-600 mt-2">Ini adalah Ujian tipe **Tugas (Upload File)**.</p>
                     <p className="text-gray-500 mb-4">Tidak ada penambahan soal Pilihan Ganda atau Esai untuk tipe ini.</p>
                     {/* --- MODIFIKASI: Kirim props baru ke panel --- */}
                     <StatusAksiPanel 
                        examData={examData} 
                        onChangeStatus={handleChangeStatus} 
                        statusLoading={statusLoading}
                        isEditingDeadline={isEditingDeadline}
                        newDeadline={newDeadline}
                        onNewDeadlineChange={setNewDeadline}
                        onOpenEditDeadline={handleOpenEditDeadline}
                        onCancelEditDeadline={handleCancelEditDeadline}
                        onUpdateDeadline={handleUpdateDeadline}
                        deadlineLoading={deadlineLoading}
                    />
                </div>
            </div>
        )
    }

    // --- HELPER VARIABLE UNTUK TAMPILAN FORM ---
    const showPG = 
        (examData?.tipe === "Pilihan Ganda") || 
        (examData?.tipe === "PG dan Esai" && activeTab === "Pilihan Ganda");

    const showEsai = 
        (examData?.tipe === "Esai") || 
        (examData?.tipe === "PG dan Esai" && activeTab === "Esai");

    const showUraian = 
        (examData?.tipe === "Esai Uraian") || 
        (examData?.tipe === "PG dan Esai" && activeTab === "Esai Uraian");

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar Ujian
            </button>
            
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-6">
                <h1 className="text-3xl font-bold text-gray-800">{examData.judul}</h1>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-600 mt-2">
                    <span className="flex items-center gap-2">
                        {examData.tipe === 'Pilihan Ganda' ? <ListChecks className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-green-500" />}
                        Tipe: <strong className="text-gray-800">{examData.tipe}</strong>
                    </span>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="flex items-center gap-2">
                        <PlusSquare className="w-5 h-5 text-gray-500" />
                        Jumlah Soal Saat Ini: <strong className="text-gray-800">{examData.jumlah_soal} Soal</strong>
                    </span>
                </div>
                
                {/* --- MODIFIKASI: Kirim props baru ke panel --- */}
                <StatusAksiPanel 
                    examData={examData} 
                    onChangeStatus={handleChangeStatus} 
                    statusLoading={statusLoading}
                    isEditingDeadline={isEditingDeadline}
                    newDeadline={newDeadline}
                    onNewDeadlineChange={setNewDeadline}
                    onOpenEditDeadline={handleOpenEditDeadline}
                    onCancelEditDeadline={handleCancelEditDeadline}
                    onUpdateDeadline={handleUpdateDeadline}
                    deadlineLoading={deadlineLoading}
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
                
                <div className="w-full lg:w-1/3">
                    <div ref={formRef} className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        {examData.status !== 'Draft' ? (

                            <div className={`p-4 border-l-4 rounded-md mb-4 ${
                                examData.status === 'Dipublikasi' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' : 'bg-red-50 border-red-400 text-red-800'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {examData.status === 'Dipublikasi' ? <AlertTriangle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                    <span className="font-semibold">
                                        {examData.status === 'Dipublikasi' ? 'Ujian Dipublikasi' : 'Ujian Ditutup'}
                                    </span>
                                </div>
                                <p className="text-sm mt-1">
                                    {examData.status === 'Dipublikasi' 
                                        ? 'Kembalikan ke Draft jika Anda ingin menambah atau mengedit soal.'
                                        : 'Ujian ini sudah ditutup dan tidak dapat diubah lagi.'}
                                </p>
                            </div>
                        ) : (
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                {editingSoal 
 ? `Edit Soal Nomor ${editingSoal.urutan}` 
 : `Tambah Soal Baru (Nomor ${soalList.length + 1})`
 }
                            </h2>
                        )}
                        
                        {/* --- BAGIAN SWITCHER TAB (Hanya muncul jika Ujian Campuran) --- */}
                        {examData.tipe === "PG dan Esai" && (
                            <div className="mb-6 bg-gray-50 p-2 rounded-lg border border-gray-200 flex flex-wrap gap-2">
                                <span className="text-sm font-medium text-gray-600 my-auto mr-2 px-2">
                                    Pilih Tipe:
                                </span>
                                {[
                                    { id: "Pilihan Ganda", label: "Pilihan Ganda" },
                                    { id: "Esai", label: "Esai Singkat" },
                                    { id: "Esai Uraian", label: "Uraian" }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                            activeTab === tab.id 
                                                ? "bg-blue-600 text-white shadow-sm" 
                                                : "bg-white text-gray-700 border hover:bg-gray-100"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* --- FORMULIR UTAMA --- */}
                        <form onSubmit={editingSoal ? handleUpdateSoal : handleAddSoal} className="space-y-4">
                            
                            {/* Input Pertanyaan & Poin (Selalu Muncul) */}
                            <div>
                                <label htmlFor="pertanyaan" className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan <span className="text-red-500">*</span></label>
                                <textarea
                                    id="pertanyaan"
                                    name="pertanyaan"
                                    value={formData.pertanyaan}
                                    onChange={handleFormChange}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                                    placeholder="Tuliskan isi pertanyaan di sini..."
                                    required
                                    disabled={examData.status !== 'Draft'} 
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="poin" className="block text-sm font-medium text-gray-700 mb-1">Poin Soal <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    id="poin"
                                    name="poin"
                                    value={formData.poin}
                                    onChange={handleFormChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                                    required
                                    disabled={examData.status !== 'Draft'} 
                                />
                            </div>

                            {/* --- INPUT KHUSUS PILIHAN GANDA --- */}
                            {showPG && (
                                <div className="space-y-3 border-t pt-4">
                                    <h3 className="text-md font-semibold text-gray-700">Opsi Pilihan Ganda</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Opsi A *</label>
                                        <input type="text" name="opsiA" value={formData.opsiA} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100" required disabled={examData.status !== 'Draft'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Opsi B *</label>
                                        <input type="text" name="opsiB" value={formData.opsiB} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100" required disabled={examData.status !== 'Draft'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Opsi C *</label>
                                        <input type="text" name="opsiC" value={formData.opsiC} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100" required disabled={examData.status !== 'Draft'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Opsi D *</label>
                                        <input type="text" name="opsiD" value={formData.opsiD} onChange={handleFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100" required disabled={examData.status !== 'Draft'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Kunci Jawaban *</label>
                                        <select
                                            name="kunci_jawaban"
                                            value={formData.kunci_jawaban}
                                            onChange={handleFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"
                                            disabled={examData.status !== 'Draft'} 
                                        >
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* --- INPUT KHUSUS ESAI (Singkat) --- */}
                            {showEsai && (
                                <div className="space-y-3 border-t pt-4">
                                     <h3 className="text-md font-semibold text-gray-700">Rubrik Penilaian (Opsional)</h3>
                                     <div>
                                        <label htmlFor="rubrik_penilaian" className="block text-sm font-medium text-gray-700 mb-1">Rubrik / Kunci Jawaban Esai</label>
                                        <textarea
                                            name="rubrik_penilaian"
                                            value={formData.rubrik_penilaian}
                                            onChange={handleFormChange}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                                            placeholder="Tuliskan pedoman penilaian..."
                                            disabled={examData.status !== 'Draft'} 
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* --- INPUT KHUSUS ESAI URAIAN (Multi-Input) --- */}
                            {showUraian && (
                                <div className="space-y-3 border-t mt-4">
                                    <h3 className="text-md font-semibold text-gray-700">Pengaturan Soal Uraian</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Rubrik / Kunci Jawaban (opsional)</label>
                                        <textarea
                                            name="rubrik_penilaian"
                                            value={formData.rubrik_penilaian}
                                            onChange={handleFormChange}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                                            placeholder="Tuliskan pedoman penilaian..."
                                            disabled={examData.status !== 'Draft'} 
                                        ></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Input Jawaban *</label>
                                        <input
                                            type="number"
                                            name="jumlah_input"
                                            value={formData.jumlah_input}
                                            onChange={handleFormChange}
                                            min="1"
                                            max="20"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                                            required
                                            disabled={examData.status !== 'Draft'} 
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Siswa akan melihat sejumlah input ini (misal: 5 baris).</p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Tombol Simpan & Batal (Tidak Berubah) */}
                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                <button
                                    type="submit"
                                    disabled={formLoading || examData.status !== 'Draft'}
                                    className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-white font-semibold rounded-lg shadow-md disabled:opacity-50 ${
                                        editingSoal 
                                            ? 'bg-blue-600 hover:bg-blue-700' 
                                            : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                >
                                    {formLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        editingSoal ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />
                                    )}
                                    <span>{editingSoal ? 'Simpan Perubahan' : 'Tambah Soal'}</span>
                                </button>
                                {editingSoal && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={formLoading}
                                        className="w-full sm:w-1/3 flex items-center justify-center gap-2 py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
                                    >
                                        <X className="w-5 h-5" /> Batal
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                <div className="w-full lg:w-2/3">
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                            Daftar Soal ({soalList.length})
                        </h2>
                        {loadingSoal ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                <span className="ml-3 text-gray-600">Memuat soal...</span>
                            </div>
                        ) : soalList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-500 border border-dashed rounded-lg">
                                <FileText className="w-12 h-12 text-gray-300" />
                                <p className="mt-2 font-medium">Belum ada soal ditambahkan.</p>
                                <p className="text-sm">Gunakan formulir di samping untuk menambah soal.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {soalList.map(soal => (
                                    <SoalListItem 
                                        key={soal.id} 
                                        soal={soal} 
                                        onDelete={handleDeleteSoal}
                                        onEdit={handleStartEdit} 
                                        isDisabled={examData.status !== 'Draft'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

// --- MODIFIKASI: Komponen Panel Status & Aksi di-refactor ---
// Menerima prop baru untuk fitur edit deadline
const StatusAksiPanel = ({ 
    examData, 
    onChangeStatus, 
    statusLoading,
    isEditingDeadline,
    newDeadline,
    onNewDeadlineChange,
    onOpenEditDeadline,
    onCancelEditDeadline,
    onUpdateDeadline,
    deadlineLoading
}: {
    examData: ExamData,
    onChangeStatus: (status: "Dipublikasi" | "Draft") => void,
    statusLoading: boolean,
    isEditingDeadline: boolean,
    newDeadline: string,
    onNewDeadlineChange: (value: string) => void,
    onOpenEditDeadline: () => void,
    onCancelEditDeadline: () => void,
    onUpdateDeadline: () => void,
    deadlineLoading: boolean
}) => {
    
    let statusUI: React.ReactNode;
    let buttonUI: React.ReactNode;

    // Format deadline untuk tampilan
    const formattedDeadline = examData.tanggal_selesai
        ? examData.tanggal_selesai.toDate().toLocaleString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
        : "Belum diatur";

    switch (examData.status) {
        case 'Draft':
            statusUI = (
                <div className="flex items-center gap-2 text-yellow-600">
                    <ShieldOff className="w-5 h-5" />
                    <span className="font-semibold">Status: Draft</span>
                </div>
            );
            buttonUI = (
                <button
                    onClick={() => onChangeStatus('Dipublikasi')}
                    disabled={statusLoading}
                    className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 disabled:opacity-50"
                >
                    {statusLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                    Publikasikan Latihan
                </button>
            );
            break;
        
        case 'Dipublikasi':
            statusUI = (
                <div className="flex items-center gap-2 text-green-600">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-semibold">Status: Dipublikasi</span>
                </div>
            );
            buttonUI = (
                <button
                    onClick={() => onChangeStatus('Draft')}
                    disabled={statusLoading}
                    className="flex items-center gap-2 py-2 px-4 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 disabled:opacity-50"
                >
                    {statusLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldOff className="w-5 h-5" />}
                    Kembalikan ke Draft
                </button>
            );
            break;
            
        case 'Ditutup':
            statusUI = (
                <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-5 h-5" />
                    <span className="font-semibold">Status: Ditutup</span>
                </div>
            );
            buttonUI = (
                <p className="text-sm text-red-700">Ujian ini sudah ditutup dan tidak bisa diubah lagi.</p>
            );
            break;
    }

    return (
        <div className="border-t mt-4 pt-4 flex flex-col md:flex-row justify-between items-start gap-4">
            
            {/* Kolom Kiri: Info Status & Deadline */}
            <div className="space-y-3">
                {/* Info Status */}
                <div>
                    {statusUI}
                    {examData.status === 'Draft' && (
                        <p className="text-sm text-gray-500 mt-1">
                            Siswa belum dapat melihat Ujian ini.
                        </p>
                    )}
                    {examData.status === 'Dipublikasi' && (
                        <p className="text-sm text-gray-500 mt-1">
                            Siswa sudah dapat melihat dan mengerjakan Ujian ini.
                        </p>
                    )}
                    {examData.status === 'Ditutup' && (
                        <p className="text-sm text-gray-500 mt-1">
                            Ujian telah ditutup dan tidak bisa dikerjakan lagi.
                        </p>
                    )}
                </div>

                {/* --- BARU: Info & Edit Deadline --- */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Batas Akhir Pengerjaan (Deadline)
                    </label>
                    
                    {isEditingDeadline ? (
                        // Tampilan Edit
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="datetime-local"
                                value={newDeadline}
                                onChange={(e) => onNewDeadlineChange(e.target.value)}
                                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                disabled={deadlineLoading}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={onUpdateDeadline}
                                    disabled={deadlineLoading}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {deadlineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Simpan
                                </button>
                                <button
                                    onClick={onCancelEditDeadline}
                                    disabled={deadlineLoading}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-gray-700 border border-gray-300 font-semibold rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <X className="w-4 h-4" /> Batal
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Tampilan Normal
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-800 p-2 bg-gray-50 rounded-md border">
                                <Clock className="w-5 h-5 text-gray-500" />
                                <span className="font-semibold">{formattedDeadline}</span>
                            </div>
                            {examData.status !== 'Ditutup' && (
                                <button
                                    onClick={onOpenEditDeadline}
                                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                                >
                                    <Edit2 className="w-4 h-4" /> Ubah Deadline
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Kolom Kanan: Tombol Aksi Status */}
            <div className="flex-shrink-0">
                {buttonUI}
            </div>
        </div>
    );
}


const SoalListItem = ({ soal, onDelete, onEdit, isDisabled }: { 
// ... (tidak berubah)
    soal: SoalData, 
    onDelete: (soalId: string, urutan: number) => void,
    onEdit: (soal: SoalData) => void,
    isDisabled: boolean 
}) => {
    
    const kunciBenar = soal.kunci_jawaban; 

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                        {soal.urutan}
                    </span>
                    <span className="text-sm font-medium text-gray-600">
                        (Poin: {soal.poin})
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onEdit(soal)} // Panggil onEdit dengan data soal
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={isDisabled} // Tombol ini juga akan disable jika status bukan draft
                        >
                        <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button 
                        onClick={() => onDelete(soal.id, soal.urutan)}
                        className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={isDisabled}
                    >
                        <Trash2 className="w-4 h-4" /> Hapus
                    </button>
                </div>
            </div>

            <div className="pt-3">
                <p className="text-gray-800 font-medium mb-3 whitespace-pre-wrap">{soal.pertanyaan}</p>
                
                {soal.tipe_soal === 'Pilihan Ganda' && soal.opsi && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {['A', 'B', 'C', 'D'].map(key => {
                            const isCorrect = kunciBenar === key;
                            return (
                                <div 
                                    key={key} 
                                    className={`
                                        flex items-center gap-2 p-2 rounded
                                        ${isCorrect 
                                            ? 'bg-green-100 border border-green-300' 
                                            : 'bg-gray-100'
                                        }
                                    `}
                                >
                                    <span className={`font-bold ${isCorrect ? 'text-green-800' : 'text-gray-700'}`}>{key}.</span>
                                    <span className={isCorrect ? 'text-green-800' : 'text-gray-700'}>{soal.opsi?.[key]}</span>
                                    {isCorrect && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {soal.tipe_soal === 'Esai' && soal.rubrik_penilaian && (
                     <div className="text-sm mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-md">
                        <p className="font-semibold text-blue-800">Rubrik/Kunci Jawaban:</p>
                        <p className="text-blue-700 whitespace-pre-wrap">{soal.rubrik_penilaian}</p>
                    </div>
                )}
                {soal.tipe_soal === 'Esai Uraian' && (
<div className="text-sm mt-2 p-3 bg-purple-50 border-l-4 border-purple-400 rounded-r-md">
 
 {/* Tampilkan Rubrik jika ada */}
 {soal.rubrik_penilaian && (
<>
 <p className="font-semibold text-purple-800">Rubrik/Kunci Jawaban:</p>
<p className="text-purple-700 whitespace-pre-wrap mb-2">{soal.rubrik_penilaian}</p>
</>
 )}

{/* Tampilkan Jumlah Input */}
 <p className="font-semibold text-purple-800">Jumlah input jawaban: <strong>{soal.jumlah_input || 'N/A'}</strong></p>

 </div>
)}
            </div>
        </div>
    );
};

export default TeacherExamManagePage;

