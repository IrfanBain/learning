"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext'; // (Sesuaikan path)
import { db } from '@/lib/firebaseConfig'; // (Sesuaikan path)
import { type User as AuthUser } from 'firebase/auth';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc, // <-- Penting
    addDoc,
    serverTimestamp,
    Timestamp,
    DocumentReference,
    orderBy,
    onSnapshot, 
    QuerySnapshot,
    QueryConstraint,
    DocumentData // <-- Penting
} from 'firebase/firestore';
import { 
    Loader2, 
    AlertTriangle, 
    MessageSquare,
    Plus,
    X,
    Send,
    MessageSquarePlus,
    Book
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

// --- DEFINISI TIPE ---

interface DropdownItem {
    id: string;
    nama: string;
}

interface TopicDoc {
    id: string;
    judul: string;
    isi_topik: string;
    status: "Dibuka" | "Ditutup";
    tanggal_dibuat: Timestamp;
    update_terakhir: Timestamp;
    pembuat_ref: DocumentReference;
    pembuat_nama: string;
    pembuat_foto: string;
    pembuat_role: string;
    kelas_ref: DocumentReference;
    mapel_ref: DocumentReference;
    jumlah_balasan: number;
    mapelNama?: string;
}

interface AuthUserData {
    uid: string;
    role: "siswa" | "guru" | "admin";
    nama_lengkap?: string; 
    fotoURL?: string;
    kelas_ref?: DocumentReference;
    displayName?: string | null;
    photoURL?: string | null;
}

// --- KOMPONEN UTAMA ---
const DiscussionPage = () => {
    const { user, loading: authLoading } = useAuth() as { user: AuthUserData | null, loading: boolean };
    const router = useRouter();

    const [topics, setTopics] = useState<TopicDoc[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMapel, setSelectedMapel] = useState<string>("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Ambil data dropdown Mapel ---
    const fetchDropdownData = useCallback(async () => {
        try {
            const mapelQuery = query(collection(db, "subjects"), orderBy("nama_mapel", "asc"));
            const mapelSnapshot = await getDocs(mapelQuery);
            const mapelData = mapelSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            setAvailableMapel(mapelData);
        } catch (err: any) {
            console.error("Error fetching dropdown data:", err);
            toast.error("Gagal memuat data mapel.");
        }
    }, []);

    // --- Ambil Topik Diskusi (Real-time) ---
    useEffect(() => {
        if (!user || (!user.kelas_ref && user.role === 'siswa')) {
            if (!authLoading) {
                setLoading(false);
                if(user?.role === 'siswa') setError("Anda tidak terdaftar di kelas manapun.");
            }
            return;
        }

        setLoading(true);
        const queryConstraints: QueryConstraint[] = [];

        if (user.role === 'siswa' && user.kelas_ref) {
            queryConstraints.push(where("kelas_ref", "==", user.kelas_ref));
        }
        
        if (selectedMapel !== "all") {
            queryConstraints.push(where("mapel_ref", "==", doc(db, "subjects", selectedMapel)));
        }
        
        queryConstraints.push(orderBy("update_terakhir", "desc"));

        const q = query(collection(db, "discussion_topic"), ...queryConstraints);

        const unsubscribe = onSnapshot(q, 
            (querySnapshot: QuerySnapshot) => {
                const topicsData: TopicDoc[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as DocumentData;
                    topicsData.push({ id: doc.id, ...data } as TopicDoc);
                });
                
                setTopics(topicsData);
                setLoading(false);
                setError(null);
            }, 
            (err: any) => {
                console.error("Error listening to topics:", err);
                let userMessage = "Gagal memuat topik diskusi. ";
                if (err.code === 'permission-denied') {
                    userMessage += "Izin ditolak. Pastikan Security Rules Anda benar.";
                } else if (err.code === 'failed-precondition') {
                    userMessage += "Indeks Komposit diperlukan. Cek konsol (F12) untuk link membuat indeks.";
                }
                setError(userMessage);
                toast.error(userMessage);
                setLoading(false);
            }
        );

        return () => unsubscribe();

    }, [user, authLoading, selectedMapel]); 

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);


    // --- 3. Handler untuk Buat Topik Baru (PERBAIKAN) ---
    const handleCreateTopic = async (judul: string, isi: string, mapelId: string) => {
        if (!user) {
            toast.error("Data Anda tidak lengkap untuk membuat topik.");
            return false;
        }

        setIsSubmitting(true);
        let kelasRef: DocumentReference | null = null;
        let userProfileData: DocumentData | null = null;
        
        try {
            // Langkah 1: Tentukan path profil berdasarkan role
            let userDocRef;
            if (user.role === 'siswa') {
                if (!user.kelas_ref) throw new Error("Siswa harus terdaftar di kelas.");
                userDocRef = doc(db, "students", user.uid);
                kelasRef = user.kelas_ref; // Ambil kelas ref siswa
            } else if (user.role === 'guru') {
                userDocRef = doc(db, "teachers", user.uid);
                // TODO: Guru perlu memilih kelas. 
                // Kita hentikan jika guru, sampai UI-nya ada.
                toast.error("Fitur 'Buat Topik' untuk Guru/Admin belum selesai (perlu pilihan kelas).");
                setIsSubmitting(false);
                return false; 
            } else if (user.role === 'admin') {
                userDocRef = doc(db, "users", user.uid); // Asumsi admin ada di 'users'
                toast.error("Fitur 'Buat Topik' untuk Guru/Admin belum selesai (perlu pilihan kelas).");
                setIsSubmitting(false);
                return false;
            } else {
                throw new Error("Role pengguna tidak dikenal.");
            }

            // Langkah 2: Ambil data profil (nama, foto)
            const userProfileSnap = await getDoc(userDocRef);
            if (!userProfileSnap.exists()) {
                throw new Error("Data profil (student/teacher/user) tidak ditemukan di Firestore.");
            }
            userProfileData = userProfileSnap.data();

            // Langkah 3: Siapkan data topik
            const topicData = {
                judul: judul,
                isi_topik: isi,
                status: "Dibuka",
                tanggal_dibuat: serverTimestamp(),
                update_terakhir: serverTimestamp(),
                pembuat_ref: doc(db, "users", user.uid), // Ref ke 'users' (auth)
                
                // --- INI DIA PERBAIKANNYA ---
                // (Gunakan 'nama_lengkap' dari 'students'/'teachers', 
                //  atau 'displayName' dari auth, atau fallback)
                pembuat_nama: userProfileData.nama_lengkap || user.displayName || "Pengguna",
                pembuat_foto: userProfileData.fotoURL || user.photoURL || "",
                pembuat_role: user.role, // Ambil role dari Auth
                // --- AKHIR PERBAIKAN ---

                kelas_ref: kelasRef, 
                mapel_ref: doc(db, "subjects", mapelId),
                jumlah_balasan: 0
            };

            // Langkah 4: Simpan ke Firestore
            await addDoc(collection(db, "discussion_topic"), topicData);
            toast.success("Topik baru berhasil dibuat!");
            setIsSubmitting(false);
            return true; // Sukses

        } catch (err: any) {
            console.error("Error creating topic:", err);
            toast.error(err.message || "Gagal membuat topik.");
            setIsSubmitting(false);
            return false; // Gagal
        }
    };


    // --- TAMPILAN (RENDER) ---
    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Forum Diskusi</h1>
                <div className="flex gap-2">
                    {/* Filter Mapel */}
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
                    {/* Tombol Buat Topik */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={!user} 
                        className="flex items-center gap-2 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Plus className="w-5 h-5" />
                        Buat Topik
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

            {/* Daftar Topik */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                {loading ? (
                    <div className="flex justify-center items-center h-60">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="ml-3 text-gray-600">Memuat topik diskusi...</span>
                    </div>
                ) : topics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <MessageSquare className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Diskusi</h3>
                        <p className="text-center">Jadilah yang pertama membuat topik di forum ini!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {topics.map(topic => (
                            <TopicListItem key={topic.id} topic={topic} />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Buat Topik Baru */}
            {showCreateModal && user && (
                <CreateTopicModal 
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateTopic}
                    availableMapel={availableMapel}
                />
            )}
        </div>
    );
};

// --- KOMPONEN PENDUKUNG ---

// Item Daftar Topik
const TopicListItem = ({ topic }: { topic: TopicDoc }) => {
    const router = useRouter();
    const lastUpdate = topic.update_terakhir?.toDate().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    
    const photoUrl = topic.pembuat_foto || `/placeholder-avatar.png`;

    return (
        <div 
            className="flex items-start gap-4 p-4 hover:bg-gray-50 cursor-pointer rounded-lg transition-all"
            onClick={() => router.push(`/list/discussions/${topic.id}`)} // Arahkan ke detail
        >
            <Image
                width={100}
                height={100} 
                src={photoUrl} 
                alt={topic.pembuat_nama}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-grow">
                <p className="text-base font-semibold text-blue-600 hover:underline">
                    {topic.judul}
                </p>
                <p className="text-sm text-gray-500">
                    Dimulai oleh <span className="font-medium text-gray-700">{topic.pembuat_nama}</span>
                    {topic.pembuat_role === 'guru' && (
                        <span className="ml-2 text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">GURU</span>
                    )}
                    {topic.pembuat_role === 'admin' && (
                        <span className="ml-2 text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">ADMIN</span>
                    )}
                </p>
            </div>
            <div className="flex-shrink-0 text-right text-sm text-gray-500">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-medium text-gray-800">{topic.jumlah_balasan}</span>
                </div>
                <p className="mt-1">Update: {lastUpdate}</p>
            </div>
        </div>
    );
};

// Modal untuk Buat Topik
const CreateTopicModal = ({ onClose, onSubmit, availableMapel }: {
    onClose: () => void;
    onSubmit: (judul: string, isi: string, mapelId: string) => Promise<boolean>;
    availableMapel: DropdownItem[];
}) => {
    const [judul, setJudul] = useState("");
    const [isi, setIsi] = useState("");
    const [mapelId, setMapelId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!judul || !isi || !mapelId) {
            toast.error("Judul, Isi Topik, dan Mata Pelajaran wajib diisi.");
            return;
        }
        
        setIsSubmitting(true);
        const success = await onSubmit(judul, isi, mapelId);
        setIsSubmitting(false);
        
        if (success) {
            onClose(); 
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
                    <h2 className="text-xl font-bold text-gray-800">Buat Topik Diskusi Baru</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="mapelId" className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran <span className="text-red-500">*</span></label>
                        <select
                            id="mapelId"
                            value={mapelId}
                            onChange={(e) => setMapelId(e.target.value)}
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
                        <label htmlFor="judul" className="block text-sm font-medium text-gray-700 mb-1">Judul Topik <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            id="judul"
                            value={judul}
                            onChange={(e) => setJudul(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Tulis judul yang jelas, misal: 'Tanya PR Halaman 50'"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="isi" className="block text-sm font-medium text-gray-700 mb-1">Isi Topik / Pertanyaan <span className="text-red-500">*</span></label>
                        <textarea
                            id="isi"
                            rows={6}
                            value={isi}
                            onChange={(e) => setIsi(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Tuliskan pertanyaan atau isi topik Anda secara lengkap di sini..."
                            required
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
                                <Send className="w-5 h-5" />
                            )}
                            Kirim Topik
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DiscussionPage;

