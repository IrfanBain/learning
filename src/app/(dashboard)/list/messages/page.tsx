"use client";

import React, { useState } from 'react';
import { 
  FiSearch, 
  FiEdit, 
  FiFilter,
  FiTrash2,
  FiArchive
} from 'react-icons/fi';
import Image from 'next/image';
import Link from 'next/link'; 

// --- UBAH: Import dari lib/data ---
import { dummyMessages } from '@/lib/data'; // Import data
import type { InboxMessage } from '@/lib/data'; // Import tipe (opsional tapi bagus)

export default function MessagesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  // const [messages, setMessages] = useState(dummyMessages); // Tidak perlu state jika data statis

  // Langsung filter dari data yang diimpor
  const filteredMessages = dummyMessages.filter(msg =>
    msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Kotak Masuk</h2>

      {/* Kartu Putih Utama */}
      <div className="bg-white rounded-lg shadow-md">

        {/* Header Kartu: Tombol Tulis, Search, Filter (Tidak Berubah) */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-full md:w-auto">
            <FiEdit className="w-4 h-4" />
            <span>Tulis Pesan Baru</span>
          </button>
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari pesan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <FiFilter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Tabel Daftar Pesan (Tidak Berubah) */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Pengirim</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjek</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right w-40">Tanggal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMessages.map((msg) => (
                <tr 
                  key={msg.id} 
                  className={`${!msg.isRead ? 'bg-blue-50 font-bold' : 'bg-white hover:bg-gray-50'}`}
                >
                  {/* Kolom Checkbox & Avatar */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <Image
                        src={msg.sender.avatar} // Gunakan avatar dari data
                        alt={msg.sender.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    </div>
                  </td>
                  
                  {/* Kolom Pengirim */}
                  <td className="px-4 py-4 whitespace-nowrap w-48">
                     <Link href={`/list/messages/${msg.id}`} passHref className="cursor-pointer">
                      <span className={!msg.isRead ? 'text-blue-800' : 'text-gray-900'}>
                        {msg.sender.name}
                      </span>
                    </Link>
                  </td>

                  {/* Kolom Subjek & Cuplikan */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Link href={`/list/messages/${msg.id}`} passHref className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className={!msg.isRead ? 'text-gray-900' : 'text-gray-700'}>
                          {msg.subject}
                        </span>
                        <span className="text-gray-500 font-normal truncate">
                          - {msg.snippet}
                        </span>
                      </div>
                    </Link>
                  </td>
                  
                  {/* Kolom Tanggal & Aksi */}
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className={`text-sm ${!msg.isRead ? 'text-blue-700' : 'text-gray-500'}`}>
                        {msg.timestamp}
                      </span>
                      <button className="text-gray-400 hover:text-red-600" title="Hapus">
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredMessages.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada pesan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}