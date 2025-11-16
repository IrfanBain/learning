// app/maintenance/page.tsx

import React from 'react';
import Head from 'next/head'; // Untuk mengatur meta tags jika diperlukan

export default function MaintenancePage() {
  return (
    <>
      <Head>
        <title>Situs Sedang Perbaikan......</title>
        <meta name="robots" content="noindex, nofollow" /> {/* Penting untuk SEO */}
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center transform hover:scale-105 transition-transform duration-300 ease-in-out">
          {/* Ikon atau Ilustrasi */}
          <div className="mb-6">
            {/* Anda bisa ganti dengan ikon SVG atau gambar */}
            <svg
              className="mx-auto h-24 w-24 text-blue-600 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.174 3.35 1.9 3.35h13.713c1.726 0 2.764-1.85 1.9-3.35L13.723 3.545c-.957-1.658-3.07-1.658-4.026 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 animate-fadeIn">
            Sedang Dalam Perbaikan
          </h1>
          <p className="text-gray-700 text-lg mb-6 animate-fadeIn delay-100">
            Mohon maaf atas ketidaknyamanannya. Website kami sedang dalam pemeliharaan untuk meningkatkan kualitas layanan.
          </p>
          <p className="text-gray-600 text-md mb-8 animate-fadeIn delay-200">
            Kami akan segera kembali online\! Terima kasih atas kesabaran Anda.
          </p>
        </div>
      </div>
    </>
  );
}