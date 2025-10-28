"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiEdit,
  FiTrash2,
  FiFilter,
  FiCalendar // Untuk filter tanggal
} from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

// 1. Definisikan tipe data untuk Event
interface SchoolEvent {
  id: string;
  title: string;
  classTarget: string; // Target kelas (e.g., "Semua Kelas", "IX", "7A")
  date: string; // Format YYYY-MM-DD
  startTime: string; // Format HH:MM
  endTime: string; // Format HH:MM
  location: string; // Tempat acara
}

// 2. Data dummy (Acara Sekolah Indonesia)
const dummyEvents: SchoolEvent[] = [
  {
    id: "1",
    title: "Class Meeting - Lomba Futsal",
    classTarget: "Semua Kelas",
    date: "2025-10-27",
    startTime: "08:00",
    endTime: "11:00",
    location: "Lapangan Olahraga",
  },
  {
    id: "2",
    title: "Pentas Seni Akhir Semester",
    classTarget: "Semua Kelas",
    date: "2025-12-15",
    startTime: "09:00",
    endTime: "12:00",
    location: "Aula Sekolah",
  },
  {
    id: "3",
    title: "Ujian Tengah Semester Ganjil",
    classTarget: "Semua Kelas",
    date: "2025-11-03", // Rentang tanggal bisa di detail
    startTime: "07:30",
    endTime: "12:00",
    location: "Ruang Kelas Masing-masing",
  },
  {
    id: "4",
    title: "Studi Tur ke Museum Nasional",
    classTarget: "Kelas 8",
    date: "2025-11-10",
    startTime: "07:00",
    endTime: "15:00",
    location: "Museum Nasional, Jakarta",
  },
  {
    id: "5",
    title: "LDKS (Latihan Dasar Kepemimpinan Siswa)",
    classTarget: "OSIS & Perwakilan Kelas",
    date: "2025-11-15",
    startTime: "08:00", // Bisa jadi acara beberapa hari
    endTime: "16:00",
    location: "Bumi Perkemahan Cibubur",
  },
];

// 3. Komponen Utama Halaman
export default function EventsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState("Semua Bulan"); // Filter berdasarkan bulan

  // Buat daftar bulan unik dari data untuk filter
  const uniqueMonths = Array.from(new Set(dummyEvents.map(item => format(parseISO(item.date), "yyyy-MM")))).sort();

  const filteredEvents = dummyEvents.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterMonth === "Semua Bulan" || format(parseISO(item.date), "yyyy-MM") === filterMonth)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Semua Acara</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter, Search, dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 pl-10 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Semua Bulan">Semua Bulan</option>
                {uniqueMonths.map((month) => (
                  <option key={month} value={month}>{format(parseISO(`${month}-01`), "MMMM yyyy")}</option>
                ))}
              </select>
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
                placeholder="Cari acara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning (Tambah Acara) */}
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Acara</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu Mulai</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu Selesai</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.classTarget}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(parseISO(item.date), "dd MMM yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.startTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.endTime}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">{item.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-3">
                      <Link 
                        href={`/dashboard/events/${item.id}`} // Nanti akan ke detail acara
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

          {filteredEvents.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada acara yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}