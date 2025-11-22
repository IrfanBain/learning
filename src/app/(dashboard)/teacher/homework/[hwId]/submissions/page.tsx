"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import { db } from '@/lib/firebaseConfig';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    Timestamp,
    DocumentReference,
    orderBy
} from 'firebase/firestore';
import { 
    Loader2, 
    ArrowLeft, 
    AlertTriangle, 
    Download,
    User,
    Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';


const TOLERANSI_JAM = 24;
// --- DEFINISI TIPE ---

interface HomeworkData {
    judul: string;
    kelas_ref: DocumentReference;
    status: string;
    tanggal_selesai: Timestamp;
}

interface StudentData {
    id: string;
    nama_lengkap: string;
    kelas: string;
}

interface SubmissionData {
    id: string;
    student_ref: DocumentReference;
    status_pengumpulan: "Terkumpul" | "Terlambat" | "Dinilai Manual";
    tanggal_pengumpulan: Timestamp;
    file_jawaban: {
        url: string;
        namaFile: string;
        path: string;
    };
    nilai_tugas: number | null;
    feedback_guru: string | null;
}

type MergedStudentData = {
    student: StudentData;
    submission: SubmissionData | null;
}

const HomeworkSubmissionsPage = () => {
    const { user, loading: authLoading } = useAuth(); // Ambil status loading auth
    const params = useParams();
    const router = useRouter();
    const hwId = params.hwId as string;

    const [homework, setHomework] = useState<HomeworkData | null>(null);
    const [mergedData, setMergedData] = useState<MergedStudentData[]>([]);
    
    // Default loading true
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubmissionsData = useCallback(async () => {
        // Jangan jalan jika user/hwId belum ada
        if (!user || !hwId) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Ambil data PR (Induk)
            const hwRef = doc(db, "homework", hwId);
            const hwSnap = await getDoc(hwRef);
            if (!hwSnap.exists()) {
                throw new Error("Pekerjaan Rumah tidak ditemukan.");
            }
            const hwData = hwSnap.data() as HomeworkData;
            setHomework(hwData);

            // 2. Ambil SEMUA siswa di kelas yang ditargetkan PR
            // PENTING: Jika query ini gagal, kemungkinan butuh INDEX Firestore
            const studentsQuery = query(
                collection(db, "students"),
                where("kelas_ref", "==", hwData.kelas_ref),
                orderBy("nama_lengkap", "asc")
            );

            // 3. Ambil SEMUA pengumpulan untuk PR ini
            const submissionsQuery = query(
                collection(db, "homework_submissions"),
                where("homework_ref", "==", hwRef)
            );

            const [studentsSnapshot, submissionsSnapshot] = await Promise.all([
                getDocs(studentsQuery),
                getDocs(submissionsQuery)
            ]);

            // 4. Proses data pengumpulan ke dalam Map
            const submissionMap = new Map<string, SubmissionData>();
            submissionsSnapshot.docs.forEach(subDoc => {
                const subData = subDoc.data() as SubmissionData;
                submissionMap.set(subData.student_ref.id, { ...subData, id: subDoc.id });
            });

            // 5. Gabungkan data
            const mergedList: MergedStudentData[] = studentsSnapshot.docs.map(studentDoc => {
                const student = { ...studentDoc.data(), id: studentDoc.id } as StudentData;
                const submission = submissionMap.get(student.id) || null;
                
                return {
                    student: student,
                    submission: submission,
                };
            });

            setMergedData(mergedList);

        } catch (err: any) {
            console.error("Error fetching submissions data:", err);
            
            let userMessage = "Gagal memuat data. ";
            if (err.code === 'failed-precondition') {
                 userMessage = "ERROR INDEX: Buka Console (F12) dan klik link dari Firebase untuk membuat index.";
                 toast.error("Diperlukan Index Firestore!", { duration: 5000 });
            } else if (err.code === 'permission-denied') {
                userMessage += "Izin ditolak.";
            } else {
                userMessage += err.message;
            }
            setError(userMessage);
        } finally {
            setLoading(false);
        }
    }, [hwId, user]);

    // Effect Utama
    useEffect(() => {
        if (!authLoading) {
            if (user) {
                fetchSubmissionsData();
            } else {
                // Jika tidak login, matikan loading agar tidak muter terus
                setLoading(false);
            }
        }
    }, [user, authLoading, fetchSubmissionsData]);


    if (loading || authLoading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <span className="ml-4 text-gray-600 text-lg">Memuat data pengumpulan...</span>
            </div>
        );
    }

    if (error) {
         return (
             <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
                 <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Kembali
                </button>
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-md" role="alert">
                    <p className="font-bold">Terjadi Kesalahan</p>
                    <p>{error}</p>
                </div>
            </div>
         )
    }

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
            <button 
                onClick={() => router.push('/teacher/homework')} // Sesuaikan link ini
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4 font-medium">
                <ArrowLeft className="w-5 h-5" />
                Kembali ke Daftar PR
            </button>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-800">
                    Rekap Pengumpulan PR
                </h1>
                <p className="text-lg text-gray-600 mt-1">{homework?.judul}</p>

                {mergedData.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-500 border-t mt-4 pt-4">
                        <AlertTriangle className="w-16 h-16 text-gray-300" />
                        <h3 className="text-xl font-semibold mt-4">Belum Ada Siswa</h3>
                        <p className="text-center">Tidak ada siswa yang ditemukan di kelas ini.</p>
                    </div>
                )}

                {mergedData.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Siswa</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Kumpul</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                                    <th className="relative px-6 py-3"><span className="sr-only">Aksi</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {mergedData.map((data) => {
                                // 1. Siapkan data dasar
                                const hasSubmission = !!data.submission;
                                
                                // 2. HITUNG LOGIKA WAKTU (Untuk Logika Tombol)
                                const now = new Date();
                                const deadlineDate = homework?.tanggal_selesai.toDate() || new Date();
                                const lockDate = new Date(deadlineDate.getTime() + (TOLERANSI_JAM * 60 * 60 * 1000));
                                
                                // Cek apakah PR sudah terkunci total?
                                const isHomeworkLocked = (now > lockDate) || (homework?.status === 'Ditutup');
                                
                                // 3. TENTUKAN TOMBOL AKSI
                                let actionButton;

                                if (hasSubmission) {
                                    // KASUS A: Siswa SUDAH mengerjakan -> Selalu bisa dinilai
                                    actionButton = (
                                        <Link 
                                            href={`/teacher/homework/${hwId}/submissions/${data.submission?.id}?status=submitted`}
                                            className="text-blue-600 hover:text-blue-900 font-medium"
                                        >
                                            Periksa & Nilai
                                        </Link>
                                    );
                                } else {
                                    // KASUS B: Siswa BELUM mengerjakan
                                    if (isHomeworkLocked) {
                                        // KASUS B1: Waktu Habis / Ditutup -> Boleh Nilai Manual
                                        actionButton = (
                                            <Link 
                                                href={`/teacher/homework/${hwId}/submissions/${data.student.id}?status=pending`}
                                                className="text-green-600 hover:text-green-900 font-medium flex items-center justify-end gap-1"
                                            >
                                                Beri Nilai Manual
                                            </Link>
                                        );
                                    } else {
                                        // KASUS B2: Masih Masa Pengerjaan -> TAHAN GURU
                                        actionButton = (
                                            <span className="text-gray-400 italic text-sm flex items-center justify-end gap-1 cursor-not-allowed" title="Siswa masih dalam masa toleransi pengerjaan">
                                                <Clock className="w-3 h-3" /> Menunggu Siswa
                                            </span>
                                        );
                                    }
                                }

                                return (
                                    <tr key={data.student.id} className="hover:bg-gray-50">
                                        {/* Kolom Nama */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{data.student.nama_lengkap}</div>
                                                    <div className="text-sm text-gray-500">{data.student.kelas}</div>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Kolom Status */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {data.submission ? (
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    data.submission.status_pengumpulan === 'Terlambat' ? 'bg-yellow-100 text-yellow-800' :
                                                    data.submission.status_pengumpulan === 'Dinilai Manual' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {data.submission.status_pengumpulan}
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                    Belum Mengumpulkan
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* Kolom Waktu */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {data.submission ? 
                                                data.submission.tanggal_pengumpulan.toDate().toLocaleString('id-ID', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                }) : '-'
                                            }
                                        </td>
                                        
                                        {/* Kolom File */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                            {data.submission?.file_jawaban ? (
                                                <a href={data.submission.file_jawaban.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                                                    <Download className="w-4 h-4" /> Lihat
                                                </a>
                                            ) : '-'}
                                        </td>
                                        
                                        {/* Kolom Nilai */}
                                        <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-blue-600">
                                            {data.submission?.nilai_tugas ?? '-'}
                                        </td>
                                        
                                        {/* Kolom Aksi (Dinamis) */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {actionButton}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeworkSubmissionsPage;