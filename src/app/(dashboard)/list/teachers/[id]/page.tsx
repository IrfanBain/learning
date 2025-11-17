"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { format } from 'date-fns'; // Pastikan date-fns terinstall
import { FiEdit, FiArrowLeft, FiMail, FiPhone, FiCalendar, FiBriefcase } from 'react-icons/fi';

// --- KEMBALIKAN IMPORT KOMPONEN ---
// (Pastikan path ini benar)
import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalender"; // Perhatikan typo 'Calender' jika nama file Anda beda
import Performance from "@/components/Performance";
import { useAuth } from '@/context/authContext';

// Interface Data Guru (dari Firestore)
interface TeacherDetailData {
  nama_lengkap: string;
  nip_nuptk: string;
  email: string | null;
  foto_profil: string | null;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: Timestamp | null;
  agama: string | null;
  nomor_hp: string | null;
  status_kepegawaian: string | null;
  pendidikan_terakhir: string | null;
  almamater: string | null;
  jurusan_pendidikan: string | null;
  tanggal_mulai_kerja: Timestamp | null;
  mata_pelajaran_diampu: string[];
  peran: string[];
  wali_kelas_ref: string | null;
  alamat: {
    jalan?: string | null;
    rt_rw?: string | null;
    kelurahan_desa?: string | null;
    kecamatan?: string | null;
    kota_kabupaten?: string | null;
    provinsi?: string | null;
    kode_pos?: string | null;
  } | null;
}

// Komponen Utama Halaman Detail Guru
export default function SingleTeacherPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string;

  const [teacherData, setTeacherData] = useState<TeacherDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  // Fetch Data (Tidak Berubah)
  useEffect(() => {
    if (!teacherId) { setError("ID Guru tidak valid."); setLoading(false); return; }
    const fetchTeacher = async () => {
      setLoading(true); setError(null);
      try {
        const teacherDocRef = doc(db, "teachers", teacherId);
        const docSnap = await getDoc(teacherDocRef);
        if (docSnap.exists()) {
          setTeacherData(docSnap.data() as TeacherDetailData);
        } else {
          setError("Data guru tidak ditemukan."); setTeacherData(null);
        }
      } catch (err: any) {
        console.error("Error fetching teacher data:", err);
        setError("Gagal mengambil data guru: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacher();
  }, [teacherId]);

  // Tampilan Loading, Error, Not Found (Tidak Berubah)
   if (loading) {
    return <div className="p-8 text-center text-gray-600">Memuat data guru...</div>;
   }
   if (error) {
     return (
       <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
         <p>{error}</p>
         <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Kembali</button>
       </div>
     );
   }
   if (!teacherData) {
      return (
        <div className="p-8 text-center text-gray-600">
          Data guru tidak ditemukan.
          <Link href="/list/teachers" className="text-blue-600 hover:underline block mt-2">
             Kembali ke Daftar Guru
          </Link>
        </div>
      );
   }

  // --- Helper Format Tanggal (DIAKTIFKAN KEMBALI) ---
  const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return '-';
    try {
      // Anda bisa menambahkan locale 'id' jika diinginkan:
      // import { id } from 'date-fns/locale';
      // return format(timestamp.toDate(), 'dd MMMM yyyy', { locale: id });
      return format(timestamp.toDate(), 'dd MMMM yyyy');
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };
  // --------------------------------------------------


  // --- Helper Format Alamat (DIAKTIFKAN KEMBALI) ---
  const formatAlamat = (alamat: TeacherDetailData['alamat']) => {
    if (!alamat) return '-';
    const parts = [
      alamat.jalan,
      alamat.rt_rw ? `RT/RW ${alamat.rt_rw}` : null,
      alamat.kelurahan_desa,
      alamat.kecamatan,
      alamat.kota_kabupaten,
      alamat.provinsi,
      alamat.kode_pos,
    ].filter(Boolean); // Hapus bagian yang null/kosong
    return parts.join(', ') || '-'; // Jika semua kosong, tampilkan '-'
  };
  // ------------------------------------------------


  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      {/* Tombol Kembali */}
      <button onClick={() => router.push('/list/teachers')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-0 self-start">
        <FiArrowLeft /> Kembali ke Daftar Guru
      </button>

      {/* Kontainer Utama */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* Kolom Kiri (2/3) */}
        <div className="w-full flex flex-col gap-6">

          {/* TOP SECTION (Info Utama + Ringkasan Kecil) */}
          <div className="flex flex-col lg:flex-row gap-6">

            {/* KARTU INFO UTAMA */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg shadow-md flex-1 flex flex-col md:flex-row gap-6 items-center md:items-start">
               {/* Foto */}
              <div className="flex-shrink-0">
                <Image
                  src={teacherData.foto_profil || '/placeholder-avatar.png'}
                  alt={teacherData.nama_lengkap || 'Foto Guru'}
                  width={144} height={144}
                  className="w-36 h-36 rounded-full object-cover border-4 border-white shadow-lg"
                  onError={(e) => { e.currentTarget.src = '/placeholder-avatar.png'; }}
                />
              </div>
              {/* Detail Nama, NIP, Kontak, Edit */}
              <div className="w-full md:w-2/3 flex flex-col justify-between gap-3 text-center md:text-left">
                 {/* Nama & Tombol Edit */}
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-gray-800">{teacherData.nama_lengkap}</h1>
                    {/* {currentUser?.role === "admin" && (
                      <Link
                        href={`/list/teachers/edit/${teacherId}`}
                        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-xs sm:text-sm"
                        title="Edit Data Guru"
                      >
                        <FiEdit className="w-4 h-4" /> Edit
                      </Link>
                     )}  */}
                 </div>
                 {/* NIP & Peran */}
                <p className="text-md text-gray-600">
                  NIP/NUPTK: {teacherData.nip_nuptk || '-'}
                </p>
                <p className="text-sm text-gray-500 -mt-2">
                  Peran: {(teacherData.peran && teacherData.peran.length > 0) ? teacherData.peran.join(', ') : '-'}
                </p>
                 {/* Kontak & Tanggal Mulai - Gunakan formatDate */}
                <div className="flex items-center justify-center md:justify-start gap-x-4 gap-y-1 flex-wrap text-xs font-medium text-gray-700 mt-1">
                   <div className="flex items-center gap-1" title="Email Kontak">
                     <FiMail className="w-3 h-3 text-gray-500"/>
                     <span>{teacherData.email || '-'}</span>
                   </div>
                   <div className="flex items-center gap-1" title="Nomor HP">
                     <FiPhone className="w-3 h-3 text-gray-500"/>
                     <span>{teacherData.nomor_hp || '-'}</span>
                   </div>
                   <div className="flex items-center gap-1" title="Tanggal Mulai Kerja">
                     <FiCalendar className="w-3 h-3 text-gray-500"/>
                     {/* Panggil formatDate di sini */}
                     <span>Mulai: {formatDate(teacherData.tanggal_mulai_kerja)}</span>
                   </div>
                </div>
              </div>
            </div>

            {/* KARTU RINGKASAN KECIL */}
            <div className="flex-1 flex flex-col gap-4 justify-between lg:max-w-xs">
               {/* Mapel Diajar */}
               <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-center border border-gray-100">
                 <FiBriefcase className="w-6 h-6 text-indigo-500 flex-shrink-0" />
                 <div>
                   <h2 className="text-xl font-semibold text-gray-800">{teacherData.mata_pelajaran_diampu?.length || 0}</h2>
                   <span className="text-xs text-gray-500">Mapel Diajar</span>
                 </div>
               </div>
               {/* Status Kepegawaian */}
               <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-center border border-gray-100">
                  <FiBriefcase className="w-6 h-6 text-teal-500 flex-shrink-0" />
                 <div>
                   <h2 className="text-lg font-semibold text-gray-800 capitalize">{teacherData.status_kepegawaian || '-'}</h2>
                   <span className="text-xs text-gray-500">Status Kepegawaian</span>
                 </div>
               </div>
                {/* Kehadiran (Contoh data N/A) */}
               <div className="bg-white p-4 rounded-lg shadow flex gap-4 items-center border border-gray-100">
                  <Image src="/singleAttendance.png" alt="Attendance" width={24} height={24} className="w-6 h-6 flex-shrink-0" />
                 <div>
                   <h2 className="text-xl font-semibold text-gray-800">N/A</h2>
                   <span className="text-xs text-gray-500">Kehadiran</span>
                 </div>
               </div>
            </div>
          </div>

          
          {/* KARTU DETAIL INFORMASI */}
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
              <h2 className="text-xl font-semibold mb-4 border-b pb-3 text-gray-700">Detail Informasi Guru</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <InfoItem label="Jenis Kelamin" value={teacherData.jenis_kelamin === 'L' ? 'Laki-laki' : teacherData.jenis_kelamin === 'P' ? 'Perempuan' : '-'} />
              <InfoItem label="Tempat Lahir" value={teacherData.tempat_lahir} />
              {/* Panggil formatDate di sini */}
              <InfoItem label="Tanggal Lahir" value={formatDate(teacherData.tanggal_lahir)} />
              <InfoItem label="Agama" value={teacherData.agama} />
              <InfoItem label="Alamat Lengkap" value={formatAlamat(teacherData.alamat)} />
            </div>
          </div>
              <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                 <h2 className="text-xl font-semibold mb-4 border-b pb-3 text-gray-700">Detail Profesional</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <InfoItem label="Pendidikan Terakhir" value={teacherData.pendidikan_terakhir} />
                <InfoItem label="Almamater" value={teacherData.almamater} />
                <InfoItem label="Jurusan Pendidikan" value={teacherData.jurusan_pendidikan} />
                <InfoItem label="Wali Kelas (ID)" value={teacherData.wali_kelas_ref} />
                </div>
              </div>

          {/* BAGIAN KALENDER */}
          {/* <div className="bg-white rounded-lg p-4 shadow-md border h-[800px]">
              <h1 className="text-xl font-semibold mb-4">Jadwal Mengajar Guru</h1>
              <BigCalendar />
          </div> */}
          <Announcements />

        </div>

      
        
      </div>
    </div>
  );
};

// --- Komponen Helper InfoItem (Tidak Berubah) ---
const InfoItem = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
  <div className="py-1">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="text-md text-gray-900 capitalize">{value || '-'}</p>
  </div>
);

