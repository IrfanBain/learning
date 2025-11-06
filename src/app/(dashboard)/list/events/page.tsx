"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext'; // (Sesuaikan path)
import { db } from '@/lib/firebaseConfig'; // (Sesuaikan path)
import { type User as AuthUser } from 'firebase/auth';
import {
    collection,
    query,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    DocumentReference,
    orderBy,
    onSnapshot,
    QuerySnapshot,
    DocumentData,
    where, 
    QueryConstraint,
    getDocs // <-- Pastikan getDocs diimpor
} from 'firebase/firestore';
import { 
    FileText,
    Loader2, 
    AlertTriangle, 
    Calendar as CalendarIcon,
    Plus,
    X,
    Save,
    Trash2,
    Edit,
    Users,
    User,
    School,
    Clock,
    CheckCircle,
    CalendarCheck,
    CalendarClock,
    CalendarHeart
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- DEFINISI TIPE ---

interface EventDoc {
    id: string;
    judul: string;
    deskripsi: string;
    tanggal_mulai: Timestamp;
    tanggal_selesai: Timestamp;
    allDay: boolean;
    kategori: "Ujian" | "Libur" | "Acara Sekolah" | "Rapat" | "Lainnya";
    target_audiens: "Semua" | "Guru" | "Siswa";
    target_kelas_ref: DocumentReference | null;
    pembuat_ref: DocumentReference;
    pembuat_nama: string;
    tanggal_dibuat: Timestamp;
    kelasNama?: string;
}

interface DropdownItem {
    id: string;
    nama: string;
}

type EventFormData = {
    judul: string;
    deskripsi: string;
    tanggal_mulai: string;
    tanggal_selesai: string;
    allDay: boolean;
    kategori: "Ujian" | "Libur" | "Acara Sekolah" | "Rapat" | "Lainnya";
    target_audiens: "Semua" | "Guru" | "Siswa";
    target_kelas_ref: string; // ID atau "semua"
};

const initialFormData: EventFormData = {
    judul: "",
    deskripsi: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    allDay: false,
    kategori: "Acara Sekolah",
    target_audiens: "Semua",
    target_kelas_ref: "semua",
};

// --- FUNGSI HELPER (Status Tanggal) ---
const getRelativeDateStatus = (startDate: Timestamp) => {
    // ... (Fungsi ini tidak berubah)
    if (!startDate) return { text: "Mendatang", color: "bg-gray-100 text-gray-800" };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDateTs = startDate.toDate();
    const eventDate = new Date(eventDateTs.getFullYear(), eventDateTs.getMonth(), eventDateTs.getDate());
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { text: "Selesai", color: "bg-red-100 text-red-800" };
    }
    if (diffDays === 0) {
        return { text: "Hari Ini", color: "bg-green-100 text-green-800" };
    }
    if (diffDays === 1) {
        return { text: "Besok", color: "bg-yellow-100 text-yellow-800" };
    }
    return { text: "Mendatang", color: "bg-blue-100 text-blue-800" };
};
// --- AKHIR HELPER ---


// --- KOMPONEN UTAMA ---
const EventsPage = () => { // <-- Ubah nama komponen agar lebih generik
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    // State Data
    const [events, setEvents] = useState<EventDoc[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    
    // State UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState<EventDoc | null>(null);
    
    // --- BARU: State untuk data pengguna (role, nama, kelas) ---
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [adminName, setAdminName] = useState<string>("Admin");

    // --- 1. Ambil Data Pengguna (Role, Nama, Kelas) ---
    useEffect(() => {
        if (user?.uid && !authLoading) {
            const fetchUserData = async () => {
                setLoadingUser(true);
                let userRole: string | null = null;
                let userProfileData: DocumentData | null = null;
                
                try {
                    // Cek 'users' dulu (untuk Admin)
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        userProfileData = userDocSnap.data();
                        userRole = userProfileData.role;
                        if (userRole === 'admin') {
                            setAdminName(userProfileData.nama_lengkap || user.displayName || "Admin");
                        }
                    } else {
                        // Jika tidak ada, cek 'teachers'
                        const teacherDocRef = doc(db, "teachers", user.uid);
                        const teacherDocSnap = await getDoc(teacherDocRef);
                        if (teacherDocSnap.exists()) {
                            userProfileData = teacherDocSnap.data();
                            userRole = "teacher"; // Asumsi 'role' tidak disimpan di doc 'teachers'
                        } else {
                            // Jika tidak ada, cek 'students'
                             const studentDocRef = doc(db, "students", user.uid);
                             const studentDocSnap = await getDoc(studentDocRef);
                             if (studentDocSnap.exists()) {
                                 userProfileData = studentDocSnap.data();
                                 userRole = "student";
                             } else {
                                 throw new Error("Data profil Anda tidak ditemukan.");
                             }
                        }
                    }
                    
                    // Simpan data lengkap user (termasuk role, kelas_ref, dll)
                    setUserData({ ...userProfileData, role: userRole });
                    
                } catch (err: any) {
                    console.error("Gagal mengambil data user:", err);
                    setError(err.message);
                } finally {
                    setLoadingUser(false);
                }
            };
            fetchUserData();
        }
        if (!user && !authLoading) {
            setLoading(false);
            setLoadingUser(false);
        }
    }, [user, authLoading]);

    // --- 2. Ambil Data Kelas (untuk dropdown di modal Admin) ---
    useEffect(() => {
        // Hanya ambil data ini jika pengguna adalah admin (agar tidak boros)
        if (userData?.role === 'admin') {
            const fetchAdminDropdowns = async () => {
                try {
                    const kelasSnap = await getDocs(query(collection(db, "classes"), orderBy("tingkat")));
                    const kelasData = kelasSnap.docs.map(doc => ({
                        id: doc.id,
                        nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
                    }));
                    setAvailableKelas(kelasData);
                } catch (err) {
                    console.error("Gagal mengambil data kelas:", err);
                    toast.error("Gagal memuat data kelas.");
                }
            };
            fetchAdminDropdowns();
        }
    }, [userData]); // <-- Jalankan saat userData (termasuk role) siap

    // --- 3. Ambil Daftar Acara (Real-time & Difilter) ---
    useEffect(() => {
        // Jangan jalankan jika data user belum siap
        if (loadingUser || !userData) {
            if (!authLoading && !loadingUser) setLoading(false);
            return;
        }

        setLoading(true);
        const role = userData.role;
        
        // --- LOGIKA FILTER BARU ---
        const queryConstraints: QueryConstraint[] = [];

        if (role === 'admin') {
            // Admin melihat SEMUA
        } else if (role === 'teacher') {
            // Guru melihat "Semua" ATAU "Guru"
            queryConstraints.push(where("target_audiens", "in", ["Semua", "Guru"]));
        } else if (role === 'student') {
            // Siswa melihat "Semua" ATAU "Siswa"
            queryConstraints.push(where("target_audiens", "in", ["Semua", "Siswa"]));
        } else {
             setLoading(false);
             setError("Role Anda tidak dikenali.");
             return;
        }

        queryConstraints.push(orderBy("tanggal_mulai", "desc"));

        const q = query(
            collection(db, "events"),
            ...queryConstraints
        );

        const unsubscribe = onSnapshot(q, 
            async (querySnapshot: QuerySnapshot) => {
                const eventsDataPromises: Promise<EventDoc>[] = [];
                
                querySnapshot.forEach((docSnap) => {
                    const eventData = { id: docSnap.id, ...docSnap.data() } as EventDoc;
                    
                    // --- CLIENT-SIDE FILTER (UNTUK SISWA) ---
                    // (Ini menghindari query 'IN' yang rumit di rules)
                    if (role === 'student' && userData.kelas_ref) {
                        // Jika target_kelas_ref ada, pastikan itu kelas siswa
                        if (eventData.target_kelas_ref && eventData.target_kelas_ref.id !== userData.kelas_ref.id) {
                            return; // Lewati acara ini, bukan untuk kelas dia
                        }
                    }
                    // (Admin & Guru lolos)

                    // Ambil nama kelas jika ada ref
                    const promise = (async () => {
                        if (eventData.target_kelas_ref) {
                            try {
                                const kelasSnap = await getDoc(eventData.target_kelas_ref);
                                if (kelasSnap.exists()) {
                                    const kls = kelasSnap.data();
                                    eventData.kelasNama = `${kls?.tingkat || ''} ${kls?.nama_kelas || ''}`.trim();
                                }
                            } catch (e) {
                                eventData.kelasNama = "Error";
                            }
                        }
                        return eventData;
                    })();
                    eventsDataPromises.push(promise);
                });
                
                const eventsData = await Promise.all(eventsDataPromises);
                
                setEvents(eventsData);
                setLoading(false);
                setError(null);
            }, 
            (err: any) => {
                console.error("Error listening to events:", err);
                let userMessage = "Gagal memuat acara. ";
                if (err.code === 'permission-denied') {
                    userMessage += "Izin ditolak. Pastikan Security Rules Anda benar.";
                } else if (err.code === 'failed-precondition') {
                    userMessage += "Indeks Komposit diperlukan. Cek konsol (F12).";
                }
                setError(userMessage);
                toast.error(userMessage);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user, authLoading, loadingUser, userData]); // <-- Dependensi diubah ke userData

    // --- 4. Handler untuk Hapus (Hanya Admin) ---
    const executeDelete = async (docId: string, title: string) => {
        // ... (fungsi tidak berubah)
        const loadingToastId = toast.loading(`Menghapus "${title}"...`);
        try {
            await deleteDoc(doc(db, "events", docId));
            toast.success("Acara berhasil dihapus.", { id: loadingToastId });
        } catch (err: any) {
            console.error("Error deleting event:", err);
            toast.error(err.message || "Gagal menghapus.", { id: loadingToastId });
        }
    };

    const handleDelete = (docId: string, title: string) => {
        // ... (fungsi tidak berubah)
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Hapus Acara?</p>
                        <p className="text-sm text-gray-600">
                            Anda akan menghapus <span className="font-bold">{title}</span>.
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
                            executeDelete(docId, title); 
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
            {/* Header Halaman */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Kalender & Acara</h1>
                
                {/* --- MODIFIKASI: Tombol hanya untuk Admin --- */}
                {userData?.role === 'admin' && (
                    <button
                        onClick={() => {
                            setIsEditing(null); 
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    >
                        <Plus className="w-5 h-5" />
                        Buat Acara Baru
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Daftar Acara */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                {/* --- MODIFIKASI: Gunakan 'loadingUser' --- */}
                {loading || loadingUser ? (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat acara...</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <CalendarIcon className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Acara</h3>
                        <p className="text-center">Saat ini belum ada acara atau agenda baru.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {events.map(item => (
                            <EventItem 
                                key={item.id} 
                                item={item}
                                // --- MODIFIKASI: Kirim role ---
                                role={userData?.role || null}
                                onEdit={() => {
                                    setIsEditing(item);
                                    setShowModal(true);
                                }}
                                onDelete={() => handleDelete(item.id, item.judul)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Buat/Edit Acara */}
            {showModal && userData?.role === 'admin' && (
                <EventModal 
                    onClose={() => setShowModal(false)}
                    existingData={isEditing} 
                    adminUid={user!.uid} 
                    adminName={adminName}
                    availableKelas={availableKelas}
                />
            )}
        </div>
    );
};

// --- KOMPONEN ITEM (DAFTAR) ---
// --- MODIFIKASI: Terima 'role' ---
const EventItem = ({ item, role, onEdit, onDelete }: { 
    item: EventDoc,
    role: string | null,
    onEdit: () => void,
    onDelete: () => void
}) => {
    
    const status = getRelativeDateStatus(item.tanggal_mulai);
    const startDate = item.tanggal_mulai.toDate().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const endDate = item.tanggal_selesai.toDate().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // (getCategoryChip tidak berubah)
    const getCategoryChip = () => {
        switch(item.kategori) {
            case "Ujian":
                return <span className="flex items-center gap-1 text-xs font-medium bg-red-100 text-red-800 px-2 py-0.5 rounded-full"><FileText className="w-3 h-3" /> Ujian</span>;
            case "Libur":
                return <span className="flex items-center gap-1 text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full"><CalendarHeart className="w-3 h-3" /> Libur</span>;
            case "Rapat":
                return <span className="flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" /> Rapat</span>;
            default:
                return <span className="flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"><CalendarCheck className="w-3 h-3" /> Acara Sekolah</span>;
        }
    };
    
    return (
        <div className="p-4 flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 text-center w-20">
                    <div className={`px-2 py-1 text-sm font-bold rounded-t-md ${status.color}`}>
                        {status.text}
                    </div>
                    <div className="bg-gray-700 text-white p-2 rounded-b-md">
                        <p className="text-2xl font-bold">{item.tanggal_mulai.toDate().getDate()}</p>
                        <p className="text-xs uppercase">{item.tanggal_mulai.toDate().toLocaleString('id-ID', { month: 'short' })}</p>
                    </div>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{item.judul}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {item.deskripsi}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 w-full">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 
                            {item.allDay ? "Seharian" : `${startDate} - ${endDate}`}
                        </span>
                        <span className="text-gray-300">|</span>
                        {getCategoryChip()}
                        <span className="text-gray-300">|</span>
                        <span className="font-medium">
                            Target: {item.target_audiens} {item.kelasNama ? `(${item.kelasNama})` : ''}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* --- MODIFIKASI: Tombol Aksi (Hanya Admin) --- */}
            {role === 'admin' && (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                    <button
                        onClick={onEdit}
                        title="Edit Acara"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        title="Hapus Acara"
                        className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium py-1 px-2 rounded-md hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

// --- KOMPONEN MODAL (UNTUK BUAT/EDIT) ---
// (Tidak ada perubahan di sini)
const EventModal = ({ onClose, existingData, adminUid, adminName, availableKelas }: {
    onClose: () => void;
    existingData: EventDoc | null;
    adminUid: string;
    adminName: string;
    availableKelas: DropdownItem[];
}) => {
    
    // Helper untuk format 'YYYY-MM-DDTHH:mm'
    const toDateTimeLocal = (ts: Timestamp | null) => {
        if (!ts) return "";
        const d = ts.toDate();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };
    
    const [formData, setFormData] = useState<EventFormData>(
        existingData ? 
        { // Mode Edit
            judul: existingData.judul,
            deskripsi: existingData.deskripsi,
            tanggal_mulai: toDateTimeLocal(existingData.tanggal_mulai),
            tanggal_selesai: toDateTimeLocal(existingData.tanggal_selesai),
            allDay: existingData.allDay,
            kategori: existingData.kategori,
            target_audiens: existingData.target_audiens,
            target_kelas_ref: existingData.target_kelas_ref?.id || "semua"
        } : 
        initialFormData // Mode Buat Baru
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const isEditMode = existingData !== null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.judul || !formData.tanggal_mulai || !formData.tanggal_selesai) {
            toast.error("Judul dan Tanggal Mulai/Selesai wajib diisi.");
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const dataToSave = {
                judul: formData.judul,
                deskripsi: formData.deskripsi,
                tanggal_mulai: Timestamp.fromDate(new Date(formData.tanggal_mulai)),
                tanggal_selesai: Timestamp.fromDate(new Date(formData.tanggal_selesai)),
                allDay: formData.allDay,
                kategori: formData.kategori,
                target_audiens: formData.target_audiens,
                target_kelas_ref: formData.target_kelas_ref === "semua" 
                                    ? null 
                                    : doc(db, "classes", formData.target_kelas_ref)
            };

            if (isEditMode) {
                // --- MODE EDIT (Update Dokumen) ---
                const docRef = doc(db, "events", existingData!.id);
                await updateDoc(docRef, dataToSave);
                toast.success("Acara berhasil diperbarui!");
            } else {
                // --- MODE BUAT BARU (Add Dokumen) ---
                const fullDataToSave = {
                    ...dataToSave,
                    tanggal_dibuat: serverTimestamp(),
                    pembuat_ref: doc(db, "users", adminUid),
                    pembuat_nama: adminName
                };
                await addDoc(collection(db, "events"), fullDataToSave);
                toast.success("Acara baru berhasil dibuat!");
            }
            onClose(); 

        } catch (err: any) {
            console.error("Error submitting event:", err);
            toast.error(err.message || "Gagal menyimpan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto"
            // onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-6 z-50 my-auto"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEditMode ? "Edit Acara" : "Buat Acara Baru"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* (Sisa form tidak berubah) */}
                    <div>
                        <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul Acara <span className="text-red-500">*</span></label>
                        <input
                            type="text" id="judul" name="judul"
                            value={formData.judul} onChange={handleChange}
                            className="w-full input-style" required
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="tanggal_mulai" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai <span className="text-red-500">*</span></label>
                            <input
                                type={formData.allDay ? "date" : "datetime-local"}
                                id="tanggal_mulai" name="tanggal_mulai"
                                value={formData.tanggal_mulai} onChange={handleChange}
                                className="w-full input-style" required
                            />
                        </div>
                        <div>
                            <label htmlFor="tanggal_selesai" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai <span className="text-red-500">*</span></label>
                            <input
                                type={formData.allDay ? "date" : "datetime-local"}
                                id="tanggal_selesai" name="tanggal_selesai"
                                value={formData.tanggal_selesai} onChange={handleChange}
                                className="w-full input-style" required
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        <input
                            type="checkbox" id="allDay" name="allDay"
                            checked={formData.allDay} onChange={handleChange}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="allDay" className="ml-2 block text-sm text-gray-900">
                            Acara Seharian (Tanpa Jam)
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="kategori" className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                            <select
                                id="kategori" name="kategori"
                                value={formData.kategori} onChange={handleChange}
                                className="w-full input-style"
                            >
                                <option value="Acara Sekolah">Acara Sekolah</option>
                                <option value="Ujian">Ujian</option>
                                <option value="Libur">Libur</option>
                                <option value="Rapat">Rapat</option>
                                <option value="Lainnya">Lainnya</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="target_audiens" className="block text-sm font-medium text-gray-700 mb-1">Target Audiens</label>
                            <select
                                id="target_audiens" name="target_audiens"
                                value={formData.target_audiens} onChange={handleChange}
                                className="w-full input-style"
                            >
                                <option value="Semua">Semua (Siswa & Guru)</option>
                                <option value="Siswa">Hanya Siswa</option>
                                <option value="Guru">Hanya Guru</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="target_kelas_ref" className="block text-sm font-medium text-gray-700 mb-1">Target Kelas (Opsional)</label>
                        <select
                            id="target_kelas_ref" name="target_kelas_ref"
                            value={formData.target_kelas_ref} onChange={handleChange}
                            className="w-full input-style"
                        >
                            <option value="semua">Semua Kelas (Default)</option>
                            {availableKelas.map(kelas => (
                                <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                        <textarea
                            id="deskripsi" name="deskripsi"
                            rows={4}
                            value={formData.deskripsi} onChange={handleChange}
                            className="w-full input-style"
                            placeholder="Tuliskan keterangan tambahan... (Opsional)"
                        ></textarea>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-2 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-100"
                        >
                            Batal
                        </button>
                         <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center justify-center gap-2 py-2 px-6 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isEditMode ? "Simpan Perubahan" : "Simpan Acara"}
                        </button>
                    </div>
                </form>
            </div>
            {/* Helper style untuk input (agar tidak berulang) */}
            <style jsx global>{`
                .input-style {
                    display: block;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #D1D5DB; /* border-gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                }
                .input-style:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    border-color: #3B82F6; /* border-blue-500 */
                    box-shadow: 0 0 0 2px #BFDBFE; /* ring-blue-500 */
                }
            `}</style>
        </div>
    );
};

export default EventsPage;
