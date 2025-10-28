"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiFileText,
  FiAward,
  FiCalendar
} from 'react-icons/fi';
import Link from 'next/link';

// 1. Definisikan tipe Kategori dan Pengumuman
type AnnouncementCategory = 'Ujian' | 'Tugas' | 'Event' | 'Info Sekolah';

interface Announcement {
  id: string;
  title: string;
  author: string; // Nama guru/admin
  category: AnnouncementCategory;
  class: string; // e.g., "Semua Kelas", "IX A", "VIII"
  date: string;
}

// 2. Data dummy
const dummyAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "Jadwal Ujian Tengah Semester Ganjil",
    author: "Admin Sistem",
    category: "Ujian",
    class: "Semua Kelas",
    date: "2025-10-20",
  },
  {
    id: "2",
    title: "Tugas Video Praktik Biologi",
    author: "Agus Wijaya",
    category: "Tugas",
    class: "IX A",
    date: "2025-10-19",
  },
  {
    id: "3",
    title: "Pendaftaran Class Meeting",
    author: "OSIS",
    category: "Event",
    class: "Semua Kelas",
    date: "2025-10-18",
  },
  {
    id: "4",
    title: "Pengambilan Rapor Sisipan",
    author: "Siti Aminah (Wali Kelas)",
    category: "Info Sekolah",
    class: "IX A",
    date: "2025-10-17",
  },
  {
    id: "5",
    title: "Ulangan Harian Fisika Bab 3 Ditunda",
    author: "Agus Wijaya",
    category: "Ujian",
    class: "IX A",
    date: "2025-10-16",
  },
];

// 3. Komponen kecil untuk Badge Kategori
const CategoryBadge = ({ category }: { category: AnnouncementCategory }) => {
  let colors = "";
  let icon = <FiFileText />;

  switch (category) {
    case 'Ujian':
      colors = "bg-red-100 text-red-700";
      icon = <FiFileText className="w-4 h-4" />;
      break;
    case 'Tugas':
      colors = "bg-yellow-100 text-yellow-700";
      icon = <FiAward className="w-4 h-4" />;
      break;
    case 'Event':
      colors = "bg-blue-100 text-blue-700";
      icon = <FiCalendar className="w-4 h-4" />;
      break;
    case 'Info Sekolah':
      colors = "bg-purple-100 text-purple-700";
      icon = <FiFileText className="w-4 h-4" />;
      break;
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${colors}`}>
      {icon}
      {category}
    </span>
  );
};

// 4. Komponen Utama Halaman
export default function AnnouncementsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKategori, setFilterKategori] = useState("Semua Kategori");
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");

  const filteredAnnouncements = dummyAnnouncements.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterKategori === "Semua Kategori" || item.category === filterKategori) &&
    (filterKelas === "Semua Kelas" || item.class === filterKelas)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Semua Pengumuman</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Kategori</option>
                <option>Ujian</option>
                <option>Tugas</option>
                <option>Event</option>
                <option>Info Sekolah</option>
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Kelas</option>
                <option>IX A</option>
                <option>IX B</option>
                {/* ...tambahkan kelas lain */}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search & Tombol Aksi */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari pengumuman..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning (sesuai desain Anda) */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500">
              <FiPlus className="w-4 h-4" />
              <span>Buat Baru</span>
            </button>
          </div>
        </div>
        
        {/* Tabel Konten */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Untuk Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAnnouncements.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-500">Oleh: {item.author}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CategoryBadge category={item.category} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Aksi "Lihat" yang konsisten */}
                    <Link 
                      href={`/dashboard/announcements/${item.id}`}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 w-fit"
                    >
                      <FiEye className="w-4 h-4" />
                      <span>Lihat</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAnnouncements.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada pengumuman yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}