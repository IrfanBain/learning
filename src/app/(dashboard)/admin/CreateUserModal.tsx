// src/components/admin/CreateUserModal.tsx
"use client";

import React, { useState } from 'react';
import { createUserAction } from '@/app/actions/userActions';
import toast from 'react-hot-toast';

// Tipe untuk props
interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  // Kita akan tambahkan prop untuk 'onSubmit' nanti
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  // State untuk form
  const [name, setName] = useState('');
  const [username, setUsername] = useState(''); // NISN/NIP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('student');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Jika modal tidak 'isOpen', jangan render apapun
  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('student');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Panggil Server Action
    const result = await createUserAction({
      name,
      username,
      email,
      password,
      role,
      uid: '', // UID tidak diperlukan saat membuat user baru
    });

    setLoading(false);

    if (result.success) {
      // Jika sukses:
      toast.success(result.message); // Tampilkan pesan sukses
      resetForm(); // Kosongkan form
      onUserCreated(); // Panggil fungsi refresh (yang akan menutup modal)
    } else {
      // Jika gagal:
      setError(result.message); // Tampilkan error di dalam modal
    }
  };

  // Fungsi untuk menutup modal
  const handleClose = () => {
    if (loading) return; // Jangan tutup jika sedang loading
    resetForm(); // Bersihkan form saat ditutup
    onClose();
  };

  return (
    // Latar belakang overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 py-4">
      
      {/* Konten Modal */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex justify-between items-center border-b p-4">
          <h3 className="text-xl font-semibold">Tambah Pengguna Admin Baru</h3>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            &times; {/* Ini adalah 'X' untuk close */}
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Tampilkan error jika ada */}
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'student' | 'teacher' | 'admin')}
              required
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {/* <option value="student">Siswa</option>
              <option value="teacher">Guru</option> */}
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}