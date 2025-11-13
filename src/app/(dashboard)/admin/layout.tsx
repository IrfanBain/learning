"use client";

import React from 'react';
import { useAuth } from '@/context/authContext'; // Sesuaikan path ke authContext
import { useRouter } from 'next/navigation';

// Ini adalah "Admin Guard" dalam bentuk Layout
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 1. Tunggu loading selesai
  if (loading) {
    // Tampilkan UI loading sementara data user diperiksa
    return (
      <div className=" flex justify-center items-center h-screen">
        <div>Memeriksa otorisasi.....</div>
      </div>
    );
  }

  // 2. Jika tidak ada user (belum login)
  if (!user) {
    // Kembalikan ke halaman login
    router.replace('/login');
    return null; // Jangan render apapun
  }

  // 3. Jika user login, TAPI BUKAN admin
  if (user.role !== 'admin') {
    // Kembalikan ke halaman dashboard default mereka (non-admin)
    console.warn("Akses ditolak: Pengguna bukan admin.");
    router.replace('/'); // Ganti '/' dengan dashboard (misal /student) jika perlu
    return null; // Jangan render apapun
  }

  // 4. Jika lolos semua pengecekan (loading selesai, user ada, dan role == 'admin')
  // Tampilkan halaman yang diminta (yaitu children,
  // dalam kasus ini adalah 'admin/users/page.tsx')
  return <>{children}</>;
}