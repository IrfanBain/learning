"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiEdit,
  FiTrash2,
  FiFilter
} from 'react-icons/fi';
import Link from 'next/link';

// 1. Definisikan tipe data untuk Kelas
interface ClassRecord {
  id: string;
  className: string; // Nama Kelas (e.g., "7A")
  capacity: number; // Kapasitas
  level: number; // Tingkat (7, 8, atau 9)
  waliKelas: string; // Wali Kelas
}

// 2. Data dummy (Disesuaikan untuk SMP Indonesia)
const dummyClasses: ClassRecord[] = [
  { id: "1", className: "7A", capacity: 30, level: 7, waliKelas: "Budi Hartono, S.Pd." },
  { id: "2", className: "7B", capacity: 28, level: 7, waliKelas: "Siti Aminah, S.Pd." },
  { id: "3", className: "7C", capacity: 30, level: 7, waliKelas: "Rina Hartati, S.Sn." },
  { id: "4", className: "8A", capacity: 29, level: 8, waliKelas: "Dewi Lestari, S.S." },
  { id: "5", className: "8B", capacity: 30, level: 8, waliKelas: "Ahmad Yani, S.Or." },
  { id: "6", className: "8C", capacity: 28, level: 8, waliKelas: "Herman Santoso, S.Hum." },
  { id: "7", className: "9A", capacity: 30, level: 9, waliKelas: "Agus Wijaya, M.Si." },
  { id: "8", className: "9B", capacity: 30, level: 9, waliKelas: "Lina Marpaung, S.Pd." },
  { id: "9", className: "9C", capacity: 29, level: 9, waliKelas: "Rahmat Hidayat, M.Si." },
];

// 3. Komponen Utama Halaman
export default function ClassesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("Semua Tingkat");

  // Buat daftar tingkat unik (7, 8, 9) untuk filter
  const uniqueLevels = Array.from(new Set(dummyClasses.map(item => item.level))).sort((a, b) => a - b);

  const filteredClasses = dummyClasses.filter(item =>
    (item.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.waliKelas.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterLevel === "Semua Tingkat" || item.level.toString() === filterLevel)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Semua Kelas</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter, Search, dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Semua Tingkat">Semua Tingkat</option>
                {uniqueLevels.map((level) => (
                  <option key={level} value={level.toString()}>{`Tingkat ${level}`}</option>
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
                placeholder="Cari kelas/wali kelas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning (Tambah Kelas) */}
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapasitas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tingkat</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wali Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClasses.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-50 text-blue-800">
                      {item.className}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.capacity} Siswa</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.waliKelas}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-3">
                      <Link 
                        href={`/dashboard/classes/${item.id}`} // Nanti akan ke detail kelas
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

          {filteredClasses.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada kelas yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}