"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { collection, query, getDocs, doc, getDoc, deleteDoc, DocumentReference, Timestamp, orderBy } from 'firebase/firestore';
import { BookUp, Loader2, AlertTriangle, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

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
    status: "Draft" | "Dipublikasi";
    tanggal_selesai: Timestamp;
    guru_ref: DocumentReference;
    kelas_ref: DocumentReference;
    mapel_ref: DocumentReference;
    file_lampiran: UploadedFileInfo | null;
    mapelNama?: string;
    kelasNama?: string;
    guruNama?: string;
}

const AdminHomeworkPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [homeworkList, setHomeworkList] = useState<HomeworkDoc[]>([]);
    const [availableMapel, setAvailableMapel] = useState<DropdownItem[]>([]);
    const [availableKelas, setAvailableKelas] = useState<DropdownItem[]>([]);
    const [selectedMapel, setSelectedMapel] = useState<string>("all");
    const [selectedKelas, setSelectedKelas] = useState<string>("all");
    const auth = getAuth();

    const fetchDropdownData = useCallback(async () => {
        try {
            const [mapelSnapshot, kelasSnapshot] = await Promise.all([
                getDocs(query(collection(db, "subjects"))),
                getDocs(query(collection(db, "classes")))
            ]);

            const mapelData = mapelSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: doc.data().nama_mapel || "Tanpa Nama"
            }));
            setAvailableMapel(mapelData);

            const kelasData = kelasSnapshot.docs.map(doc => ({
                id: doc.id,
                nama: `${doc.data().tingkat || ''} ${doc.data().nama_kelas || 'Tanpa Nama'}`.trim()
            }));
            setAvailableKelas(kelasData);
        } catch (err: any) {
            toast.error("Gagal memuat data filter.");
        }
    }, []);

    const fetchAllHomework = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const userDocRef = doc(db, "users", auth.currentUser?.uid || "");
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                setError("Document user tidak ditemukan di Firestore.");
                setLoading(false);
                return;
            }

            const q = query(
                collection(db, "homework"),
                orderBy("tanggal_dibuat", "desc")
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setHomeworkList([]);
                setLoading(false);
                return;
            }

            const homeworkPromises = querySnapshot.docs.map(async (hwDoc) => {
                try {
                    const hwData = hwDoc.data() as Omit<HomeworkDoc, 'id'>;

                    let mapelNama = "N/A";
                    let kelasNama = "N/A";
                    let guruNama = "N/A";

                    // Fetch Mapel
                    if (hwData.mapel_ref) {
                        try {
                            const mapelSnap = await getDoc(hwData.mapel_ref);
                            mapelNama = mapelSnap.exists() ? (mapelSnap.data()?.nama_mapel || "Mapel Dihapus") : "Mapel Tidak Ada";
                        } catch (e) {
                            mapelNama = "Error";
                        }
                    }

                    // Fetch Kelas
                    if (hwData.kelas_ref) {
                        try {
                            const klsSnap = await getDoc(hwData.kelas_ref);
                            if (klsSnap.exists()) {
                                const kls = klsSnap.data();
                                kelasNama = `${kls?.tingkat || ''} ${kls?.nama_kelas || 'Kelas Dihapus'}`.trim();
                            } else {
                                kelasNama = "Kelas Tidak Ada";
                            }
                        } catch (e) {
                            kelasNama = "Error";
                        }
                    }

                    // Fetch Guru
                    if (hwData.guru_ref) {
                        try {
                            const guruSnap = await getDoc(hwData.guru_ref);
                            guruNama = guruSnap.exists() ? (guruSnap.data()?.nama_lengkap || "Guru Dihapus") : "Guru Tidak Ada";
                        } catch (e) {
                            guruNama = "Error";
                        }
                    }

                    return {
                        ...hwData,
                        id: hwDoc.id,
                        mapelNama,
                        kelasNama,
                        guruNama,
                    } as HomeworkDoc;

                } catch (itemErr: any) {
                    const hwData = hwDoc.data();
                    return {
                        id: hwDoc.id,
                        judul: hwData.judul || "Error",
                        status: hwData.status || "Draft",
                        tanggal_selesai: hwData.tanggal_selesai,
                        guru_ref: hwData.guru_ref,
                        kelas_ref: hwData.kelas_ref,
                        mapel_ref: hwData.mapel_ref,
                        file_lampiran: hwData.file_lampiran || null,
                        mapelNama: "Error Loading",
                        kelasNama: "Error Loading",
                        guruNama: "Error Loading",
                    } as HomeworkDoc;
                }
            });

            const combinedHomeworks = await Promise.all(homeworkPromises);
            setHomeworkList(combinedHomeworks);

        } catch (err: any) {
            let userMessage = "Gagal memuat daftar PR. ";

            if (err.code === 'permission-denied') {
                userMessage += "Izin ditolak. Pastikan Anda login sebagai Admin.";
            } else if (err.code === 'failed-precondition') {
                userMessage += "Indeks Firestore diperlukan.";
            } else {
                userMessage += err.message || "Terjadi kesalahan.";
            }

            setError(userMessage);
            toast.error(userMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllHomework();
        fetchDropdownData();
    }, [fetchAllHomework, fetchDropdownData]);

    const executeDelete = async (hwId: string, title: string) => {
        const loadingToastId = toast.loading(`Menghapus PR "${title}"...`);
        try {
            await deleteDoc(doc(db, "homework", hwId));
            toast.success("PR berhasil dihapus.", { id: loadingToastId });
            fetchAllHomework();
        } catch (err: any) {
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

    const filteredHomeworkList = useMemo(() => {
        return homeworkList.filter(hw => {
            const mapelMatch = selectedMapel === "all" || hw.mapel_ref?.id === selectedMapel;
            const kelasMatch = selectedKelas === "all" || hw.kelas_ref?.id === selectedKelas;
            return mapelMatch && kelasMatch;
        });
    }, [homeworkList, selectedMapel, selectedKelas]);

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Manajemen PR (Admin)</h1>
            </div>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Semua Pekerjaan Rumah ({filteredHomeworkList.length})
                    </h2>

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
                        <span className="ml-3 text-gray-600">Memuat semua PR...</span>
                    </div>
                ) : filteredHomeworkList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500">
                        <BookUp className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Tidak Ada PR</h3>
                        <p className="text-center">
                            {homeworkList.length > 0
                                ? "Tidak ada PR yang cocok dengan filter Anda."
                                : "Belum ada guru yang membuat PR."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredHomeworkList.map(hw => (
                            <AdminHomeworkListItem
                                key={hw.id}
                                hw={hw}
                                onDelete={handleDeleteHomework}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminHomeworkListItem = ({
    hw,
    onDelete
}: {
    hw: HomeworkDoc;
    onDelete: (id: string, title: string) => void;
}) => {
    const getStatusChip = (status: string) => {
        if (status === 'Dipublikasi') {
            return <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{status}</span>;
        }
        return <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{status}</span>;
    };

    const deadline = hw.tanggal_selesai?.toDate()?.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) || 'N/A';

    return (
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 transition-all">
            <div className="flex items-center gap-4 flex-1">
                <div className="flex-shrink-0">
                    <BookUp className="w-6 h-6 text-blue-500" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800">{hw.judul}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                        <span className="font-medium text-blue-600">{hw.guruNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{hw.mapelNama}</span>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <span>{hw.kelasNama}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-shrink-0">
                {getStatusChip(hw.status)}

                <Link
                    href={`/teacher/homework/${hw.id}/submissions`}
                    target="_blank"
                    title="Lihat Pengumpulan Siswa"
                    className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800 font-medium py-1.5 px-2.5 rounded-md hover:bg-green-50 transition-colors"
                >
                    <Eye className="w-4 h-4" />
                </Link>

                <button
                    onClick={() => onDelete(hw.id, hw.judul)}
                    title="Hapus PR Ini"
                    className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium py-1.5 px-2.5 rounded-md hover:bg-red-50 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default AdminHomeworkPage;