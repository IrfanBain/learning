"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from "next/link";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore'; // Import Tipe Firestore
import { db } from '@/lib/firebaseConfig'; // Pastikan path ini benar
import { useAuth } from '@/context/authContext'; // Untuk cek role admin
import { format } from 'date-fns'; // Untuk format tanggal (jika ada timestamp)
import { FiEdit, FiArrowLeft, FiUser, FiCalendar, FiHome, FiAward } from 'react-icons/fi'; // Tambah ikon relevan
import Image from 'next/image'; // Import Image from next/image

// Interface Data Kelas (dari Firestore)
interface ClassDetailData {
  nama_kelas: string;
  tingkat: number;
  tahun_ajaran: string;
  wali_kelas_ref: DocumentReference | null; // Tipe Firestore Reference
  // Tambahkan field lain jika ada (cth: createdAt)
  // createdAt?: Timestamp | null;
}

// Interface Info Wali Kelas (yang akan kita fetch)
interface WaliKelasInfo {
    id: string | null;
    nama: string | null;
    nip?: string | null; // Opsional: NIP jika ingin ditampilkan
    foto?: string | null; // Opsional: Foto jika ingin ditampilkan
}

// Komponen Utama Halaman Detail Kelas
export default function SingleClassPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth(); // Dapatkan user untuk cek role
  // ID Kelas dari URL (ini adalah ID Dokumen kustom Anda, cth: "VII-A")
  const classId = params.id as string;

  // State untuk data kelas dan info wali kelas
  const [classData, setClassData] = useState<ClassDetailData | null>(null);
  const [waliKelasInfo, setWaliKelasInfo] = useState<WaliKelasInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Data ---
  useEffect(() => {
    if (!classId) {
      setError("ID Kelas tidak valid.");
      setLoading(false);
      return;
    }

    const fetchClassDetails = async () => {
      setLoading(true);
      setError(null);
      setWaliKelasInfo(null); // Reset info wali kelas

      try {
        // 1. Fetch Data Kelas Utama
        const classDocRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classDocRef);

        if (classSnap.exists()) {
          const fetchedClassData = classSnap.data() as ClassDetailData;
          setClassData(fetchedClassData);

          // 2. Jika ada referensi wali kelas, fetch data guru
          if (fetchedClassData.wali_kelas_ref) {
            try {
              const teacherSnap = await getDoc(fetchedClassData.wali_kelas_ref);
              if (teacherSnap.exists()) {
                const teacherData = teacherSnap.data();
                setWaliKelasInfo({
                  id: teacherSnap.id,
                  nama: teacherData?.nama_lengkap || 'Nama Tidak Ditemukan',
                  nip: teacherData?.nip_nuptk || null, // Ambil NIP jika ada
                  foto: teacherData?.foto_profil || null // Ambil foto jika ada
                });
              } else {
                setWaliKelasInfo({ id: fetchedClassData.wali_kelas_ref.id, nama: 'Data Guru Wali Tidak Ditemukan', nip: null, foto: null });
              }
            } catch (teacherError) {
              console.error("Error fetching wali kelas data:", teacherError);
              setWaliKelasInfo({ id: fetchedClassData.wali_kelas_ref.id, nama: 'Gagal Memuat Wali Kelas', nip: null, foto: null });
              // Jangan set error utama agar detail kelas tetap tampil
            }
          } else {
              setWaliKelasInfo({ id: null, nama: 'Belum Ditentukan', nip: null, foto: null }); // Tidak ada wali kelas
          }

        } else {
          setError("Data kelas tidak ditemukan.");
          setClassData(null);
        }
      } catch (err: any) {
        console.error("Error fetching class details:", err);
        setError("Gagal mengambil detail kelas: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetails();
  }, [classId]); // Fetch ulang jika ID kelas berubah

  // --- Tampilan Loading, Error, Not Found ---
  if (loading) { return <div className="p-8 text-center text-gray-600">Memuat detail kelas...</div>; }
  if (error) { /* ... return error ... */ }
  if (!classData) { /* ... return not found ... */ }
  // Tampilan Error
  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <p>{error}</p>
        <button onClick={() => router.push('/list/classes')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Kembali ke Daftar</button>
      </div>
    );
  }
  // Tampilan Not Found (Secara teknis sudah ditangani error, tapi untuk jaga-jaga)
  if (!classData) {
     return (
       <div className="p-8 text-center text-gray-600">
         Data kelas tidak ditemukan.
         <Link href="/list/classes" className="text-blue-600 hover:underline block mt-2">
            Kembali ke Daftar Kelas
         </Link>
       </div>
     );
  }


  // --- Render Tampilan Detail ---
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      {/* Tombol Kembali & Judul */}
      <div className="flex justify-between items-center mb-2">
          <button onClick={() => router.push('/list/classes')} // Sesuaikan path jika perlu
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 self-start">
            <FiArrowLeft /> Kembali ke Daftar Kelas
          </button>
           {/* Tombol Edit (Hanya Admin) */}
           {user?.role === 'admin' && (
             <Link
               href={`/list/classes/edit/${classId}`} // Sesuaikan path jika perlu
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
               title="Edit Data Kelas"
             >
               <FiEdit className="w-4 h-4" /> Edit Kelas
             </Link>
           )}
      </div>

      {/* Kartu Detail Utama */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        {/* Header Kartu */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4">
            <div>
                 <h1 className="text-2xl font-bold text-gray-800">Detail Kelas: {classData.nama_kelas}</h1>
                 <p className="text-sm text-gray-500">Tahun Ajaran: {classData.tahun_ajaran}</p>
            </div>
             <span className="mt-2 sm:mt-0 px-3 py-1 text-md font-semibold rounded-full bg-indigo-100 text-indigo-800">
                 Tingkat {classData.tingkat}
             </span>
        </div>

        {/* Informasi Wali Kelas */}
        <div className="mb-6 p-4 rounded-md bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiUser className="text-blue-600"/> Wali Kelas</h3>
            {waliKelasInfo ? (
                <div className="flex items-center gap-4">
                    {/* Opsional: Tampilkan Foto Wali Kelas */}
                   {waliKelasInfo.foto && (
                        <Image src={waliKelasInfo.foto} alt={waliKelasInfo.nama || 'Wali'} width={40} height={40} className="w-10 h-10 rounded-full object-cover"/>
                    )} 
                    <div>
                        {/* Link ke detail guru jika ID nya ada */}
                        {waliKelasInfo.id ? (
                            <Link href={`/list/teachers/${waliKelasInfo.id}`} className="text-md font-medium text-blue-700 hover:underline">
                                {waliKelasInfo.nama || 'Nama Tidak Tersedia'}
                            </Link>
                        ) : (
                            <span className="text-md font-medium text-gray-700">
                                {waliKelasInfo.nama || 'N/A'}
                            </span>
                        )}
                        {/* Tampilkan NIP jika ada */}
                        {waliKelasInfo.nip && (
                            <p className="text-xs text-gray-500">NIP/NUPTK: {waliKelasInfo.nip}</p>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-gray-500">Memuat data wali kelas...</p>
            )}
        </div>

        {/* Informasi Tambahan (jika ada) */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <InfoItem label="Kapasitas Maksimal" value={classData.kapasitas || '-'} icon={<FiUsers />}/>
            <InfoItem label="Ruangan Default" value={classData.ruangan || '-'} icon={<FiHome />}/>
            <InfoItem label="Tanggal Dibuat" value={formatDate(classData.createdAt)} icon={<FiCalendar />}/>
        </div> */}

        {/* Pintasan atau Daftar Siswa */}
        <div className="mt-6 border-t pt-4">
             <h3 className="text-lg font-semibold text-gray-700 mb-3">Terkait</h3>
             {/* Tambahkan Link ke daftar siswa kelas ini */}
             <Link href={`/list/classes/${classId}/students`} className="text-blue-600 hover:underline text-sm">
                 Lihat Daftar Siswa di Kelas Ini
             </Link>
             {/* Tambahkan link lain jika perlu */}
        </div>

      </div>
       {/* Komponen lain seperti Jadwal (BigCalendar) bisa ditambahkan di sini */}
       {/* <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 mt-6 h-[600px]">...</div> */}
    </div>
  );
};


// --- Komponen Helper InfoItem (disesuaikan sedikit) ---
const InfoItem = ({ label, value, icon }: { label:string; value:string|number|null|undefined; icon?: React.ReactNode}) => (
  <div className="flex items-start py-1">
     {icon && <span className="mr-2 mt-1 text-gray-500">{icon}</span>}
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-md text-gray-900">{value || '-'}</p>
    </div>
  </div>
);
