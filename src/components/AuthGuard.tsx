"use client";

import React, { ReactNode } from 'react';
import { useAuth } from '@/context/authContext';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import Link from 'next/link';

// Definisikan role apa saja yang diizinkan untuk path tertentu
// Anda bisa membuat ini lebih dinamis nanti
const allowedRoles: { [key: string]: Array<'admin' | 'teacher' | 'student'> } = {
  '/admin': ['admin'],
  '/teacher': ['teacher'],
  '/student': ['student'],
  '/list/teachers': ['admin', 'teacher',], 
  '/list/students': ['admin', 'teacher',], 
  '/list/classes': ['admin', 'teacher',], 
  '/list/subjects': ['admin', 'teacher', 'student'], 
  '/list/schedules': ['admin'], 
  '/list/exams': ['admin', 'teacher', 'student'], 
  '/list/assignments': ['admin', 'teacher', 'student'], 
  '/list/discussions': ['admin', 'teacher', 'student'], 
  '/list/results': ['admin', 'teacher', 'student'], 
  '/list/absensi': ['admin', 'teacher', 'student'], 
  '/list/events': ['admin', 'teacher', 'student'], 
  '/list/messages': ['admin', 'teacher', 'student'], 
  '/list/announcements': ['admin', 'teacher', 'student'], 
  '/profile': ['admin', 'teacher', 'student'],
  '/setting': ['admin', 'teacher', 'student'],
  '/logout': ['admin', 'teacher', 'student'],
};

    const dashboardPaths: { [key in 'admin' | 'teacher' | 'student']: string } = {
    admin: '/admin',
    teacher: '/teacher',
    student: '/student',
    };

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 1. Tampilkan loading jika status auth belum siap
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Memeriksa sesi login...</p> {/* Atau spinner */}
      </div>
    );
  }

  // 2. Jika tidak loading dan tidak ada user, redirect ke login
  if (!user) {
    // Redirect ke halaman login, mungkin tambahkan ?redirect=pathname
    // agar bisa kembali setelah login
    if (typeof window !== 'undefined') { // Pastikan hanya berjalan di client
        router.replace(`/login?redirect=${pathname}`);
    }
    return null; // Jangan render children
  }

  // 3. Cek Role (jika user sudah login)
  const baseDashboardPath = pathname.split('/')[1]; // Ambil bagian pertama path (admin, dashboard, student)
  const requiredPath = `/${baseDashboardPath}`; // Bentuk path dasar (misal /admin)

  // Cari path yang paling cocok di allowedRoles (handle sub-path seperti /list/students)
  let rolesForCurrentPath: Array<'admin' | 'teacher' | 'student'> | undefined;
  for (const pathPrefix in allowedRoles) {
      if (pathname.startsWith(pathPrefix)) {
          rolesForCurrentPath = allowedRoles[pathPrefix];
          break; // Ambil yang pertama cocok (yang lebih spesifik)
      }
  }


  // Jika path tidak terdefinisi di allowedRoles ATAU role user tidak diizinkan
  if (!rolesForCurrentPath || !user.role || !rolesForCurrentPath.includes(user.role)) {
     console.warn(`Akses ditolak: User role '${user.role}' mencoba akses '${pathname}'`);
     // Tampilkan halaman akses ditolak atau redirect ke dashboard utama user
     const userRole = user.role;
     const homePath = userRole ? dashboardPaths[userRole] : '/';
     return (
       <div className="flex flex-col items-center justify-center h-screen text-center p-4">
         <h1 className="text-2xl font-bold text-red-600 mb-4">Akses Ditolak</h1>
         <p className="text-gray-700 mb-6">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
         <Link href={homePath} className="text-blue-600 hover:underline">
           Kembali ke Dashboard Utama Anda
         </Link>
       </div>
     );
  }


  // 4. Jika user ada dan role sesuai, tampilkan children (halaman)
  return <>{children}</>;
}