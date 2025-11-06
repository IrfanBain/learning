"use client";

import React, { use } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Jika Anda ingin menggunakan logo
import { FiBookOpen, FiUsers, FiBarChart2, FiLogIn } from 'react-icons/fi'; // Ikon relevan
import { useAuth } from '@/context/authContext';
import { useRouter } from 'next/navigation';

const dashboardPaths: { [key in 'admin' | 'teacher' | 'student']: string } = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};

export default function HomePage() {

  const { user, loading } = useAuth(); // Dapatkan status user
  const router = useRouter(); // Dapatkan router

  // HAPUS: useEffect yang redirect otomatis dihapus

  // Tentukan tujuan link/aksi tombol login
  let loginAction: string | (() => void) = '/login'; // Default ke halaman login
  let loginButtonText = "Login Siswa/Guru";

  if (!loading && user) { // Jika tidak loading DAN sudah login
    const userRole = user.role;
    loginAction = (userRole && dashboardPaths[userRole]) ? dashboardPaths[userRole] : '/dashboard'; // Ganti href ke dashboard
    loginButtonText = "Masuk ke Dashboard"; // Ganti teks tombol
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-gray-800">
      
      {/* 1. Navbar Sederhana */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo (Opsional) */}
        <Link href="/" className="flex items-center gap-2">
           <Image src="/logo.png" alt="sistem pembelajaran online Logo" width={32} height={32} />
           <span className="text-xl font-bold text-emerald-700">Sistem Pembelajaran Online MTs Al-Khairiyah</span> 
        </Link>
      </nav>

      {/* 2. Hero Section */}
      <header className="container mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-emerald-800 mb-4 leading-tight">
          Buka Potensi Belajar Tanpa Batas
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Selamat datang di platform sistem pembelajaran online modern MTs Al-Khairiyah Tanjung Wangi. Akses dan kerjakan latihan, ikuti diskusi, dan pantau progres belajar Anda kapan saja, di mana saja.
        </p>

        {typeof loginAction === 'string' ? (
        <Link 
          href={loginAction}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition duration-300 inline-flex items-center gap-2 shadow-lg"
        >
          {loginButtonText}
          <FiLogIn />
        </Link>
        ) : (
        <button 
          onClick={loginAction}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition duration-300 inline-flex items-center gap-2 shadow-lg"
        >
          {loginButtonText}
          <FiLogIn />
        </button>
        )}

      </header>

      {/* 3. Features Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Ayo jadikan belajar lebih menyenangkan dengan platform digital!
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Fitur 1 */}
            <div className="text-center p-6 border border-emerald-100 rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-emerald-100 text-emerald-600">
                <FiBookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Mudah Diakses</h3>
              <p className="text-gray-600">
                Akses materi pembelajaran, tugas, dan latihan kapan saja melalui perangkat apa pun.
              </p>
            </div>
            {/* Fitur 2 */}
            <div className="text-center p-6 border border-emerald-100 rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-emerald-100 text-emerald-600">
                <FiUsers className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Kolaborasi & Diskusi</h3>
              <p className="text-gray-600">
                Forum diskusi per kelas atau mata pelajaran untuk bertanya jawab dengan guru dan teman.
              </p>
            </div>
            {/* Fitur 3 */}
            <div className="text-center p-6 border border-emerald-100 rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-emerald-100 text-emerald-600">
                <FiBarChart2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pantau Progres Belajar</h3>
              <p className="text-gray-600">
                Lihat nilai tugas, hasil latihan, dan rekap absensi Anda secara real-time.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* 4. Call to Action Section (Opsional) */}
       <section className="py-20 text-center px-6">
          <h2 className="text-3xl font-bold text-emerald-800 mb-6">
            Siap Memulai Perjalanan Belajar Anda?
          </h2>
           {typeof loginAction === 'string' ? (
        <Link 
          href={loginAction}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition duration-300 inline-flex items-center gap-2 shadow-lg"
        >
          {loginButtonText}
          <FiLogIn />
        </Link>
        ) : (
        <button 
          onClick={loginAction}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-full text-lg transition duration-300 inline-flex items-center gap-2 shadow-lg"
        >
          {loginButtonText}
          <FiLogIn />
        </button>
        )}
       </section>


      {/* 5. Footer */}
      <footer className="bg-gray-100 py-6">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} sistem pembelajaran online MTs Al-Khairiyah. Hak Cipta Dilindungi.
        </div>
      </footer>

    </div>
  );
}