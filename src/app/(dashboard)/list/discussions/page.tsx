"use client";

import Image from 'next/image';
import React, { useState } from 'react';
// Impor ikon-ikon yang kita perlukan
import { 
  FiSearch, 
  FiFilter, 
  FiPlus, 
  FiMessageSquare, 
  FiEye, 
  FiTrendingUp 
} from 'react-icons/fi';

// 1. Definisikan tipe data untuk setiap topik diskusi
interface DiscussionTopic {
  id: string;
  title: string;
  author: {
    name: string;
    avatar: string; // URL ke gambar avatar
  };
  class: string; // Kelas atau mata pelajaran
  replies: number;
  isPopular: boolean;
}

// 2. Data dummy untuk ditampilkan
const dummyDiscussions: DiscussionTopic[] = [
  {
    id: "1",
    title: "Diskusi Santuy Materi Kalkulus",
    author: { name: "Budi Santoso", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3" },
    class: "Matematika IX A",
    replies: 5,
    isPopular: false,
  },
  {
    id: "2",
    title: "Materi Bab 4 (Aljabar) sulit dipahami, ada video tambahan?",
    author: { name: "Siti Aminah", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3" },
    class: "Matematika IX A",
    replies: 22,
    isPopular: true,
  },
  {
    id: "3",
    title: "Kapan jadwal ujian susulan Fisika?",
    author: { name: "Agus Wijaya", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3" },
    class: "Fisika IX B",
    replies: 2,
    isPopular: false,
  },
  {
    id: "4",
    title: "Diskusi PR Kelompok: Sejarah Kerajaan Majapahit",
    author: { name: "Dewi Lestari", avatar: "https://images.unsplash.com/photo-1573496359112-58d34C2b3a3b?ixlib=rb-4.0.3" },
    class: "Sejarah VIII A",
    replies: 15,
    isPopular: false,
  },
  {
    id: "6",
    title: "Diskusi praktikum Kimia Organik",
    author: { name: "Doni Saputra", avatar: "https://images.unsplash.com/photo-1573496359112-58d34C2b3a3b?ixlib=rb-4.0.3" },
    class: "Kimia IX C",
    replies: 9,
    isPopular: false,
  },
  {
    id: "4",
    title: "yang sulit dipahami di bab trigonometri",
    author: { name: "Bambang ", avatar: "https://images.unsplash.com/photo-1573496359112-58d34C2b3a3b?ixlib=rb-4.0.3" },
    class: "matematika IX A",
    replies: 7,
    isPopular: false,
  },
];

export default function DiscussionsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // Nanti Anda bisa filter 'dummyDiscussions' berdasarkan 'searchTerm'
  const filteredDiscussions = dummyDiscussions.filter(topic =>
    topic.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    // Kontainer utama halaman dengan padding
    <div className="p-4 md:p-8">
      
      {/* 1. Judul Halaman (seperti "Semua Guru") */}
      <h2 className="text-2xl font-semibold mb-5">Forum Diskusi</h2>

      {/* 2. Kartu Putih Utama */}
      <div className="bg-white rounded-lg shadow-md">
        
        {/* 3. Header di dalam Kartu (Search, Filter, Aksi) */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200">
          <div className="relative w-full md:w-1/3">
            <input
              type="text"
              placeholder="Cari topik diskusi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            {/* Tombol-tombol ini meniru tombol kuning/abu-abu Anda */}
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <FiFilter className="w-4 h-4" />
              <span>Filter</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <FiPlus className="w-4 h-4" />
              <span>Buat Topik Baru</span>
            </button>
          </div>
        </div>

        {/* 4. Daftar Konten (Daftar Diskusi) */}
        <div className="divide-y divide-gray-200">
          {filteredDiscussions.map((item) => (
            <div key={item.id} className="flex items-center p-4 hover:bg-gray-50">
              {/* Avatar & Info Penulis */}
              <div className="flex-shrink-0">
                <Image 
                  src="/setProfile.png"
                  width={100}
                  height={100}
                  alt={item.author.name} 
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>

              {/* Judul & Detail */}
              <div className="flex-grow mx-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-gray-900 hover:text-blue-600 cursor-pointer">
                    {item.title}
                  </span>
                  {item.isPopular && (
                    <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      <FiTrendingUp /> Populer
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Oleh <span className="font-medium">{item.author.name}</span> di <span className="font-medium">{item.class}</span>
                </p>
              </div>

              {/* Statistik & Aksi */}
              <div className="flex-shrink-0 flex items-center gap-6">
                <div className="flex items-center gap-2 text-gray-600">
                  <FiMessageSquare className="w-5 h-5" />
                  <span className="font-medium">{item.replies}</span>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  <FiEye className="w-4 h-4" />
                  <span>Lihat</span>
                </button>
              </div>
            </div>
          ))}

          {/* Kondisi jika tidak ada hasil */}
          {filteredDiscussions.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada topik diskusi yang ditemukan.
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}