"use client";

// --- MODIFIKASI 1: Impor 'useMemo' ---
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext'; // (Sesuaikan path)
import { db } from '@/lib/firebaseConfig'; // (Sesuaikan path)
// --- MODIFIKASI 2: Impor Tipe ---
import { type User as AuthUser } from 'firebase/auth';
import {
    collection,
    query,
    doc,
    getDoc,
    addDoc,
    serverTimestamp,
    Timestamp,
    DocumentReference,
    orderBy,
    onSnapshot,
    QuerySnapshot,
    updateDoc,
    increment,
    DocumentData // <-- Impor DocumentData
} from 'firebase/firestore';
import { 
    Loader2, 
    AlertTriangle, 
    MessageSquare,
    Send,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

// --- DEFINISI TIPE ---

// (Tipe TopicDoc tidak berubah)
interface TopicDoc {
    id: string;
    judul: string;
    isi_topik: string;
    status: "Dibuka" | "Ditutup";
    tanggal_dibuat: Timestamp;
    pembuat_ref: DocumentReference;
    pembuat_nama: string;
    pembuat_foto: string;
    pembuat_role: string;
    kelas_ref: DocumentReference;
    mapel_ref: DocumentReference;
    jumlah_balasan: number;
}

// (Tipe ReplyDoc tidak berubah)
interface ReplyDoc {
    id: string;
    isi_balasan: string;
    tanggal_dibuat: Timestamp;
    pembuat_ref: DocumentReference;
    pembuat_nama: string;
    pembuat_foto: string;
    pembuat_role: string;
}

// --- MODIFIKASI 2: Tipe AuthUserData ---
interface AuthUserData {
    uid: string;
    nama_lengkap: string; 
    fotoURL: string;
    role: "siswa" | "guru" | "admin";
    kelas_ref?: DocumentReference;
}

// --- KOMPONEN UTAMA ---
const TopicDetailPage = () => {
    // --- MODIFIKASI 2: Perbaiki 'any' type ---
    const { user, loading: authLoading } = useAuth() as { user: AuthUserData | null, loading: boolean };
    const params = useParams();
    const router = useRouter();
    const topicId = params.topicId as string;

    // (State tidak berubah)
    const [topic, setTopic] = useState<TopicDoc | null>(null);
    const [replies, setReplies] = useState<ReplyDoc[]>([]);
    const [loadingTopic, setLoadingTopic] = useState(true);
    const [loadingReplies, setLoadingReplies] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // (useMemo sekarang sudah diimpor)
    const topicRef = useMemo(() => doc(db, "discussion_topic", topicId), [topicId]);

    // --- 1. Ambil Data Topik Utama (Hanya sekali) ---
    const fetchTopicData = useCallback(async () => {
        setLoadingTopic(true);
        try {
            const docSnap = await getDoc(topicRef);
            if (!docSnap.exists()) {
                throw new Error("Topik diskusi tidak ditemukan.");
            }
            // --- MODIFIKASI 3: Perbaiki error 'spread' ---
            const topicData = docSnap.data() as DocumentData; // Ambil data dulu
            setTopic({ id: docSnap.id, ...topicData } as TopicDoc); // Baru di-spread
        } catch (err: any) {
            console.error("Error fetching topic:", err);
            setError(err.message || "Gagal memuat topik.");
            toast.error(err.message);
        } finally {
            setLoadingTopic(false);
        }
    }, [topicRef]);

    // --- 2. Ambil Balasan (Real-time) ---
    useEffect(() => {
        setLoadingReplies(true);
        const repliesQuery = query(
            collection(db, "discussion_topic", topicId, "reply"),
            orderBy("tanggal_dibuat", "asc") 
        );

        const unsubscribe = onSnapshot(repliesQuery, 
            (querySnapshot: QuerySnapshot) => {
                const repliesData: ReplyDoc[] = [];
                querySnapshot.forEach((doc) => {
                    // --- MODIFIKASI 3: Perbaiki error 'spread' ---
                    const replyData = doc.data() as DocumentData; // Ambil data dulu
                    if (replyData) {
                        repliesData.push({ id: doc.id, ...replyData } as ReplyDoc); // Baru di-spread
                    }
                });
                setReplies(repliesData);
                setLoadingReplies(false);
            },
            (err: any) => {
                console.error("Error listening to replies:", err);
                setError("Gagal memuat balasan. Pastikan 'rules' Anda benar.");
                toast.error("Gagal memuat balasan.");
                setLoadingReplies(false);
            }
        );

        return () => unsubscribe();
    }, [topicId]);

    // (Effect fetchTopicData tidak berubah)
    useEffect(() => {
        fetchTopicData();
    }, [fetchTopicData]);

    // --- 3. Handler untuk Mengirim Balasan ---
    // (Fungsi ini tidak berubah)
    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !replyContent.trim()) {
            toast.error("Anda harus login dan menulis balasan.");
            return;
        }
        
        setIsSubmitting(true);
        try {
            // 1. Siapkan data balasan
            const replyData = {
                isi_balasan: replyContent,
                tanggal_dibuat: serverTimestamp(),
                pembuat_ref: doc(db, "users", user.uid),
                pembuat_nama: user.nama_lengkap,
                pembuat_foto: user.fotoURL || "",
                pembuat_role: user.role,
            };

            // 2. Simpan balasan baru ke sub-koleksi
            const replyCollectionRef = collection(db, "discussion_topic", topicId, "reply");
            await addDoc(replyCollectionRef, replyData);
            
            // 3. Update 'update_terakhir' dan 'jumlah_balasan' di topik induk
            await updateDoc(topicRef, {
                update_terakhir: serverTimestamp(),
                jumlah_balasan: increment(1)
            });

            // 4. Bersihkan form
            setReplyContent("");
            toast.success("Balasan terkirim!");

        } catch (err: any) {
            console.error("Error sending reply:", err);
            toast.error(err.message || "Gagal mengirim balasan.");
        } finally {
            setIsSubmitting(false);
        }
    };


    // --- TAMPILAN (RENDER) ---
    // (Seluruh JSX render tidak berubah)
    
    if (loadingTopic) {
        return (
            <div className="flex justify-center items-center h-[80vh] bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat topik...</span>
            </div>
        );
    }
    
    if (error) {
         return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.push('/list/discussions')}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali ke Daftar Topik
                </button>
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            </div>
         )
    }
    
    if (!topic) {
        return <div className="p-8 text-center text-gray-500">Topik tidak ditemukan.</div>;
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/list/discussions')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar Topik
            </button>
            
            {/* --- 1. Topik Utama --- */}
            <ReplyPost item={topic} isTopic={true} />
            
            {/* --- 2. Daftar Balasan --- */}
            <div className="mt-6 space-y-4">
                {loadingReplies ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Memuat balasan...</span>
                    </div>
                ) : (
                    replies.map(reply => (
                        <ReplyPost key={reply.id} item={reply} isTopic={false} />
                    ))
                )}
            </div>

            {/* --- 3. Form Kirim Balasan --- */}
            <div className="mt-8">
                <form onSubmit={handleSendReply} className="bg-white p-5 rounded-xl shadow-md border border-gray-100">
                    <label htmlFor="replyContent" className="block text-base font-semibold text-gray-800 mb-2">
                        Tulis Balasan Anda
                    </label>
                    <textarea
                        id="replyContent"
                        rows={4}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tuliskan balasan Anda di sini..."
                        required
                    />
                    <div className="flex justify-end mt-3">
                        <button
                            type="submit"
                            disabled={isSubmitting || !replyContent.trim()}
                            className="flex items-center justify-center gap-2 py-2 px-5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            Kirim Balasan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- KOMPONEN PENDUKUNG (BARU) ---
// (Komponen ini tidak berubah)
const ReplyPost = ({ item, isTopic }: { item: TopicDoc | ReplyDoc, isTopic: boolean }) => {
    
    const content = isTopic ? (item as TopicDoc).isi_topik : (item as ReplyDoc).isi_balasan;
    const timestamp = item.tanggal_dibuat;
    
    const photoUrl = item.pembuat_foto || `/placeholder-avatar.png`;
    
    return (
        <div className={`flex items-start gap-4 p-5 rounded-xl ${
            isTopic ? 'bg-white shadow-md border border-gray-100' : 'bg-gray-50'
        }`}>
            {/* Foto Profil */}
            <Image
                width={100}
                height={100} 
                src={photoUrl} 
                alt={item.pembuat_nama}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
            
            {/* Konten Postingan */}
            <div className="flex-grow">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-800">{item.pembuat_nama}</span>
                    {item.pembuat_role === 'guru' && (
                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">GURU</span>
                    )}
                    {item.pembuat_role === 'admin' && (
                        <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">ADMIN</span>
                    )}
                </div>
                <p className="text-xs text-gray-500">
                    {timestamp?.toDate().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
                
                {isTopic && (
                    <h1 className="text-2xl font-bold text-gray-900 mt-3">
                        {(item as TopicDoc).judul}
                    </h1>
                )}
                
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed mt-3">
                    {content}
                </p>
            </div>
        </div>
    );
};


export default TopicDetailPage;

