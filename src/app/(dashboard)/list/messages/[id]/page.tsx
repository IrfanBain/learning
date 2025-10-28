"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation'; // Hook untuk mengambil ID dari URL
import Link from 'next/link';
import Image from 'next/image';
import { 
  FiArrowLeft, 
  FiTrash2, 
  FiArchive, 
  FiCornerUpLeft // Ikon Balas
} from 'react-icons/fi';

// 1. Definisikan tipe data, tambahkan 'body' untuk isi pesan lengkap
interface InboxMessage {
  id: string;
  sender: {
    name: string;
    avatar: string;
  };
  subject: string;
  snippet: string; // Cuplikan
  body: string; // Isi pesan lengkap
  timestamp: string;
  isRead: boolean;
}

// 2. Data dummy (HARUS SAMA DENGAN DI HALAMAN DAFTAR)
// Saya tambahkan properti 'body'
const dummyMessages: InboxMessage[] = [
  {
    id: "1",
    sender: { name: "Siti Aminah (Wali Kelas)", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3" },
    subject: "Peringatan Absensi",
    snippet: "Selamat pagi, Budi. Saya lihat absensi kamu...",
    body: "Selamat pagi, Budi. \n\nSaya lihat absensi kamu kemarin (Selasa, 21 Okt) Alfa, ada apa ya? Mohon segera konfirmasi ke saya atau bagian tata usaha agar bisa segera ditindaklanjuti.\n\nTerima kasih,\nSiti Aminah, S.Pd.",
    timestamp: "10:30 AM",
    isRead: false,
  },
  {
    id: "2",
    sender: { name: "Admin Sistem", avatar: "/logo.png" },
    subject: "Pembaruan Sistem E-Learning",
    snippet: "Pembaruan sistem akan dilaksanakan pada...",
    body: "Pembaruan sistem akan dilaksanakan pada hari Sabtu pukul 10.00. Sistem mungkin akan nonaktif selama 30 menit. Mohon maaf atas ketidaknyamanannya.",
    timestamp: "Kemarin",
    isRead: true, 
  },
  // ... (Tambahkan 'body' untuk 8 pesan lainnya) ...
  {
    id: "3",
    sender: { name: "Agus Wijaya (Guru Fisika)", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3" },
    subject: "Tugas Susulan Bab 3",
    snippet: "Bagi yang belum mengumpulkan tugas Bab 3...",
    body: "Bagi yang belum mengumpulkan tugas Bab 3, harap segera dikumpulkan di meja saya paling lambat hari Jumat. Terima kasih.",
    timestamp: "20 Okt 2025",
    isRead: true,
  },
  // ... (silakan tambahkan 'body' untuk sisa datanya)
];


// 3. Komponen Utama Halaman
export default function MessageDetailPage() {
  const params = useParams(); // Hook untuk mendapatkan parameter URL
  const messageId = params.id as string; // Ambil 'id' dari URL

  const [message, setMessage] = useState<InboxMessage | null>(null);

  // 4. "Fetch" data berdasarkan ID saat komponen dimuat
  useEffect(() => {
    if (messageId) {
      // Ini adalah simulasi fetch data.
      // Nanti Anda akan ganti ini dengan fetch API ke database
      const foundMessage = dummyMessages.find(msg => msg.id === messageId);
      setMessage(foundMessage || null);
    }
  }, [messageId]); // Jalankan efek ini setiap kali 'messageId' berubah

  // Tampilan Loading atau jika pesan tidak ditemukan
  if (!message) {
    return (
      <div className="p-8 text-center">
        <p>Mencari pesan...</p>
        <Link href="/dashboard/messages" className="text-blue-600 hover:underline">
          Kembali ke Kotak Masuk
        </Link>
      </div>
    );
  }

  // 5. Tampilan Detail Pesan
  return (
    <div className="p-4 md:p-8">
      
      {/* Tombol Kembali */}
      <Link 
        href="/list/messages"
        className="flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-4"
      >
        <FiArrowLeft />
        <span>Kembali ke Kotak Masuk</span>
      </Link>

      {/* Kartu Putih Utama */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        
        {/* Header: Subjek Pesan */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{message.subject}</h2>
        </div>

        {/* Sub-Header: Info Pengirim & Tanggal */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Image
              src="/setProfile.png"
              alt={message.sender.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold text-gray-800">{message.sender.name}</p>
              <p className="text-sm text-gray-500">Kepada: Saya (Budi Santoso)</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2 md:mt-0">{message.timestamp}</p>
        </div>
        
        {/* Toolbar Aksi (sesuai tema) */}
        <div className="p-4 flex gap-2 border-b border-gray-200 bg-gray-50">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <FiCornerUpLeft className="w-4 h-4" />
              <span>Balas</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <FiArchive className="w-4 h-4" />
              <span>Arsipkan</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
              <FiTrash2 className="w-4 h-4" />
              <span>Hapus</span>
            </button>
        </div>

        {/* Isi Pesan (Body) */}
        <div className="p-6 md:p-8">
          {/* 'whitespace-pre-line' penting agar karakter '\n' (baris baru) bisa dirender */}
          <div className="text-gray-800 leading-relaxed whitespace-pre-line">
            {message.body}
          </div>
        </div>

      </div>
    </div>
  );
}