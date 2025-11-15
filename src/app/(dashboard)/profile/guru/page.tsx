"use client";

import React, { useState, useEffect } from "react";
import { FiUser, FiHome } from "react-icons/fi";
import Image from "next/image";
// 1. MODIFIKASI: Hanya perlu 'doc' dan 'getDoc'
import { doc, getDoc, DocumentReference } from "firebase/firestore"; 
import { db } from "@/lib/firebaseConfig"; 
import { useAuth } from "@/context/authContext"; 

// Interface HANYA untuk Guru
interface TeacherData {
  fullName: string;
  email: string;
  phone: string;
  agama: string;
  dob: string; 
  gender: string;
  alamat: any;
  profileImage: string;
  nip: string; 
  status: string; 
  mapel: string; 
}

// Komponen Helper (Hanya InfoItem)
const InfoItem = ({ label, value }: { label: string, value: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <p className="text-gray-900">{value || "-"}</p>
  </div>
);

export default function GuruProfilePage() { 
  const [userData, setUserData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !authUser) {
      if (!authLoading) setLoading(false);
      return;
    }
    
    if (authUser.role !== "teacher") {
      setLoading(false);
      console.error("Halaman ini hanya untuk guru.");
      return;
    }

    const fetchProfileData = async (uid: string) => {
      try {
        setLoading(true);
        
        // --- 2. MODIFIKASI UTAMA: Pakai doc() ---
        const teacherDocRef = doc(db, "teachers", uid);
        const teacherSnap = await getDoc(teacherDocRef);
        // --- AKHIR MODIFIKASI ---

        if (!teacherSnap.exists()) {
          console.error("Data GURU tidak ditemukan! (ID Dokumen tidak ada)");
          setLoading(false);
          return;
        }

        const teacherData = teacherSnap.data();

        let dobString = teacherData.tanggal_lahir?.toDate().toISOString().split('T')[0] || "";
        // let mapelString = teacherData.tanggal_mulai_kerja?.toDate().toLocaleDateString('id-ID') || "N/A";

        setUserData({
          fullName: teacherData.nama_lengkap || "Tanpa Nama",
          nip: teacherData.nip_nuptk || "Tanpa NIP", 
          email: teacherData.email || "Tanpa Email",
          phone: teacherData.nomor_hp || "Tanpa No. HP",
          agama: teacherData.agama || "Tanpa Agama",
          dob: dobString,
          gender: teacherData.jenis_kelamin || "Laki-laki", 
          alamat: teacherData.alamat || {},
          profileImage: teacherData.foto_profil || "/placeholder-avatar.png",
          status: teacherData.status_kepegawaian || "tidak diketahui",
          mapel: teacherData.mata_pelajaran_diampu || "tidak diketahui",
        });

      } catch (error) {
        console.error("Gagal mengambil data profil guru:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData(authUser.uid);

  }, [authUser, authLoading]);

  // Tampilkan loading screen gabungan
  if (loading || authLoading || !userData) {
    return (
      <div className="py-2 px-6 h-screen flex justify-center items-center">
        <p className="text-xl">Memuat data profil......</p>
      </div>
    );
  }

  // --- JSX (Read-Only) ---
  return (
    <div className="py-2 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* === KOLOM KIRI (PROFIL SISI) === */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <Image src={userData.profileImage} alt="Profile" width={192} height={192} className="rounded-full object-cover"/>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">{userData.fullName}</h1>
                <p className="text-gray-600 mb-4">NIP: {userData.nip}</p>
                {/* Tombol dihapus */}
              </div>
            </div>
          </div>

          {/* === KOLOM KANAN (DETAIL) === */}
          <div className="md:col-span-2 space-y-8">
            {/* --- KARTU PROFIL GURU --- */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiUser /> Profil Guru
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem label="Status" value={userData.status} />
                <InfoItem label="Mapel Diampu" value={userData.mapel} />
              </div>
            </div>

            {/* --- KARTU DETAIL PERSONAL (Read-Only) --- */} 
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiHome /> Detail Personal
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Nama Lengkap" value={userData.fullName} />
                  <InfoItem label="Email" value={userData.email} />
                  <InfoItem label="No. HP" value={userData.phone} />
                  <InfoItem label="Agama" value={userData.agama} />
                  <InfoItem label="Tanggal Lahir" value={userData.dob} />
                  <InfoItem label="Jenis Kelamin" value={userData.gender} />
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Alamat Lengkap</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InfoItem label="Jalan" value={userData.alamat?.jalan || ''} />
                    <InfoItem label="RT/RW" value={userData.alamat?.rt_rw || ''} />
                    <InfoItem label="Desa / Kelurahan" value={userData.alamat?.kelurahan_desa || ''} />
                    <InfoItem label="Kecamatan" value={userData.alamat?.kecamatan || ''} />
                    <InfoItem label="Kabupaten / Kota" value={userData.alamat?.kota_kabupaten || ''} />
                    <InfoItem label="Provinsi" value={userData.alamat?.provinsi || ''} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}