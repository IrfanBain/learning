"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiClock, // Ikon untuk waktu
  FiEdit,
  FiTrash2
} from 'react-icons/fi';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import Link from 'next/link';

// 1. Definisikan tipe data untuk Tugas
interface Assignment {
  id: string;
  title: string;
  subject: string;
  class: string;
  teacher: string;
  dueDate: string; // Format YYYY-MM-DD
}

// 2. Data dummy
const dummyAssignments: Assignment[] = [
  {
    id: "1",
    title: "PR Aljabar Bab 3",
    subject: "Matematika",
    class: "1A",
    teacher: "Tommy Wise",
    dueDate: "2025-10-25", // Mendatang
  },
  {
    id: "2",
    title: "Presentasi Kelompok Sejarah",
    subject: "Sejarah",
    class: "6A",
    teacher: "Herman Howard",
    dueDate: "2025-10-22", // Hari ini
  },
  {
    id: "3",
    title: "Esai Bahasa Inggris: My Holiday",
    subject: "Bahasa Inggris",
    class: "2A",
    teacher: "Rhoda Frank",
    dueDate: "2025-10-20", // Terlewat
  },
  {
    id: "4",
    title: "Praktikum IPA",
    subject: "Sains",
    class: "3A",
    teacher: "Della Dunn",
    dueDate: "2025-10-28",
  },
  {
    id: "5",
    title: "Kliping IPS",
    subject: "Social Studies",
    class: "1B",
    teacher: "Bruce Rodriguez",
    dueDate: "2025-10-26",
  },
];

// 3. Komponen kecil untuk Badge Tenggat Waktu
const DueDateBadge = ({ dateString }: { dateString: string }) => {
  const date = parseISO(dateString);
  let colors = "";
  let text = format(date, "dd MMM yyyy");

  if (isToday(date)) {
    colors = "bg-red-100 text-red-700";
    text = `Hari Ini (${text})`;
  } else if (isFuture(date)) {
    colors = "bg-blue-100 text-blue-700";
  } else {
    colors = "bg-gray-100 text-gray-700";
    text = `Terlewat (${text})`;
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${colors}`}>
      <FiClock className="w-4 h-4" />
      {text}
    </span>
  );
};

// 4. Komponen Utama Halaman
export default function AssignmentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");

  const filteredAssignments = dummyAssignments.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterKelas === "Semua Kelas" || item.class === filterKelas)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Daftar Tugas</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
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
            {/* Anda bisa tambahkan filter mapel di sini jika perlu */}
          </div>

          {/* Search & Tombol Aksi */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari judul tugas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Kuning (sesuai desain Anda) */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500">
              <FiPlus className="w-4 h-4" />
              <span>Buat Tugas</span>
            </button>
          </div>
        </div>
        
        {/* Tabel Konten */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul Tugas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guru</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenggat Waktu</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAssignments.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.subject}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.teacher}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <DueDateBadge dateString={item.dueDate} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-3">
                      <Link 
                        href={`/dashboard/assignments/${item.id}`}
                        className="text-blue-600 hover:text-blue-900" 
                        title="Lihat Detail"
                      >
                        <FiEye className="w-5 h-5" />
                      </Link>
                      <button className="text-gray-500 hover:text-gray-800" title="Edit">
                        <FiEdit className="w-5 h-5" />
                      </button>
                      <button className="text-red-600 hover:text-red-900" title="Hapus">
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAssignments.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada tugas yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}