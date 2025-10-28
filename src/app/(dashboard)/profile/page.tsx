"use client";

import React, { useState } from "react";
import { FiEdit2, FiSettings, FiKey, FiUser, FiHome } from "react-icons/fi";
import { format } from "date-fns";
import Image from "next/image"; // Import Next.js Image
import Navbar from "@/components/Navbar";

// 1. Definisikan interface baru untuk UserData
interface UserData {
  // Profil Siswa
  statusSiswa: string;
  waliKelas: string;
  nisn: string;
  kelas: string;
  semesterAktif: string;
  tahunMasuk: string;

  // Personal Details
  fullName: string;
  email: string;
  phone: string;
  agama: string;
  dob: string;
  gender: string;
  alamat: {
    jalan: string;
    dusun: string;
    rt: string;
    rw: string;
    desa: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
  };
}

const UserProfile = () => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string>("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3");

  // 2. Inisialisasi state dengan data baru
  const [userData, setUserData] = useState<UserData>({
    statusSiswa: "Aktif",
    waliKelas: "Siti Nurhaliza, S.Pd.",
    nisn: "0012345678",
    kelas: "IX A",
    semesterAktif: "Ganjil 2025/2026",
    tahunMasuk: "2023",
    fullName: "Budi Santoso",
    email: "budi.santoso@example.com",
    phone: "081234567890",
    agama: "Islam",
    dob: "2010-05-20",
    gender: "Laki-laki",
    alamat: {
      jalan: "Jl. Merdeka No. 10",
      dusun: "Harapan Baru",
      rt: "001",
      rw: "002",
      desa: "Sukajaya",
      kecamatan: "Sukabumi",
      kabupaten: "Lampung Timur",
      provinsi: "Lampung",
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null; 
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setProfileImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper untuk update state input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  // Helper untuk update state alamat (nested object)
  const handleAlamatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prevData => ({
      ...prevData,
      alamat: {
        ...prevData.alamat,
        [name]: value,
      }
    }));
  };

  const handleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleUpdate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsEditing(false);
    // Di sini Anda bisa menambahkan logika untuk menyimpan data ke database
    console.log("Data diperbarui:", userData);
  };

  return (
    <div className="py-2 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* === KOLOM KIRI (PROFIL SISI) === */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="relative w-48 h-48 mx-auto mb-6">
                {/* Menggunakan Next.js Image */}
                <Image
                  src="/setProfile.png" // Ganti dengan path gambar lokal Anda
                  alt="Profile"
                  width={192} // w-48
                  height={192} // h-48
                  className="rounded-full object-cover"
                />
                <label className="absolute bottom-2 right-2 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                  <FiEdit2 className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>

              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">{userData.fullName}</h1>
                <p className="text-gray-600 mb-4">NISN: {userData.nisn}</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={handleEdit}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <FiEdit2 /> {isEditing ? "Batal" : "Edit Profile"}
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                    <FiKey /> Ubah Password
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* === KOLOM KANAN (DETAIL) === */}
          <div className="md:col-span-2 space-y-8">

            {/* --- KARTU PROFIL SISWA (READ ONLY) --- */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiUser /> Profil Siswa
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Read-only */}
                <InfoItem label="Status Siswa" value={userData.statusSiswa} />
                <InfoItem label="Wali Kelas" value={userData.waliKelas} />
                <InfoItem label="Kelas" value={userData.kelas} />
                <InfoItem label="Semester Aktif" value={userData.semesterAktif} />
                <InfoItem label="Tahun Masuk" value={userData.tahunMasuk} />
              </div>
            </div>

            {/* --- KARTU DETAIL PERSONAL (EDITABLE) --- */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <FiHome /> Detail Personal
              </h2>
              
              {/* Form untuk data yang bisa diedit */}
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Data Personal */}
                  <EditableItem label="Nama Lengkap" name="fullName" value={userData.fullName} isEditing={isEditing} onChange={handleInputChange} />
                  <InfoItem label="Email" value={userData.email} /> {/* Email biasanya tidak bisa diubah */}
                  <EditableItem label="No. HP" name="phone" value={userData.phone} isEditing={isEditing} onChange={handleInputChange} />
                  <EditableItem label="Agama" name="agama" value={userData.agama} isEditing={isEditing} onChange={handleInputChange} />
                  <EditableItem label="Tanggal Lahir" name="dob" value={userData.dob} isEditing={isEditing} onChange={handleInputChange} type="date" />
                  
                  {/* Input Select untuk Jenis Kelamin */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Kelamin</label>
                    {isEditing ? (
                      <select
                        name="gender"
                        value={userData.gender}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg bg-gray-50"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{userData.gender}</p>
                    )}
                  </div>
                </div>

                {/* Data Alamat */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Alamat Lengkap</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EditableItem label="Jalan" name="jalan" value={userData.alamat.jalan} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Dusun" name="dusun" value={userData.alamat.dusun} isEditing={isEditing} onChange={handleAlamatChange} />
                    
                    {/* RT / RW */}
                    <div className="flex gap-4">
                      <EditableItem label="RT" name="rt" value={userData.alamat.rt} isEditing={isEditing} onChange={handleAlamatChange} />
                      <EditableItem label="RW" name="rw" value={userData.alamat.rw} isEditing={isEditing} onChange={handleAlamatChange} />
                    </div>

                    <EditableItem label="Desa / Kelurahan" name="desa" value={userData.alamat.desa} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Kecamatan" name="kecamatan" value={userData.alamat.kecamatan} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Kabupaten / Kota" name="kabupaten" value={userData.alamat.kabupaten} isEditing={isEditing} onChange={handleAlamatChange} />
                    <EditableItem label="Provinsi" name="provinsi" value={userData.alamat.provinsi} isEditing={isEditing} onChange={handleAlamatChange} />
                  </div>
                </div>

                {/* Tombol Simpan */}
                {isEditing && (
                  <div className="mt-6 flex justify-end gap-4">
                    <button
                      type="button" // Tipe button agar tidak submit form
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit" // Tipe submit
                      onClick={handleUpdate}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Simpan Perubahan
                    </button>
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

// Komponen Helper untuk menampilkan data (Read-only)
const InfoItem = ({ label, value }: { label: string, value: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <p className="text-gray-900">{value}</p>
  </div>
);

// Komponen Helper untuk field yang bisa diedit
const EditableItem = ({ label, name, value, isEditing, onChange, type = "text" }: {
  label: string,
  name: string,
  value: string,
  isEditing: boolean,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
  type?: string
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    {isEditing ? (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded-lg bg-gray-50"
      />
    ) : (
      <p className="text-gray-900">{value}</p>
    )}
  </div>
);

export default UserProfile;