"use client";

import React, { useState } from 'react';
// Ikon yang relevan
import { 
  FiFilter, 
  FiPlus, 
  FiSearch, 
  FiChevronDown, 
  FiEdit, 
  FiTrash2 
} from 'react-icons/fi';

// 1. Definisikan tipe data untuk Nilai
interface Result {
  id: string;
  subjectName: string;
  student: {
    name: string;
    nisn: string;
  };
  score: number;
  teacher: string;
  class: string;
  date: string;
}

// 2. Data dummy yang lebih bervariasi
const dummyResults: Result[] = [
  {
    id: "1",
    subjectName: "Matematika",
    student: { name: "Budi Santoso", nisn: "0012345678" },
    score: 85,
    teacher: "Tommy Wise",
    class: "1A",
    date: "2025-01-01",
  },
  {
    id: "2",
    subjectName: "Bahasa Inggris",
    student: { name: "Siti Aminah", nisn: "0012345679" },
    score: 92,
    teacher: "Rhoda Frank",
    class: "2A",
    date: "2025-01-02",
  },
  {
    id: "3",
    subjectName: "IPA (Sains)",
    student: { name: "Agus Wijaya", nisn: "0012345680" },
    score: 74,
    teacher: "Della Dunn",
    class: "3A",
    date: "2025-01-03",
  },
  {
    id: "4",
    subjectName: "IPS (Social Studies)",
    student: { name: "Dewi Lestari", nisn: "0012345681" },
    score: 58,
    teacher: "Bruce Rodriguez",
    class: "1B",
    date: "2025-01-04",
  },
  {
    id: "5",
    subjectName: "Seni Budaya",
    student: { name: "Rina Hartati", nisn: "0012345682" },
    score: 95,
    teacher: "Birdie Butler",
    class: "4A",
    date: "2025-01-05",
  },
];

// 3. Komponen kecil untuk Badge Nilai (visualisasi)
const ScoreBadge = ({ score }: { score: number }) => {
  let bgColor, textColor, text;

  if (score >= 80) {
    bgColor = "bg-green-100";
    textColor = "text-green-700";
    text = `Lulus (${score})`;
  } else if (score >= 60) {
    bgColor = "bg-yellow-100";
    textColor = "text-yellow-700";
    text = `Cukup (${score})`;
  } else {
    bgColor = "bg-red-100";
    textColor = "text-red-700";
    text = `Gagal (${score})`;
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${bgColor} ${textColor}`}>
      {text}
    </span>
  );
};

// 4. Komponen Utama Halaman
export default function ResultsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Nanti Anda bisa gunakan state untuk filter
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");
  const [filterMapel, setFilterMapel] = useState("Semua Mapel");

  const filteredResults = dummyResults.filter(result =>
    result.student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Data Nilai Siswa</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Dibuat lebih fungsional */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown (Lebih baik dari search ganda) */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Kelas</option>
                <option>1A</option>
                <option>1B</option>
                <option>2A</option>
                {/* ...tambahkan kelas lain */}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={filterMapel}
                onChange={(e) => setFilterMapel(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Mapel</option>
                <option>Matematika</option>
                <option>Bahasa Inggris</option>
                {/* ...tambahkan mapel lain */}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search & Tombol Aksi */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari nama siswa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning dari desain Anda */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500">
              <FiPlus className="w-4 h-4" />
              <span>Input Nilai</span>
            </button>
          </div>
        </div>
        
        {/* Tabel Konten (Dibuat responsif) */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mata Pelajaran</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Siswa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guru</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResults.map((result) => (
                <tr key={result.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{result.subjectName}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Dibuat seperti halaman Guru Anda */}
                    <div className="text-sm font-medium text-gray-900">{result.student.name}</div>
                    <div className="text-sm text-gray-500">{result.student.nisn}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Menggunakan Badge Nilai */}
                    <ScoreBadge score={result.score} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.teacher}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.class}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {/* Aksi yang lebih jelas */}
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-900" title="Edit Nilai">
                        <FiEdit className="w-5 h-5" />
                      </button>
                      <button className="text-red-600 hover:text-red-900" title="Hapus Nilai">
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}