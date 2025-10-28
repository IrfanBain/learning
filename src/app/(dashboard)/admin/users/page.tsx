// src/app/(dashboard)/admin/users/page.tsx
"use client";

// 'useMemo' adalah tambahan opsional tapi bagus untuk performa
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebaseConfig'; 
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import CreateUserModal from '../CreateUserModal';
import EditUserModal from '../EditUserModal';
import { deleteUserAction } from '@/app/actions/userActions'; 
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/authContext';

// Tipe data (tidak berubah)
interface UserData {
  id: string; 
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  password?: string;
}

export default function ManageUsersPage() {
  const { user: currentUser } = useAuth();
  // --- MODIFIKASI STATE ---
  // State untuk menyimpan filter
  const [roleFilter, setRoleFilter] = useState<string>('all'); // 'all', 'admin', 'teacher', 'student'
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // State untuk data
  const [allUsers, setAllUsers] = useState<UserData[]>([]); // Ganti nama: dari 'users' -> 'allUsers'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  // --- 1. UBAH NAMA FUNGSI 'fetchUsers' ---
  const fetchUsers = async () => {
    // ... (Logika fetchUsers Anda tidak berubah) ...
    try {
      setLoading(true); // Set loading di sini agar ada indikator
      setError(null);
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserData));
      setAllUsers(usersList);
    } catch (err) {
      // ... (logika error) ...
    } finally {
      setLoading(false);
    }
  };

  // useEffect untuk mengambil data (hanya sedikit diubah)
 useEffect(() => {
    fetchUsers(); // Panggil saat pertama kali load
  }, []);

  // --- TAMBAHAN BARU: Logika untuk memfilter data ---
  // 'useMemo' akan menjalankan ulang filter HANYA jika salah satu dari
  // 'allUsers', 'roleFilter', atau 'searchQuery' berubah.
  const filteredUsers = useMemo(() => {
    let users = [...allUsers]; // Mulai dengan semua user

    // 1. Terapkan filter Role
    if (roleFilter !== 'all') {
      users = users.filter(user => user.role === roleFilter);
    }

    // 2. Terapkan filter Search (cari di 'name' ATAU 'username')
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      users = users.filter(user => 
        user.name.toLowerCase().includes(lowerCaseQuery) ||
        user.username.toLowerCase().includes(lowerCaseQuery)
      );
    }

    return users;
  }, [allUsers, roleFilter, searchQuery]); // Dependensi

// --- 3. BUAT FUNGSI BARU UNTUK MENANGANI MODAL ---
  const handleCreateModalClose = () => {
    setIsCreateModalOpen(false);
  };
  
  const handleModalOpen = () => {
    setIsCreateModalOpen(true);
  };

  const handleUserCreation = () => {
    handleCreateModalClose(); // Tutup modal
    // 'revalidatePath' dari Server Action akan menangani refresh data.
    // Tapi jika Anda ingin refresh instan di client:
    fetchUsers(); // Anda bisa panggil ini lagi untuk refresh instan
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingUser(null); // Bersihkan user yang diedit
  };
  const handleEditModalOpen = (user: UserData) => {
    setEditingUser(user); // Set user yang akan diedit
    setIsEditModalOpen(true); // Buka modal
  };
  const handleUserUpdate = () => {
    handleEditModalClose();
    fetchUsers(); // Refresh tabel
  };
  
  const handleDeleteUser = (userId: string, userName: string) => {
    // Pencegahan di sisi client: jangan biarkan admin hapus diri sendiri
    if (currentUser?.uid === userId) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri!");
      return;
    }
  toast(
      (t) => (
        <div className="flex flex-col gap-3 p-2">
          <span className="font-semibold">
            Anda yakin ingin menghapus <strong className="text-red-600">{userName}</strong>?
          </span>
          <span className="text-sm text-gray-600">
            Tindakan ini tidak dapat dibatalkan. Akun dan data terkait akan dihapus permanen.
          </span>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 bg-gray-200 rounded-md text-sm font-medium hover:bg-gray-300"
            >
              Batal
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id); // Tutup toast konfirmasi
                // Panggil proses hapus yang sebenarnya
                performDelete(userId, userName); 
              }}
              className="px-3 py-1 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
            >
              Ya, Hapus
            </button>
          </div>
        </div>
      ),
      {
        duration: 6000, // Biarkan toast terbuka lebih lama
        position: 'top-center',
      }
    );
  };
  const performDelete = async (userId: string, userName: string) => {
    // Tampilkan toast loading saat proses
    const promise = deleteUserAction(userId);
    
    toast.promise(
      promise,
      {
        loading: `Menghapus ${userName}...`,
        success: (result) => {
          if (result.success) {
            fetchUsers(); // <-- REFRESH DATA DI SINI
            return result.message; // Pesan sukses dari server action
          } else {
            // Jika server action mengembalikan 'success: false'
            throw new Error(result.message);
          }
        },
        error: (err) => {
          // Jika promise-nya sendiri gagal (error jaringan, dll)
          return `Gagal menghapus: ${err.message}`;
        },
      }
    );
  };
  
  if (loading) {
    return <div className="p-8">Memuat data pengguna...</div>;
  }
  
  if (error) {
    return <div className="p-8 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Manajemen Pengguna</h1>
      
      <div className="mb-4">
        <button
          onClick={handleModalOpen} 
          className="bg-green-500 text-white px-4 py-2 rounded shadow hover:bg-green-600 transition-colors"
        >
          + Tambah User Baru
        </button>
      </div>

      {/* --- TAMBAHAN BARU: Baris Filter --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-4  bg-gray-50 rounded-lg">
        {/* Filter Search */}
        <div className="flex-grow">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Cari (Nama atau NISN/NIP)
          </label>
          <input
            type="text"
            id="search"
            placeholder="Ketik untuk mencari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Filter Role */}
        <div className="w-full md:w-1/4">
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Filter Role
          </label>
          <select
            id="role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="teacher">Guru</option>
            <option value="student">Siswa</option>
          </select>
        </div>
      </div>
      {/* --- AKHIR BARIS FILTER --- */}


      {/* Tabel untuk menampilkan data (diubah ke 'filteredUsers') */}
      <div className="overflow-x-auto shadow-md rounded-lg">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100">
            {/* ... header tabel (tidak berubah) ... */}
            <tr>
              <th scope="col" className="px-6 py-3">Nama</th>
              <th scope="col" className="px-6 py-3">NISN / NIP</th>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Role</th>
              <th scope="col" className="px-6 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {/* --- UBAH: Gunakan 'filteredUsers' untuk di-map --- */}
            {filteredUsers.map((user) => (
              <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  {user.name}
                </td>
                <td className="px-6 py-4">{user.username}</td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4 capitalize">{user.role}</td>
                <td className="px-6 py-4 text-left space-x-2">
                  <button 
                  onClick={() => handleEditModalOpen(user)}
                  className="font-medium text-blue-600 hover:underline">Edit</button>
                  <button 
                  onClick={() => handleDeleteUser(user.id, user.name)}
                  className="font-medium text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* --- UBAH: Pesan jika hasil filter kosong --- */}
      {filteredUsers.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          {allUsers.length === 0 
             ? "Tidak ada data pengguna ditemukan." 
             : "Tidak ada hasil yang cocok dengan filter Anda."}
        </div>
      )}
      <CreateUserModal 
      isOpen={isCreateModalOpen} 
      onClose={handleCreateModalClose}
      onUserCreated={handleUserCreation} 
      />
      <EditUserModal 
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
        onUserUpdated={handleUserUpdate}
        user={editingUser}
      />
    </div>
  );
}