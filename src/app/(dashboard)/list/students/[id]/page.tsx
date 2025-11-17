// src/app/(dashboard)/list/students/[id]/page.tsx
"use client"; 

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Import useRouter
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from 'firebase/firestore'; // <-- Import Firestore
import { db } from '@/lib/firebaseConfig';        // <-- Import db config

// (Komponen lain yang Anda import)
import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalender";
import Performance from "@/components/Performance";
import { format } from 'date-fns'; // Untuk format tanggal (opsional)

// --- Interface Data Siswa (Sesuai Firestore Anda) ---
interface StudentDetailData {
  id: string; // Document ID (UID)
  nama_lengkap: string;
  nisn: string;
  nis: string | null;
  kelas: string | null;
  email: string | null; // Kontak
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: any; // Firestore Timestamp
  agama: string | null;
  kewarganegaraan: string | null;
  asal_sekolah: string | null;
  nomor_hp: string | null;
  status_siswa: string | null;
  foto_profil: string | null;
  alamat: { 
    jalan?: string | null;
    rt_rw?: string | null;
    kelurahan_desa?: string | null;
    kecamatan?: string | null;
    kota_kabupaten?: string | null;
    provinsi?: string | null;
    kode_pos?: string | null;
  };
  orang_tua: { 
    alamat?: string | null;
    ayah?: { nama?: string | null; pendidikan?: string | null; pekerjaan?: string | null; telepon?: string | null };
    ibu?: { nama?: string | null; pendidikan?: string | null; pekerjaan?: string | null; telepon?: string | null };
  };
  tanggal_masuk?: any; // Firestore Timestamp
}
// --- Akhir Interface ---

const SingleStudentPage = () => {
  const params = useParams();
  const router = useRouter(); // Untuk tombol kembali
  const studentId = params.id as string; // Ini adalah UID

  const [student, setStudent] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Logika Fetching Data dari Firestore ---
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!studentId) {
        setError("ID Siswa tidak ditemukan di URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Buat referensi ke dokumen siswa
        const studentDocRef = doc(db, "students", studentId);
        const docSnap = await getDoc(studentDocRef);

        if (docSnap.exists()) {
          // Gabungkan ID dokumen dengan data
          setStudent({ id: docSnap.id, ...docSnap.data() } as StudentDetailData);
        } else {
          setError("Data siswa tidak ditemukan.");
          setStudent(null);
        }
      } catch (err: any) {
        console.error("Error fetching student:", err);
        setError("Gagal mengambil data siswa: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [studentId]); // Jalankan ulang jika ID berubah
  // --- Akhir Logika Fetching ---

  // Handle loading state
  if (loading) {
    return <div className="p-8 text-center">Memuat data siswa...</div>;
  }

  // Handle error state
  if (error) {
     return (
       <div className="p-8 text-center text-red-600">
         {error}
         <button onClick={() => router.back()} className="text-blue-600 hover:underline block mt-2">
           Kembali
         </button>
       </div>
     );
  }

  // Handle student not found state
  if (!student) {
    return (
      <div className="p-8 text-center">
        Data siswa tidak ditemukan.
        <Link href="/list/students" className="text-blue-600 hover:underline block mt-2">
          Kembali ke Daftar Siswa
        </Link>
      </div>
    );
  }
  
  // Helper untuk format alamat
  const formatAlamat = (alamat: StudentDetailData['alamat']) => {
    if (!alamat) return 'N/A';
    const parts = [
      alamat.jalan,
      alamat.rt_rw ? `RT/RW ${alamat.rt_rw}` : null,
      alamat.kelurahan_desa,
      alamat.kecamatan,
      alamat.kota_kabupaten,
      alamat.provinsi,
      alamat.kode_pos,
    ].filter(Boolean); // Hapus bagian yang null/kosong
    return parts.join(', ') || 'N/A';
  };
  
  // Helper untuk format tanggal (Timestamp Firestore)
  const formatFirestoreTimestamp = (timestamp: any) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      try {
        return format(timestamp.toDate(), "d MMMM yyyy"); // Format: 26 October 2025
      } catch (e) {
        return "Invalid Date";
      }
    }
    return 'N/A';
  };

  // --- Mulai JSX (Gunakan data 'student' dari state) ---
  return (
    <div className="flex-1 p-4 flex flex-col gap-4 xl:flex-row">
      {/* LEFT */}
      <div className="w-full flex flex-col gap-6">
        {/* TOP */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* USER INFO CARD */}
          <div className="bg-lamaSky py-6 px-4 rounded-md flex-1 flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/3 flex justify-center">
              <Image
                // Gunakan foto_profil, beri fallback
                src={student.foto_profil || '/placeholder-avatar.png'} // Ganti path placeholder
                alt={student.nama_lengkap}
                width={144}
                height={144}
                className="w-36 h-36 rounded-full object-cover border-4 border-white shadow-md"
              />
            </div>
            <div className="w-full md:w-2/3 flex flex-col justify-between gap-4">
              <h1 className="text-xl font-semibold text-center md:text-left">{student.nama_lengkap}</h1>
              <p className="text-sm text-gray-500 text-center md:text-left">
                Siswa kelas {student.kelas || 'N/A'} - NISN: {student.nisn}
              </p>
              {/* Detail Kontak & Info */}
              <div className="flex items-center justify-center md:justify-start gap-x-4 gap-y-2 flex-wrap text-xs font-medium">
                 {/* Email Kontak */}
                 <div className="flex items-center gap-1">
                   <Image src="/mail.png" alt="" width={14} height={14} />
                   <span>{student.email || 'N/A'}</span>
                 </div>
                 {/* Nomor HP */}
                 <div className="flex items-center gap-1">
                   <Image src="/phone.png" alt="" width={14} height={14} />
                   <span>{student.nomor_hp || 'N/A'}</span>
                 </div>
                 {/* Tanggal Masuk */}
                 <div className="flex items-center gap-1">
                   <Image src="/date.png" alt="" width={14} height={14} />
                   <span>Masuk: {formatFirestoreTimestamp(student.tanggal_masuk)}</span> 
                 </div>
                 {/* Status Siswa */}
                 <div className="flex items-center gap-1">
                   <span className={`px-2 py-0.5 rounded-full text-xs ${student.status_siswa === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                     Status: {student.status_siswa || 'N/A'}
                   </span>
                 </div>
              </div>
              {/* Tombol Aksi (Opsional) */}
              <div className="flex justify-center md:justify-start gap-2 mt-2">
                 <button onClick={() => router.back()} className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Kembali</button>
                 {/* Anda bisa tambahkan tombol edit di sini jika mau */}
                 {/* <button className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Edit Profil</button> */}
              </div>
            </div>
          </div>
          
          {/* SMALL CARDS (Masih pakai data dummy/perlu logika tambahan) */}
          <div className="flex-1 flex gap-4 justify-between flex-wrap">
            {/* CARD Attendance (Data dummy) */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full sm:w-[48%] xl:w-full 2xl:w-[48%] shadow">
              <Image src="/singleAttendance.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">N/A</h1>
                <span className="text-sm text-gray-400">Kehadiran</span>
              </div>
            </div>
            {/* CARD Kelas (Gunakan data dinamis) */}
            <div className="bg-white p-4 rounded-md flex gap-4 w-full sm:w-[48%] xl:w-full 2xl:w-[48%] shadow">
              <Image src="/singleClass.png" alt="" width={24} height={24} className="w-6 h-6" />
              <div>
                <h1 className="text-xl font-semibold">{student.kelas || 'N/A'}</h1>
                <span className="text-sm text-gray-400">Kelas</span>
              </div>
            </div>
             {/* CARD Tingkat/Grade (Perlu logika mapping dari kelas?) */}
            {/* <div className="bg-white p-4 rounded-md ..."> ... </div> */}
             {/* CARD Pelajaran Diikuti (Data dummy) */}
            {/* <div className="bg-white p-4 rounded-md ..."> ... </div> */}
          </div>
        </div>

        {/* --- BAGIAN DATA DETAIL --- */}
        <div className="mt-4 bg-white rounded-md p-4 shadow">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Detail Informasi Siswa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
             <InfoItem label="NIS" value={student.nis} />
             <InfoItem label="Jenis Kelamin" value={student.jenis_kelamin === 'L' ? 'Laki-laki' : student.jenis_kelamin === 'P' ? 'Perempuan' : 'N/A'} />
             <InfoItem label="Tempat Lahir" value={student.tempat_lahir} />
             <InfoItem label="Tanggal Lahir" value={formatFirestoreTimestamp(student.tanggal_lahir)} />
             <InfoItem label="Agama" value={student.agama} />
             <InfoItem label="Kewarganegaraan" value={student.kewarganegaraan} />
             <InfoItem label="Asal Sekolah" value={student.asal_sekolah} />
             <InfoItem label="Alamat Lengkap" value={formatAlamat(student.alamat)} />
          </div>
        </div>
        
        {/* --- BAGIAN DATA ORANG TUA --- */}
        <div className="mt-4 bg-white rounded-md p-4 shadow">
          <h2 className="text-lg font-semibold mb-3 border-b pb-2">Detail Informasi Orang Tua</h2>
          <InfoItem label="Alamat Orang Tua" value={student.orang_tua?.alamat} />
          {/* Ayah */}
          <h3 className="text-md font-semibold mt-3 mb-1">Ayah</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
             <InfoItem label="Nama" value={student.orang_tua?.ayah?.nama} />
             <InfoItem label="Pendidikan" value={student.orang_tua?.ayah?.pendidikan} />
             <InfoItem label="Pekerjaan" value={student.orang_tua?.ayah?.pekerjaan} />
             <InfoItem label="Telepon" value={student.orang_tua?.ayah?.telepon} />
          </div>
           {/* Ibu */}
          <h3 className="text-md font-semibold mt-3 mb-1">Ibu</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
             <InfoItem label="Nama" value={student.orang_tua?.ibu?.nama} />
             <InfoItem label="Pendidikan" value={student.orang_tua?.ibu?.pendidikan} />
             <InfoItem label="Pekerjaan" value={student.orang_tua?.ibu?.pekerjaan} />
             <InfoItem label="Telepon" value={student.orang_tua?.ibu?.telepon} />
          </div>
        </div>

        {/* BOTTOM (Kalender Anda) */}
        {/* <div className="mt-4 bg-white rounded-md p-4 h-[800px]"> ... </div> */}
         <Performance />
          <Announcements />
        
      </div>


      
    </div>
  );
};

export default SingleStudentPage;

// --- Komponen Helper untuk Menampilkan Info ---
const InfoItem = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="py-1">
    <span className="font-medium text-gray-600">{label}:</span>
    <span className="ml-2 text-gray-800">{value || 'N/A'}</span>
  </div>
);