"use client";

import React, { useState } from 'react';
// Ikon yang relevan
import { 
  FiSearch, 
  FiChevronDown, 
  FiCalendar, 
  FiEdit,
  FiPrinter
} from 'react-icons/fi';

// 1. Definisikan tipe data untuk Absensi
type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';

interface AttendanceRecord {
  id: string;
  student: {
    name: string;
    nisn: string;
  };
  status: AttendanceStatus;
  keterangan: string; // Misal: "Surat dokter", "Acara keluarga"
}

// 2. Data dummy untuk ditampilkan
const dummyAttendance: AttendanceRecord[] = [
  {
    id: "1",
    student: { name: "Budi Santoso", nisn: "0012345678" },
    status: "Hadir",
    keterangan: "-",
  },
  {
    id: "2",
    student: { name: "Siti Aminah", nisn: "0012345679" },
    status: "Hadir",
    keterangan: "-",
  },
  {
    id: "3",
    student: { name: "Agus Wijaya", nisn: "0012345680" },
    status: "Sakit",
    keterangan: "Surat Keterangan Dokter",
  },
  {
    id: "4",
    student: { name: "Dewi Lestari", nisn: "0012345681" },
    status: "Izin",
    keterangan: "Acara keluarga",
  },
  {
    id: "5",
    student: { name: "Rina Hartati", nisn: "0012345682" },
    status: "Hadir",
    keterangan: "-",
  },
  {
    id: "6",
    student: { name: "Anita Sari", nisn: "0012345683" },
    status: "Alfa",
    keterangan: "Tanpa keterangan",
  },
];

// 3. Komponen kecil untuk Badge Status
const StatusBadge = ({ status }: { status: AttendanceStatus }) => {
  let bgColor = "";
  let textColor = "";

  switch (status) {
    case 'Hadir':
      bgColor = "bg-green-100";
      textColor = "text-green-700";
      break;
    case 'Sakit':
      bgColor = "bg-blue-100";
      textColor = "text-blue-700";
      break;
    case 'Izin':
      bgColor = "bg-yellow-100";
      textColor = "text-yellow-700";
      break;
    case 'Alfa':
      bgColor = "bg-red-100";
      textColor = "text-red-700";
      break;
    default:
      bgColor = "bg-gray-100";
      textColor = "text-gray-700";
  }

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${bgColor} ${textColor}`}>
      {status}
    </span>
  );
};

// 4. Komponen Utama Halaman
export default function AbsensiPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState("IX A"); // Default ke satu kelas
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]); // Default hari ini

  // Nanti Anda bisa filter data asli berdasarkan state di atas
  const filteredAttendance = dummyAttendance.filter(item =>
    item.student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Rekap Absensi Siswa</h2>

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter Tanggal, Kelas, dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown */}
          <div className="flex gap-2">
            {/* Filter Tanggal */}
            <div className="relative">
              <input
                type="date"
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            {/* Filter Kelas */}
            <div className="relative">
              <select 
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="appearance-none w-full md:w-auto bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>IX A</option>
                <option>IX B</option>
                <option>VIII A</option>
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
                placeholder="Cari nama siswa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Cetak (Abu-abu, sesuai desain) */}
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              <FiPrinter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Tabel Konten (Daftar Siswa) */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Siswa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttendance.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Style 2 baris seperti halaman Guru */}
                    <div className="text-sm font-medium text-gray-900">{item.student.name}</div>
                    <div className="text-sm text-gray-500">{item.student.nisn}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Menggunakan Badge Status */}
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.keterangan}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900" title="Edit Status">
                      <FiEdit className="w-5 h-5" />
                    </button>
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