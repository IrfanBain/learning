"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/authContext'; 

import {
  FiSearch,
  FiPlus,
  FiChevronDown,
  FiEye,
  FiEdit,
  FiTrash2,
} from 'react-icons/fi';

// --- PERBAIKAN 1: Impor dari file yang benar ---
import { deleteTeacherAction, ActionResult } from  '@/app/actions/teacherActions'
import { BiCurrentLocation } from 'react-icons/bi';

// Tipe Data Guru (dari Firestore)
interface TeacherData {
  id: string;
  nama_lengkap: string;
  nip_nuptk: string;
  email: string | null;
  nomor_hp: string | null;
  foto_profil: string | null;
  status_kepegawaian: string | null;
  mata_pelajaran_diampu: string[];
  alamat: {
      jalan?: string | null;
      kelurahan_desa?: string | null;
      kecamatan?: string | null;
      kota_kabupaten?: string | null;
      provinsi?: string | null;
  } | null;
}

// Komponen Utama Halaman
export default function ManageTeachersPage() {
  const [allTeachers, setAllTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua Status");

  const fetchTeachers = async () => {
    try {
      setLoading(true); setError(null);
      const teachersCollection = collection(db, "teachers");
      const q = query(teachersCollection, orderBy("nama_lengkap", "asc"));
      const querySnapshot = await getDocs(q);
      const teachersList = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id, ...doc.data()
      } as TeacherData));
      setAllTeachers(teachersList);
    } catch (err: any) {
      console.error("Error fetching teachers: ", err);
      setError("Gagal mengambil data guru. Pastikan koleksi 'teachers' ada dan Anda memiliki izin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(allTeachers.map(t => t.status_kepegawaian).filter(Boolean)))
           .sort() as string[];
  }, [allTeachers]);

  const filteredTeachers = useMemo(() => {
    return allTeachers.filter(item =>
      (item.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
       item.nip_nuptk.includes(searchQuery) ||
       (item.email && item.email.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (filterStatus === "Semua Status" || item.status_kepegawaian === filterStatus)
    );
  }, [allTeachers, searchQuery, filterStatus]);

  const handleDeleteTeacher = (teacherId: string, teacherName: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <span>Anda yakin ingin menghapus <strong className="text-red-600">{teacherName}</strong>?</span>
        <div className="flex gap-3 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 bg-gray-200 rounded-md text-sm">Batal</button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              performDelete(teacherId, teacherName);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm">Ya, Hapus
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };

  const performDelete = async (teacherId: string, teacherName: string) => {
    const promise = deleteTeacherAction(teacherId);
    toast.promise(promise, {
      loading: `Menghapus ${teacherName}...`,
      // --- PERBAIKAN 2: Tambahkan tipe ActionResult ---
      success: (result: ActionResult) => {
        if (result.success) {
          fetchTeachers();
          return result.message;
        } else {
          // Kita bisa lempar error lagi agar toast.promise menanganinya
          throw new Error(result.message);
        }
      },
      error: (err) => `Gagal menghapus: ${err.message}`, // err di sini sudah bertipe Error
    });
  };

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-semibold mb-5">Manajemen Guru</h2>

      {error && (
        <div className="p-4 mb-4 bg-yellow-100 text-yellow-800 rounded-md">
          {error}
        </div>
      )}

      {/* Kartu Tabel */}
      <div className="bg-white rounded-lg shadow-md">

        {/* Header Kartu */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">

          {/* Filter Dropdown */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none w-full bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
              >
                <option value="Semua Status">Semua Status</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status} className="capitalize">{status || 'Tidak Ada Status'}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search & Tombol Tambah */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari nama/NIP/email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {currentUser?.role === 'admin' &&(
            <Link
              href="/list/teachers/create"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              title="Tambah Guru Baru"
            >
              <FiPlus className="w-4 h-4" />
            </Link>
            )}

          </div>
        </div>

        {/* Tabel Konten */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Info Guru</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIP / NUPTK</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mapel Diampu</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (
                 <tr><td colSpan={5} className="p-10 text-center text-gray-500">Memuat data guru...</td></tr>
              )}
              {!loading && filteredTeachers.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">

                  {/* Kolom Info */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <Image
                          className="h-10 w-10 rounded-full object-cover"
                          src={item.foto_profil || '/placeholder-avatar.png'}
                          alt={item.nama_lengkap}
                          width={40} height={40}
                           onError={(e) => { e.currentTarget.src = '/placeholder-avatar.png'; }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{item.nama_lengkap}</div>
                        <div className="text-sm text-gray-500">{item.email || '-'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Kolom NIP/NUPTK */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.nip_nuptk}</td>

                  {/* Kolom Mapel */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(item.mata_pelajaran_diampu && item.mata_pelajaran_diampu.length > 0)
                      ? item.mata_pelajaran_diampu.slice(0, 2).join(', ') + (item.mata_pelajaran_diampu.length > 2 ? '...' : '')
                      : '-'}
                  </td>

                  {/* Kolom Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                        item.status_kepegawaian === 'pns' ? 'bg-green-100 text-green-800' :
                        item.status_kepegawaian === 'pppk' ? 'bg-blue-100 text-blue-800' :
                        item.status_kepegawaian === 'honor' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                      {item.status_kepegawaian || 'Tidak Ada'}
                    </span>
                  </td>

                  {/* Kolom Aksi */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-3">
                       <Link
                        href={currentUser?.role ? `/list/teachers/${item.id}` : `/list/teachers/${item.id}`} 
                        className="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 rounded-lg"
                        title="Lihat Detail"
                      >
                        <FiEye className="w-5 h-5" />
                      </Link>
                      {currentUser?.role === 'admin' && (
                         <Link
                        href= {`/list/teachers/edit/${item.id}`}
                        className="text-purple-500 hover:text-purple-700 p-2 bg-purple-50 rounded-lg"
                        title="Edit"
                      >
                        <FiEdit className="w-5 h-5" />
                      </Link>
                      )}
                     

                      {currentUser?.role === 'admin' && (
                        <button
                        onClick={() => handleDeleteTeacher(item.id, item.nama_lengkap)}
                        className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg"
                        title="Hapus"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                      )}
                      
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pesan jika tidak ada data */}
          {!loading && filteredTeachers.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada guru yang ditemukan dengan filter saat ini.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

