// components/ProfileCard.jsx

'use client';

import Image from "next/image";

// Ganti dengan ikon Anda, misal dari lucide-react
// import { Edit, Lock } from 'lucide-react'; 

const ProfileCard = ({ data }) => {
  // Ambil field dari 'data'. Sesuaikan nama field jika berbeda.
  const { nama_lengkap, nisn_nip, foto_url, role } = data;

  const handleEditProfile = () => {
    alert("Fitur Edit Profil (hanya untuk guru)");
    // TODO: Buka modal edit profil
  };

  const handleChangePassword = () => {
    alert("Fitur Ubah Password (untuk semua)");
    // TODO: Buka modal ubah password
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center">
      <div className="relative">
        <Image
          width={100}
          height={100}
          src={foto_url || '/placeholder-avatar.png'} // Tampilkan foto profil
          alt="Foto Profil"
          className="w-32 h-32 md:w-48 md:h-48 rounded-full object-cover border-4 border-gray-100"
        />
        {/* Tombol edit foto jika guru */}
        {role === 'guru' && (
          <button className="absolute bottom-2 right-2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600">
            {/* <Edit size={16} /> */} 📷
          </button>
        )}
      </div>

      <h2 className="text-xl font-bold mt-4">{nama_lengkap || 'Nama Pengguna'}</h2>
      <p className="text-gray-500 text-sm">{nisn_nip || 'NISN/NIP tidak ada'}</p>
      
      <div className="flex gap-4 mt-6 w-full">
        {/* INI LOGIKA UTAMANYA:
          Tampilkan tombol 'Edit Profile' HANYA JIKA rolenya 'guru'
        */}
        {role === 'guru' && (
          <button 
            onClick={handleEditProfile}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600"
          >
            {/* <Edit size={16} /> */} Edit Profile
          </button>
        )}

        {/* Tombol 'Ubah Password' tampil untuk semua role */}
        <button 
          onClick={handleChangePassword}
          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700"
        >
          {/* <Lock size={16} /> */} Ubah Password
        </button>
      </div>
    </div>
  );
};

export default ProfileCard;