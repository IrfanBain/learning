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
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    DocumentReference,
    orderBy,
    onSnapshot, 
    QuerySnapshot,
    DocumentData,
    QueryConstraint,
    increment
} from 'firebase/firestore';
import { 
    Loader2, 
    FileText, 
    Plus, 
    AlertTriangle, 
    MessageSquare,
    Clock, 
    CheckCircle,
    Lock,
    Unlock,
    Trash2,
    ChevronRight,
    Book,
    Users,
    Edit,
    Eye,
    EyeOff,
    Send,
    X 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// --- DEFINISI TIPE ---

interface DropdownItem {
    id: string;
    nama: string;
}
interface MapelData {
    nama_mapel: string;
}
interface KelasData {
    tingkat: string;
    nama_kelas: string;
}

interface TopicDoc {
    id: string;
    judul: string;
    isi_topik: string;
    status: "Draft" | "Dibuka" | "Ditutup";
    tanggal_dibuat: Timestamp;
    update_terakhir: Timestamp;
    guru_ref: DocumentReference;
    guru_nama: string; // <-- Ini yang gagal
    guru_foto: string; // <-- Ini yang gagal
    kelas_ref: DocumentReference | null; 
    mapel_ref: DocumentReference;
    jumlah_balasan: number;
    mapelNama?: string;
    kelasNama?: string;
}

type TopicFormData = {
    judul: string;
    isi_topik: string;
    mapel_ref: string; // ID
    kelas_ref: string; // ID atau "semua"
};

const initialFormData: TopicFormData = {
    judul: "",
    isi_topik: "",
    mapel_ref: "",
    kelas_ref: "semua",
};

// --- MODIFIKASI: Tipe data 'user' dari useAuth ---
interface MergedUserData extends AuthUser {
    // (AuthUser sudah punya uid, displayName, photoURL)
    // 'name' adalah field kustom Anda dari debug
    name: string; 
    role: "student" | "teacher" | "admin";
    kelas_ref?: DocumentReference;
}

// --- KOMPONEN UTAMA ---
const DiscussionPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: MergedUserData | null, loading: boolean };
    const router = useRouter();

    // (State tidak berubah)
    const [topicList, setTopicList] = useState<TopicDoc[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState<TopicDoc | null>(null);
    const userRole = user?.role || null;
    
    // (useEffect 'fetchDropdownData' tidak berubah)
    useEffect(() => {
        if (userRole === 'teacher' || userRole === 'admin') {
            const fetchDropdownData = async () => {
                try {
                    const mapelQuery = query(collection(db, "subjects"));
                    const mapelSnapshot = await getDocs(mapelQuery);
                    const mapelData = mapelSnapshot.docs.map(doc => ({
                        id: doc.id,
                        nama: (doc.data() as MapelData).nama_mapel || "Tanpa Nama"
                    }));
                    setAvailableMapel(mapelData);

                    const kelasQuery = query(collection(db, "classes"));
                    const kelasSnapshot = await getDocs(kelasQuery);
                    const kelasData = kelasSnapshot.docs.map(doc => {
                        const kls = doc.data() as KelasData;
                        return {
                            id: doc.id,
                            nama: `${kls.tingkat || ''} ${kls.nama_kelas || 'Tanpa Nama'}`.trim()
                        }
                    });
                    setAvailableKelas(kelasData);
                } catch (err: any) {
                    console.error("Error fetching dropdown data:", err);
                    toast.error("Gagal memuat data mapel & kelas.");
                }
            };
            fetchDropdownData();
        }
    }, [userRole]);

    // (useEffect 'fetchTopicList' tidak berubah)
    useEffect(() => {
  if (!user) return;
  setLoading(true);

  // helper buat gabungin topik tanpa duplikat
  const mergeUniqueTopics = (prev: TopicDoc[], newOnes: TopicDoc[]) => {
    const map = new Map<string, TopicDoc>();
    [...prev, ...newOnes].forEach(t => map.set(t.id, t));
    return Array.from(map.values()).sort((a, b) =>
      b.update_terakhir?.toMillis() - a.update_terakhir?.toMillis()
    );
  };

  // helper buat isi nama mapel & kelas
  const enrichTopic = async (id: string, data: DocumentData): Promise<TopicDoc> => {
    let mapelNama = "N/A";
    let kelasNama = "Semua Kelas";

    try {
      if (data.mapel_ref) {
        const mapelSnap = await getDoc(data.mapel_ref);
        mapelNama = (mapelSnap.data() as MapelData)?.nama_mapel || "Mapel Dihapus";
      }
    } catch {}

    try {
      if (data.kelas_ref) {
        const kelasSnap = await getDoc(data.kelas_ref);
        if (kelasSnap.exists()) {
          const kls = kelasSnap.data() as KelasData;
          kelasNama = `${kls.tingkat || ""} ${kls.nama_kelas || "Kelas Dihapus"}`.trim();
        }
      }
    } catch {}

    return {
      id,
      ...data,
      mapelNama,
      kelasNama,
    } as TopicDoc;
  };

  const role = user.role;
  let unsubscribe: (() => void) | null = null;
  let unsubKelas: (() => void) | null = null;
  let unsubSemua: (() => void) | null = null;

  const fetchData = async () => {
    try {
      const topicRef = collection(db, "discussion_topic");

      if (role === "admin") {
        const q = query(topicRef, orderBy("update_terakhir", "desc"));
        unsubscribe = onSnapshot(q, async (snapshot) => {
          const topics = await Promise.all(
            snapshot.docs.map(async (docSnap) =>
              enrichTopic(docSnap.id, docSnap.data())
            )
          );
          setTopicList(topics);
          setLoading(false);
        });
      } else if (role === "teacher") {
        const q = query(
          topicRef,
          where("guru_ref", "==", doc(db, "teachers", user.uid)),
          orderBy("update_terakhir", "desc")
        );
        unsubscribe = onSnapshot(q, async (snapshot) => {
          const topics = await Promise.all(
            snapshot.docs.map(async (docSnap) =>
              enrichTopic(docSnap.id, docSnap.data())
            )
          );
          setTopicList(topics);
          setLoading(false);
        });
      } else if (role === "student") {
        if (!user.kelas_ref) {
          setError("Anda (siswa) tidak terdaftar di kelas manapun.");
          setLoading(false);
          return;
        }

        const qKelas = query(
          topicRef,
          where("status", "==", "Dibuka"),
          where("kelas_ref", "==", user.kelas_ref),
          orderBy("update_terakhir", "desc")
        );

        const qSemua = query(
          topicRef,
          where("status", "==", "Dibuka"),
          where("kelas_ref", "==", null),
          orderBy("update_terakhir", "desc")
        );

        unsubKelas = onSnapshot(qKelas, async (snapKelas) => {
          const kelasTopics = await Promise.all(
            snapKelas.docs.map(async (docSnap) =>
              enrichTopic(docSnap.id, docSnap.data())
            )
          );
          setTopicList((prev) => mergeUniqueTopics(prev, kelasTopics));
        });

        unsubSemua = onSnapshot(qSemua, async (snapSemua) => {
          const semuaTopics = await Promise.all(
            snapSemua.docs.map(async (docSnap) =>
              enrichTopic(docSnap.id, docSnap.data())
            )
          );
          setTopicList((prev) => mergeUniqueTopics(prev, semuaTopics));
        });

        setLoading(false);
      } else {
        setError("Peran pengguna tidak dikenali.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data topik diskusi.");
      setLoading(false);
    }
  };

  fetchData();

  return () => {
    if (unsubscribe) unsubscribe();
    if (unsubKelas) unsubKelas();
    if (unsubSemua) unsubSemua();
  };
}, [user, authLoading]);


    // --- 4. Handler Aksi (Submit, Toggle, Delete) ---

    // --- INI PERBAIKANNYA ---
    const handleSubmitTopic = async (formData: TopicFormData, topicId: string | null) => {
        if (!user || (userRole !== 'teacher' && userRole !== 'admin')) {
             toast.error("Hanya guru atau admin yang bisa membuat topik.");
             return false;
        }

        try {
            // HAPUS 'getDoc' profil
            // Ambil data profil (nama/foto) langsung dari 'user' (useAuth)
            const guruRef = doc(db, "teachers", user.uid); 
            // 'user.name' adalah "Rizky Pratama" dari debug Anda
            const guruNama = user.name || "Guru Tanpa Nama"; 
            // 'user.photoURL' adalah 'null' dari debug Anda
            const guruFoto = user.photoURL || ""; 

            const dataToSave = {
                judul: formData.judul,
                isi_topik: formData.isi_topik,
                mapel_ref: doc(db, "subjects", formData.mapel_ref),
                kelas_ref: formData.kelas_ref === "semua" 
                            ? null 
                            : doc(db, "classes", formData.kelas_ref),
            };

            if (topicId) {
                // Mode Edit
                const docRef = doc(db, "discussion_topic", topicId);
                await updateDoc(docRef, dataToSave);
                toast.success("Topik berhasil diperbarui!");
            } else {
                // Mode Create
                const fullData = {
                    ...dataToSave,
                    status: "Draft", 
                    tanggal_dibuat: serverTimestamp(),
                    update_terakhir: serverTimestamp(),
                    guru_ref: guruRef,
                    pembuat_role: user.role,
                    guru_nama: guruNama, // <-- Data yang sudah benar
                    guru_foto: guruFoto, // <-- Data yang sudah benar
                    jumlah_balasan: 0
                };
                await addDoc(collection(db, "discussion_topic"), fullData);
                toast.success("Topik berhasil disimpan sebagai Draft!");
            }
            return true;

        } catch (err: any) {
            console.error("Error submitting topic:", err);
            toast.error(err.message || "Gagal menyimpan topik.");
            return false;
        }
    };
    // --- AKHIR PERBAIKAN ---

    // (Fungsi 'handleToggleStatus' tidak berubah)
    const handleToggleStatus = async (topic: TopicDoc) => {
        const newStatus = topic.status === "Dibuka" ? "Ditutup" : "Dibuka";
        const actionText = newStatus === "Dibuka" ? "Membuka (Publikasi)" : "Menutup";
        const loadingToastId = toast.loading(`${actionText} topik...`);
        try {
            const topicRef = doc(db, "discussion_topic", topic.id);
            await updateDoc(topicRef, {
                status: newStatus,
                ...(newStatus === "Dibuka" && { update_terakhir: serverTimestamp() })
            });
            toast.success(`Topik berhasil ${newStatus.toLowerCase()}!`, { id: loadingToastId });
        } catch (err: any) {
            toast.error(err.message || "Gagal mengubah status.", { id: loadingToastId });
        }
    };

    // (Fungsi 'handleDeleteTopic' tidak berubah)
    const handleDeleteTopic = (topic: TopicDoc) => {
        toast((t) => (
            <div className="flex flex-col gap-3 p-2">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800">Hapus Topik Ini?</p>
                        <p className="text-sm text-gray-600">
                            Anda akan menghapus <span className="font-bold">{topic.judul}</span>.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => toast.dismiss(t.id)} className="btn-secondary">Batal</button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const loadingToastId = toast.loading(`Menghapus topik...`);
                            try {
                                await deleteDoc(doc(db, "discussion_topic", topic.id));
                                toast.success("Topik berhasil dihapus.", { id: loadingToastId });
                            } catch (err: any) {
                                toast.error(err.message || "Gagal menghapus.", { id: loadingToastId });
                            }
                        }}
                        className="btn-danger"
                    >
                        Ya, Hapus
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };


    // --- TAMPILAN (RENDER) ---
    // (Seluruh JSX tidak berubah)
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Forum Diskusi</h1>
                {(userRole === 'teacher' || userRole === 'admin') && (
                    <button
                        onClick={() => {
                            setIsEditing(null);
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    >
                        <Plus className="w-5 h-5" />
                        Buat Topik Baru
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Daftar Topik</h2>
                {loading ? ( 
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat topik...</span>
                    </div>
                ) : topicList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <MessageSquare className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Diskusi</h3>
                        <p className="text-center">Belum ada topik diskusi yang sesuai untuk Anda.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {topicList.map(topic => (
                            <TopicListItem 
                                key={topic.id} 
                                topic={topic}
                                userRole={userRole}
                                userId={user?.uid || ""} 
                                onToggleStatus={handleToggleStatus}
                                onDelete={handleDeleteTopic}
                                onEdit={() => {
                                    setIsEditing(topic);
                                    setShowModal(true);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showModal && (userRole === 'teacher' || userRole === 'admin') && (
                <TopicModal 
                    onClose={() => setShowModal(false)}
                    onSubmit={handleSubmitTopic}
                    existingData={isEditing} 
                    availableMapel={availableMapel}
                    availableKelas={availableKelas}
                    role={userRole}
                />
            )}
            
            <style jsx global>{`
                .btn-danger {
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    background-color: #EF4444; /* bg-red-500 */
                    color: white;
                }
                .btn-danger:hover {
                    background-color: #DC2626; /* bg-red-600 */
                }
                .btn-secondary {
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    background-color: white;
                    border: 1px solid #D1D5DB; /* border-gray-300 */
                    color: #374151; /* text-gray-700 */
                }
                .btn-secondary:hover {
                    background-color: #F9FAFB; /* bg-gray-50 */
                }
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

// --- (Komponen 'TopicListItem' tidak berubah) ---
const TopicListItem = ({ topic, userRole, userId, onToggleStatus, onDelete, onEdit }: { 
    topic: TopicDoc,
    userRole: "admin" | "teacher" | "student" | null,
    userId: string,
    onToggleStatus: (topic: TopicDoc) => void,
    onDelete: (topic: TopicDoc) => void,
    onEdit: () => void
}) => {
    
    const isOwner = (userRole === 'teacher' && topic.guru_ref.id === userId) || userRole === 'admin';
    
    const getStatusChip = (status: TopicDoc['status']) => {
        if (status === 'Dibuka') {
            return <span className="flex items-center gap-1.5 text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full"><Unlock className="w-3 h-3" /> {status}</span>;
        }
        if (status === 'Ditutup') {
            return <span className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full"><Lock className="w-3 h-3" /> {status}</span>;
        }
        return <span className="flex items-center gap-1.5 text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full"><FileText className="w-3 h-3" /> {status}</span>;
    };
    
    const lastUpdate = topic.update_terakhir?.toDate().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }) || '...';

    return (
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition-all">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 text-center w-16">
                    <p className="text-2xl font-bold text-blue-600">{topic.jumlah_balasan}</p>
                    <p className="text-xs text-gray-500">Balasan</p>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{topic.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                            <Book className="w-4 h-4" /> {topic.mapelNama}
                        </span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="flex items-center gap-1 font-medium text-blue-600">
                            <Users className="w-4 h-4" /> {topic.kelasNama}
                        </span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {lastUpdate}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {getStatusChip(topic.status)}
                
                {isOwner && (
                    <>
                        <button
                            onClick={() => onToggleStatus(topic)}
                            title={topic.status === "Dibuka" ? "Tutup Diskusi" : "Buka/Publikasikan Diskusi"}
                            className={`flex items-center gap-1.5 text-sm font-medium py-1 px-2 rounded-md
                                ${topic.status === "Dibuka" 
                                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                }`}
                        >
                            {topic.status === "Dibuka" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        
                        {topic.status === "Draft" && (
                            <button
                                onClick={onEdit}
                                title="Edit Topik"
                                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                            >
                                <Edit className="w-4 h-4" />
                            </button>
                        )}

                        <button
                            onClick={() => onDelete(topic)}
                            title="Hapus Topik"
                            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium py-1 px-2 rounded-md hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
               
                <Link 
                    href={`/list/discussions/${topic.id}`} 
                    // target="_blank"
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-2 rounded-md hover:bg-blue-50"
                >
                    Lihat <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
};

// --- (Komponen 'TopicModal' tidak berubah) ---
const TopicModal = ({ onClose, onSubmit, existingData, availableMapel, availableKelas, role }: { 
    onClose: () => void;
    onSubmit: (formData: TopicFormData, topicId: string | null) => Promise<boolean>;
    existingData: TopicDoc | null;
    availableMapel: DropdownItem[];
    availableKelas: DropdownItem[];
    role: "admin" | "teacher" | "student" | null;
}) => {
    const [formData, setFormData] = useState<TopicFormData>(
        existingData ? 
        { 
            judul: existingData.judul,
            isi_topik: existingData.isi_topik,
            mapel_ref: existingData.mapel_ref.id,
            kelas_ref: existingData.kelas_ref?.id || "semua"
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
        setIsSubmitting(true);
        const success = await onSubmit(formData, isEditMode ? existingData!.id : null);
        setIsSubmitting(false);
        if (success) {
            onClose(); 
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
        >
            <div 
                className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 z-50"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEditMode ? "Edit Topik Diskusi" : "Buat Topik Diskusi Baru"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="mapel_ref" className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran <span className="text-red-500">*</span></label>
                            <select
                                id="mapel_ref" name="mapel_ref"
                                value={formData.mapel_ref} onChange={handleChange}
                                className="w-full input-style" required
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
                                id="kelas_ref" name="kelas_ref"
                                value={formData.kelas_ref} onChange={handleChange}
                                className="w-full input-style" required
                            >
                                <option value="semua">Semua Kelas</option>
                                {availableKelas.map(kelas => (
                                    <option key={kelas.id} value={kelas.id}>{kelas.nama}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul Topik <span className="text-red-500">*</span></label>
                        <input
                            type="text" id="judul" name="judul"
                            value={formData.judul} onChange={handleChange}
                            className="w-full input-style"
                            placeholder="Tulis judul yang jelas..."
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="isi_topik" className="block text-sm font-medium text-gray-700 mb-1">Isi Topik / Pemantik <span className="text-red-500">*</span></label>
                        <textarea
                            id="isi_topik" name="isi_topik"
                            rows={6}
                            value={formData.isi_topik} onChange={handleChange}
                            className="w-full input-style"
                            placeholder="Tuliskan pertanyaan atau pemantik diskusi di sini..."
                            required
                        ></textarea>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
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
                            {isEditMode ? "Simpan Perubahan" : "Simpan sebagai Draft"}
                        </button>
                    </div>
                </form>
            </div>
            <style jsx global>{`
                .btn-danger {
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    background-color: #EF4444; /* bg-red-500 */
                    color: white;
                }
                .btn-danger:hover {
                    background-color: #DC2626; /* bg-red-600 */
                }
                .btn-secondary {
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    background-color: white;
                    border: 1px solid #D1D5DB; /* border-gray-300 */
                    color: #374151; /* text-gray-700 */
                }
                .btn-secondary:hover {
                    background-color: #F9FAFB; /* bg-gray-50 */
                }
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

export default DiscussionPage;

