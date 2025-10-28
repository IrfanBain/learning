"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiEdit,
  FiTrash2,
  FiFilter // Ikon untuk filter
} from 'react-icons/fi';
import Link from 'next/link';

// 1. Definisikan tipe data untuk Pelajaran
interface Lesson {
  id: string;
  subjectName: string;
  class: string;
  teacher: string;
}

// 2. Data dummy
const dummyLessons: Lesson[] = [
  { id: "1", subjectName: "Matematika", class: "7A", teacher: "Budi Hartono, S.Pd." },
  { id: "2", subjectName: "Bahasa Inggris", class: "8A", teacher: "Dewi Lestari, S.S." },
  { id: "3", subjectName: "IPA (Ilmu Pengetahuan Terpadu)", class: "9A", teacher: "Agus Wijaya, M.Si." },
  { id: "44", subjectName: "IPS (Ilmu Pengetahuan Sosial)", class: "7B", teacher: "Siti Aminah, S.Pd." },
  { id: "5", subjectName: "Seni Budaya", class: "7C", teacher: "Rina Hartati, S.Sn." },
  { id: "6", subjectName: "Pendidikan Jasmani (PJOK)", class: "8B", teacher: "Ahmad Yani, S.Or." },
  { id: "7", subjectName: "Sejarah", class: "8C", teacher: "Herman Santoso, S.Hum." },
  { id: "8", subjectName: "Geografi", class: "9B", teacher: "Lina Marpaung, S.Pd." },
  { id: "9", subjectName: "Fisika (IPA Terpadu)", class: "9C", teacher: "Rahmat Hidayat, M.Si." },
  { id: "10", subjectName: "Informatika (TIK)", class: "7A", teacher: "Yulia Puspita, S.Kom." },
];

// 3. Komponen Utama Halaman
export default function PelajaranPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");

  // --- PERBAIKAN: Buat daftar kelas unik dari data asli ---
  const uniqueClasses = Array.from(new Set(dummyLessons.map(item => item.class))).sort();

  const filteredLessons = dummyLessons.filter(item =>
    (item.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.teacher.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterKelas === "Semua Kelas" || item.class === filterKelas)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Semua Pelajaran</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter, Search, dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown (Mengganti tombol abu-abu) */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Kelas</option>
                {/* --- PERBAIKAN: Gunakan 'uniqueClasses' untuk me-render opsi --- */}
                {uniqueClasses.map((kelas) => (
                  <option key={kelas} value={kelas}>{kelas}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            {/* Tombol Filter abu-abu/kuning kedua */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <FiFilter className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Tombol Aksi */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari pelajaran/guru..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning (Tambah Pelajaran) */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500">
              <FiPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Tabel Konten */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Mata Pelajaran</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guru</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLessons.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">{item.subjectName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.teacher}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Aksi Sesuai Desain (2 tombol) */}
                    <div className="flex gap-3">
                      <Link 
                        href={`/dashboard/lessons/${item.id}`} // Nanti akan ke detail pelajaran
                        className="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 rounded-lg" 
                        title="Lihat Detail"
                      >
                        <FiEye className="w-5 h-5" />
                      </Link>
                      <button 
                        className="text-purple-500 hover:text-purple-700 p-2 bg-purple-50 rounded-lg" 
                        title="Edit"
                      >
                        <FiEdit className="w-5 h-5" />
                      </button>
                      {/* Saya tambahkan Hapus agar konsisten */}
                      <button 
                        className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg" 
                        title="Hapus"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLessons.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada pelajaran yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}