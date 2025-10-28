"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiChevronDown, 
  FiEye, // Lihat
  FiPlayCircle, // Mulai
  FiCheckCircle, // Selesai
  FiClipboard // Ikon Latihan
} from 'react-icons/fi';
import Link from 'next/link';

// 1. Definisikan tipe data untuk Latihan
type ExerciseStatus = 'Selesai' | 'Belum Dikerjakan';

interface Exercise {
  id: string;
  title: string;
  subject: string;
  type: string; // Tipe soal (Pilihan Ganda, Esai)
  questionCount: number;
  status: ExerciseStatus;
}

// 2. Data dummy
const dummyExercises: Exercise[] = [
  {
    id: "1",
    title: "Kuis Aljabar Bab 3",
    subject: "Matematika",
    type: "Pilihan Ganda",
    questionCount: 10,
    status: "Selesai",
  },
  {
    id: "2",
    title: "Memahami Teks Naratif",
    subject: "Bahasa Inggris",
    type: "Esai Singkat",
    questionCount: 5,
    status: "Belum Dikerjakan",
  },
  {
    id: "3",
    title: "Latihan Gerak Lurus Beraturan",
    subject: "Fisika",
    type: "Isian Singkat",
    questionCount: 15,
    status: "Selesai",
  },
  {
    id: "4",
    title: "Kuis Kerajaan Hindu-Buddha",
    subject: "Sejarah",
    type: "Benar/Salah",
    questionCount: 20,
    status: "Belum Dikerjakan",
  },
];

// 3. Komponen kecil untuk Badge Status
const StatusBadge = ({ status }: { status: ExerciseStatus }) => {
  let colors = "";
  let icon = null;

  if (status === 'Selesai') {
    colors = "bg-green-100 text-green-700";
    icon = <FiCheckCircle className="w-4 h-4" />;
  } else {
    colors = "bg-gray-100 text-gray-700";
    icon = <FiClipboard className="w-4 h-4" />;
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full ${colors}`}>
      {icon}
      {status}
    </span>
  );
};

// 4. Komponen kecil untuk Tombol Aksi
const ActionButton = ({ status, id }: { status: ExerciseStatus, id: string }) => {
  if (status === 'Selesai') {
    return (
      <Link 
        href={`/dashboard/latihan/hasil/${id}`}
        className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 w-fit"
      >
        <FiEye className="w-4 h-4" />
        <span>Lihat Hasil</span>
      </Link>
    );
  } else {
    return (
      <Link 
        href={`/dashboard/latihan/kerjakan/${id}`}
        className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-fit"
      >
        <FiPlayCircle className="w-4 h-4" />
        <span>Mulai Kerjakan</span>
      </Link>
    );
  }
};

// 5. Komponen Utama Halaman
export default function LatihanPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMapel, setFilterMapel] = useState("Semua Mapel");
  const [filterStatus, setFilterStatus] = useState("Semua Status");

  const filteredExercises = dummyExercises.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterMapel === "Semua Mapel" || item.subject === filterMapel) &&
    (filterStatus === "Semua Status" || item.status === filterStatus)
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Daftar Latihan</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter dan Search */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
          <div className="flex gap-2">
            <div className="relative">
              <select 
                value={filterMapel}
                onChange={(e) => setFilterMapel(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Mapel</option>
                <option>Matematika</option>
                <option>Bahasa Inggris</option>
                <option>Fisika</option>
                <option>Sejarah</option>
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Status</option>
                <option>Selesai</option>
                <option>Belum Dikerjakan</option>
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari judul latihan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Tabel Konten */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latihan</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe Soal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Soal</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExercises.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.subject}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.questionCount} Soal</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButton status={item.status} id={item.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredExercises.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada latihan yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}