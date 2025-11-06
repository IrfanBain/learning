"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    QueryConstraint 
} from 'firebase/firestore';
import { 
    Loader2, 
    AlertTriangle, 
    Megaphone,
    Plus,
    X,
    Send,
    Trash2,
    Edit,
    Users,
    User,
    School
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- (Definisi Tipe) ---
interface AnnouncementDoc {
    id: string;
    judul: string;
    isi: string;
    tanggal_dibuat: Timestamp; 
    admin_ref: DocumentReference;
    admin_nama: string;
    target_audiens: "Semua" | "Siswa" | "Guru"; // Ini adalah data, tetap "Guru" (Indonesia)
}
type AnnouncementFormData = {
    judul: string;
    isi: string;
    target_audiens: "Semua" | "Siswa" | "Guru"; // Ini adalah data
};
const initialFormData: AnnouncementFormData = {
    judul: "",
    isi: "",
    target_audiens: "Semua",
};
// (Kita tidak perlu AuthUserData lagi, kita gunakan AuthUser)

// --- KOMPONEN UTAMA ---
const AnnouncementsPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUser | null, loading: boolean };
    
    const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
    const [adminName, setAdminName] = useState<string>("Admin"); 
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState<AnnouncementDoc | null>(null);

    // --- MODIFIKASI: Tipe state role ---
    const [userRole, setUserRole] = useState<"student" | "teacher" | "admin" | null>(null);

    // --- 1. Ambil Data Role & Nama ---
    useEffect(() => {
        if (user?.uid && !authLoading) {
            const fetchUserData = async () => {
                try {
                    // Asumsi: SEMUA data user (termasuk role & nama) ada di koleksi 'users'
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        const role = userData.role; // Ambil role (misal: 'teacher')
                        
                        if (role === 'admin') {
                            setAdminName(userData.nama_lengkap || user.displayName || "Admin");
                            setUserRole("admin");
                        // --- MODIFIKASI: Gunakan 'teacher' ---
                        } else if (role === 'teacher') {
                            setUserRole("teacher");
                        // --- MODIFIKASI: Gunakan 'student' ---
                        } else if (role === 'student') {
                            setUserRole("student");
                        } else {
                            throw new Error("Role Anda tidak dikenali.");
                        }
                    } else {
                        // Coba cek 'teachers' jika di 'users' tidak ada
                        const teacherDocRef = doc(db, "teachers", user.uid);
                        const teacherDocSnap = await getDoc(teacherDocRef);
                        if (teacherDocSnap.exists()) {
                            // --- MODIFIKASI: Gunakan 'teacher' ---
                             setUserRole("teacher");
                        } else {
                             // Coba cek 'students'
                             const studentDocRef = doc(db, "students", user.uid);
                             const studentDocSnap = await getDoc(studentDocRef);
                             if (studentDocSnap.exists()) {
                                // --- MODIFIKASI: Gunakan 'student' ---
                                 setUserRole("student");
                             } else {
                                 throw new Error("Data profil Anda tidak ditemukan.");
                             }
                        }
                    }
                } catch (err: any) {
                    console.error("Gagal mengambil data user:", err);
                    setError(err.message);
                }
            };
            fetchUserData();
        }
        if (!user && !authLoading) {
            setLoading(false); 
        }
    }, [user, authLoading]);

    // --- 2. Ambil Daftar Pengumuman (Real-time & Difilter) ---
    useEffect(() => {
        if (!userRole) {
            if (!authLoading) setLoading(false);
            return;
        }

        setLoading(true);

        const queryConstraints: QueryConstraint[] = [];

        if (userRole === 'admin') {
            // Admin melihat SEMUA
        // --- MODIFIKASI: Gunakan 'teacher' ---
        } else if (userRole === 'teacher') {
            // Guru melihat "Semua" ATAU "Guru" (data 'target_audiens' tetap 'Guru')
            queryConstraints.push(where("target_audiens", "in", ["Semua", "Guru"]));
        // --- MODIFIKASI: Gunakan 'student' ---
        } else if (userRole === 'student') {
            queryConstraints.push(where("target_audiens", "in", ["Semua", "Siswa"]));
        }

        queryConstraints.push(orderBy("tanggal_dibuat", "desc"));

        const q = query(
            collection(db, "announcements"),
            ...queryConstraints
        );

        const unsubscribe = onSnapshot(q, 
            (querySnapshot: QuerySnapshot) => {
                const announcementsData: AnnouncementDoc[] = [];
                querySnapshot.forEach((doc) => {
                    announcementsData.push({ id: doc.id, ...doc.data() } as AnnouncementDoc);
                });
                
                setAnnouncements(announcementsData);
                setLoading(false);
                setError(null);
            }, 
            (err: any) => {
                console.error("Error listening to announcements:", err);
                let userMessage = "Gagal memuat pengumuman. ";
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
    }, [userRole]); // <-- Dependensi sudah benar

    // --- (Fungsi Hapus tidak berubah) ---
    const executeDelete = async (docId: string, title: string) => {
        const loadingToastId = toast.loading(`Menghapus "${title}"...`);
        try {
            await deleteDoc(doc(db, "announcements", docId));
            toast.success("Pengumuman berhasil dihapus.", { id: loadingToastId });
        } catch (err: any) {
            console.error("Error deleting announcement:", err);
            toast.error(err.message || "Gagal menghapus.", { id: loadingToastId });
        }
    };
    const handleDelete = (docId: string, title: string) => {
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Hapus Pengumuman?</p>
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
    // (Render tidak berubah, 'userRole' sudah otomatis 'teacher')
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* Header Halaman */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Pengumuman</h1>
                
                {userRole === 'admin' && (
                    <button
                        onClick={() => {
                            setIsEditing(null); 
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    >
                        <Plus className="w-5 h-5" />
                        Buat Pengumuman
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            {/* Daftar Pengumuman */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                {loading ? (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat pengumuman...</span>
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <Megaphone className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Pengumuman</h3>
                        <p className="text-center">Saat ini belum ada pengumuman baru.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {announcements.map(item => (
                            <AnnouncementItem 
                                key={item.id} 
                                item={item}
                                role={userRole} 
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

            {/* Modal Buat/Edit Pengumuman */}
            {showModal && userRole === 'admin' && (
                <AnnouncementModal 
                    onClose={() => setShowModal(false)}
                    existingData={isEditing} 
                    adminUid={user!.uid} 
                    adminName={adminName}
                />
            )}
        </div>
    );
};

// --- KOMPONEN ITEM (DAFTAR) ---
// --- MODIFIKASI: Tipe 'role' ---
const AnnouncementItem = ({ item, role, onEdit, onDelete }: { 
    item: AnnouncementDoc,
    role: "admin" | "teacher" | "student" | null, // <-- MODIFIKASI
    onEdit: () => void,
    onDelete: () => void
}) => {
    
    // (Fungsi 'getAudienceChip' tidak berubah, tetap "Guru")
    const getAudienceChip = () => {
        switch(item.target_audiens) {
            case "Siswa":
                return <span className="flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"><User className="w-3 h-3" /> Siswa</span>;
            case "Guru":
                return <span className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full"><School className="w-3 h-3" /> Guru</span>;
            default:
                return <span className="flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" /> Semua</span>;
        }
    };
    
    return (
        <div className="p-4 flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-blue-100 text-blue-600 p-2 rounded-full">
                    <Megaphone className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{item.judul}</h3>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        {item.isi}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 w-full">
                        <span>Oleh: <span className="font-medium">{item.admin_nama}</span></span>
                        <span className="text-gray-300">|</span>
                        
                        <span>
                            {item.tanggal_dibuat 
                                ? item.tanggal_dibuat.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                                : "Baru saja..."
                            }
                        </span>
                        
                        <span className="text-gray-300">|</span>
                        {getAudienceChip()}
                    </div>
                </div>
            </div>
            
            {/* (Render kondisional tidak berubah, 'userRole' sudah otomatis 'teacher') */}
            {role === 'admin' && (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                    <button
                        onClick={onEdit}
                        title="Edit Pengumuman"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        title="Hapus Pengumuman"
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
// (Tidak ada perubahan di sini, <option value="Guru"> tetap "Guru")
const AnnouncementModal = ({ onClose, existingData, adminUid, adminName }: {
    onClose: () => void;
    existingData: AnnouncementDoc | null;
    adminUid: string;
    adminName: string;
}) => {
    const [formData, setFormData] = useState<AnnouncementFormData>(
        existingData ? 
        { 
            judul: existingData.judul,
            isi: existingData.isi,
            target_audiens: existingData.target_audiens
        } : 
        initialFormData
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const isEditMode = existingData !== null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as any }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.judul || !formData.isi) {
            toast.error("Judul dan Isi wajib diisi.");
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            if (isEditMode) {
                const docRef = doc(db, "announcements", existingData!.id);
                await updateDoc(docRef, {
                    judul: formData.judul,
                    isi: formData.isi,
                    target_audiens: formData.target_audiens
                });
                toast.success("Pengumuman berhasil diperbarui!");
            } else {
                const dataToSave = {
                    ...formData,
                    tanggal_dibuat: serverTimestamp(),
                    admin_ref: doc(db, "users", adminUid),
                    admin_nama: adminName
                };
                await addDoc(collection(db, "announcements"), dataToSave);
                toast.success("Pengumuman berhasil dipublikasikan!");
            }
            onClose(); 

        } catch (err: any) {
            console.error("Error submitting announcement:", err);
            toast.error(err.message || "Gagal menyimpan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 z-50"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEditMode ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            id="judul"
                            name="judul"
                            value={formData.judul}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="isi" className="block text-sm font-medium text-gray-700 mb-1">Isi Pengumuman <span className="text-red-500">*</span></label>
                        <textarea
                            id="isi"
                            name="isi"
                            rows={8}
                            value={formData.isi}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Tuliskan isi pengumuman lengkap di sini..."
                            required
                        ></textarea>
                    </div>
                     <div>
                        <label htmlFor="target_audiens" className="block text-sm font-medium text-gray-700 mb-1">Target Audiens <span className="text-red-500">*</span></label>
                        <select
                            id="target_audiens"
                            name="target_audiens"
                            value={formData.target_audiens}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="Semua">Semua (Siswa & Guru)</option>
                            <option value="Siswa">Hanya Siswa</option>
                            <option value="Guru">Hanya Guru</option>
                        </select>
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
                                <Send className="w-5 h-5" />
                            )}
                            {isEditMode ? "Simpan Perubahan" : "Publikasikan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AnnouncementsPage;

