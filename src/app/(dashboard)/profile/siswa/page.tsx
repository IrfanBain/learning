"use client";

import React, { useState, useEffect } from "react";
import { FiEdit2, FiKey, FiUser, FiHome } from "react-icons/fi";
import Image from "next/image";
import { doc, getDoc, DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // <-- Impor db
import { useAuth } from "@/context/authContext"; // <-- 1. IMPOR useAuth (Pastikan path ini benar)

// Definisikan interface UserData
interface UserData {
  statusSiswa: string;
  waliKelas: string;
  nisn: string;
  kelas: string;
  semesterAktif: string;
  tahunMasuk: string;
  fullName: string;
  email: string;
  phone: string;
  agama: string;
  dob: string; // <-- Ini harus string (YYYY-MM-DD)
  gender: string;
  alamat: {
    jalan: string;
    kecamatan: string;
    kelurahan_desa: string; 
    rt_rw: string; 
    kota_kabupaten: string; 
    provinsi: string; 
  };
}

const UserProfile = () => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string>("/placeholder-avatar.png");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // 2. Dapatkan user dari hook auth
  const { user: authUser, loading: authLoading } = useAuth();

  // 3. Gunakan useEffect untuk mengambil data
  useEffect(() => {
    if (authLoading || !authUser) {
      return;
    }
    if (authUser.role !== "student") {
      setLoading(false);
      console.error("Halaman ini hanya untuk siswa.");
      return;
    }

    const fetchProfileData = async (uid: string) => {
      try {
        setLoading(true);
        // --- 1. Ambil Dokumen Siswa ---
        const studentDocRef = doc(db, "students", uid);
        const studentSnap = await getDoc(studentDocRef);

        if (!studentSnap.exists()) {
          console.error("Data siswa tidak ditemukan!");
          return;
        }

        const studentData = studentSnap.data();

        // --- !! KODE PERBAIKAN DI SINI !! ---
        // Konversi Firebase Timestamp ke string YYYY-MM-DD
        let dobString = ""; 
        if (studentData.tanggal_lahir && typeof studentData.tanggal_lahir.toDate === 'function') {
          const date = studentData.tanggal_lahir.toDate();
          dobString = date.toISOString().split('T')[0]; // Format: "2010-05-20"
        }
        // --- AKHIR KODE PERBAIKAN ---

        // --- 2. Ambil Dokumen Kelas ---
        let kelasName = "Belum ada kelas";
        let waliKelasName = "Belum ada wali";
        const kelasRef = studentData.kelas_ref; 

        if (kelasRef && kelasRef instanceof DocumentReference) {
          const kelasSnap = await getDoc(kelasRef);
          if (kelasSnap.exists()) {
            const kelasData = kelasSnap.data();
            kelasName = kelasData.nama_kelas || "Nama Kelas?"; 

            // --- 3. Ambil Dokumen Wali Kelas ---
            const waliRef = kelasData.wali_kelas_ref;
            if (waliRef && waliRef instanceof DocumentReference) {
              const waliSnap = await getDoc(waliRef);
              if (waliSnap.exists()) {
                waliKelasName = waliSnap.data().nama_lengkap || "Nama Guru?";
              }
            }
          }
        }

        // --- 4. Update State dengan data live ---
        setUserData({
          fullName: studentData.nama_lengkap || "Tanpa Nama",
          nisn: studentData.nisn || "Tanpa NISN",
          email: studentData.email || "Tanpa Email",
          phone: studentData.nomor_hp || "Tanpa No. HP",
          agama: studentData.agama || "Tanpa Agama",
          dob: dobString, // <-- Gunakan string yang sudah diformat
          gender: studentData.jenis_kelamin || "Laki-laki", 
          
          alamat: {
            jalan: studentData.alamat?.jalan || "",
            kecamatan: studentData.alamat?.kecamatan || "",
            kelurahan_desa: studentData.alamat?.kelurahan_desa || "",
            rt_rw: studentData.alamat?.rt_rw || "",
            kota_kabupaten: studentData.alamat?.kota_kabupaten || "",
            provinsi: studentData.alamat?.provinsi || "",
          },
          
          kelas: kelasName,
          waliKelas: waliKelasName,
          
          statusSiswa: "Aktif", // Hardcoded
          semesterAktif: "Ganjil 2025/2026", // Hardcoded
          tahunMasuk: studentData.tahun_masuk || "2023", 
        });

        if (studentData.foto_profil) {
          setProfileImage(studentData.foto_profil);
        }

      } catch (error) {
        console.error("Gagal mengambil data profil:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData(authUser.uid);

  }, [authUser, authLoading]);

  
  // --- Fungsi-fungsi Handler ---
  
  const handleEdit = () => { setIsEditing(!isEditing); };
  
  const handleUpdate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsEditing(false);
    console.log("Data diperbarui:", userData);
    // TODO: Tambahkan logika updateDoc() ke Firebase di sini
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (userData) {
      setUserData({ ...userData, [name]: value });
    }
  };

  const handleAlamatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (userData) {
      setUserData(prevData => ({
        ...prevData!,
        alamat: {
          ...prevData!.alamat,
          [name]: value,
        }
      }));
    }
  };

  // Tampilkan loading screen gabungan
  if (loading || authLoading || !userData) {
    return (
      <div className="py-2 px-6 h-screen flex justify-center items-center">
        <p className="text-xl">Memuat data profil......</p>
      </div>
    );
  }

  // --- Return JSX ---
  return (
    <div className="py-2 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* === KOLOM KIRI (PROFIL SISI) === */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <Image
                  src={profileImage}
                  alt="Profile"
                  width={192}
                  height={192}
                  className="rounded-full object-cover"
                />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">{userData.fullName}</h1>
                <p className="text-gray-600 mb-4">NISN: {userData.nisn}</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  {/* <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                    <FiKey /> Ubah Password
                  </button> */}
                </div>
              </div>
            </div>
          </div>

          {/* === KOLOM KANAN (DETAIL) === */}
          <div className="md:col-span-2 space-y-8">
            {/* --- KARTU PROFIL SISWA --- */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiUser /> Profil Siswa
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem label="Status Siswa" value={userData.statusSiswa} />
                <InfoItem label="Wali Kelas" value={userData.waliKelas} />
                <InfoItem label="Kelas" value={userData.kelas} />
                <InfoItem label="Semester Aktif" value={userData.semesterAktif} />
                <InfoItem label="Tahun Masuk" value={userData.tahunMasuk} />
              </div>
            </div>

            {/* --- KARTU DETAIL PERSONAL --- */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiHome /> Detail Personal
              </h2>
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableItem label="Nama Lengkap" name="fullName" value={userData.fullName} isEditing={isEditing} onChange={handleInputChange} />
                  <InfoItem label="Email" value={userData.email} />
                  <EditableItem label="No. HP" name="phone" value={userData.phone} isEditing={isEditing} onChange={handleInputChange} />
                  <EditableItem label="Agama" name="agama" value={userData.agama} isEditing={isEditing} onChange={handleInputChange} />
                  <EditableItem label="Tanggal Lahir" name="dob" value={userData.dob} isEditing={isEditing} onChange={handleInputChange} type="date" />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Kelamin</label>
                    {isEditing ? (
                      <select name="gender" value={userData.gender} onChange={handleInputChange} className="w-full p-2 border rounded-lg bg-gray-50">
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{userData.gender}</p>
                    )}
                  </div>
                </div>

                {/* Data Alamat (Sesuai DB) */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Alamat Lengkap</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EditableItem label="Jalan" name="jalan" value={userData.alamat.jalan} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="RT/RW" name="rt_rw" value={userData.alamat.rt_rw} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Desa / Kelurahan" name="kelurahan_desa" value={userData.alamat.kelurahan_desa} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Kecamatan" name="kecamatan" value={userData.alamat.kecamatan} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Kabupaten / Kota" name="kota_kabupaten" value={userData.alamat.kota_kabupaten} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Provinsi" name="provinsi" value={userData.alamat.provinsi} isEditing={isEditing} onChange={handleAlamatChange} />
                  </div>
                </div>

                {/* Tombol Simpan */}
                {isEditing && (
                  <div className="mt-6 flex justify-end gap-4">
                    {/* ... (tombol) ... */}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Komponen Helper ---

const InfoItem = ({ label, value }: { label: string, value: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <p className="text-gray-900">{value || "-"}</p>
  </div>
);

const EditableItem = ({ label, name, value, isEditing, onChange, type = "text" }: {
  label: string,
  name: string,
  value: string,
  isEditing: boolean,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type?: string
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    {isEditing ? (
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        className="w-full p-2 border rounded-lg bg-gray-50"
      />
    ) : (
      <p className="text-gray-900">{value || "-"}</p>
    )}
  </div>
);

export default UserProfile;