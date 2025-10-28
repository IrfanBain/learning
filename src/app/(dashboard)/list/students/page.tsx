"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link'; // Pastikan Link di-import
import Image from 'next/image';
import { db } from '@/lib/firebaseConfig'; 
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'; // Impor tipe Firestore
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/authContext';

import { 
  FiSearch, 
  FiPlus, 
  FiChevronDown, 
  FiEye,
  FiEdit,
  FiTrash2,
  FiFilter
} from 'react-icons/fi';

// 1. Impor Action
import { deleteStudentAction } from '@/app/actions/studentActions';

// 2. Tipe Data (Sama seperti sebelumnya)
interface StudentData {
  id: string;
  nama_lengkap: string;
  nisn: string;
  nis: string | null;
  kelas: string | null; 
  email: string | null;
  nomor_hp: string | null;
  foto_profil: string | null;
  status_siswa: string;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: any; 
  agama: string | null;
  kewarganegaraan: string | null;
  asal_sekolah: string | null;
  alamat: { [key: string]: string | null };
  orang_tua: { 
    [key: string]: any;
    alamat: string | null;
    ayah: { [key: string]: string | null };
    ibu: { [key: string]: string | null };
  };
}

// 3. Komponen Utama Halaman
export default function ManageStudentsPage() {
  const { user: currentUser } = useAuth(); 

  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State Filter (Sama)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");

  // Fungsi Fetching Data (Sama)
  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const studentsCollection = collection(db, "students");
      const q = query(studentsCollection, orderBy("nama_lengkap", "asc")); 
      
      const querySnapshot = await getDocs(q);
      
      const studentsList = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...doc.data()
      } as StudentData));

      setAllStudents(studentsList);
    } catch (err: any) {
      console.error("Error fetching students: ", err);
      if (err.message && err.message.includes("permission")) {
        setError("Gagal mengambil data siswa: Missing or insufficient permissions.");
      } else {
        setError("Gagal mengambil data siswa. Pastikan koleksi 'students' ada.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []); 

  // --- Logika Filter (Sama) ---
  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(allStudents.map(s => s.kelas).filter(Boolean)))
            .sort() as string[];
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    return allStudents.filter(item =>
      (item.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
       item.nisn.includes(searchQuery) ||
       (item.kelas && item.kelas.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (filterKelas === "Semua Kelas" || item.kelas === filterKelas)
    );
  }, [allStudents, searchQuery, filterKelas]);

  // --- Handler CRUD (Hanya Delete) ---
  const handleDeleteStudent = (studentId: string, studentName: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <span>Anda yakin ingin menghapus <strong className="text-red-600">{studentName}</strong>?</span>
        <div className="flex gap-3 justify-end">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 bg-gray-200 rounded-md text-sm">Batal</button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              performDelete(studentId, studentName); 
            }}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm">Ya, Hapus
          </button>
        </div>
      </div>
    ), { duration: 6000, position: 'top-center' });
  };
  
  const performDelete = async (studentId: string, studentName: string) => {
    const promise = deleteStudentAction(studentId);
    toast.promise(promise, {
      loading: `Menghapus ${studentName}...`,
      success: (result) => {
        if (result.success) {
          fetchStudents(); // REFRESH
          return result.message;
        } else {
          throw new Error(result.message);
        }
      },
      error: (err) => `Gagal menghapus: ${err.message}`,
    });
  };

  // --- Mulai JSX ---
  return (
    <div className="p-4 md:p-8 relative"> 
      <h2 className="text-2xl font-semibold mb-5">Semua Murid</h2>

      {error && (
        <div className="p-4 mb-4 bg-yellow-100 text-yellow-800 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        
        {/* Header Kartu: Filter, Search, dan Aksi */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-gray-200 gap-4">
          
          {/* Filter Dropdown (Sama) */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <select 
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="appearance-none w-full bg-gray-100 border-none rounded-lg py-2 px-4 pr-8 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Semua Kelas">Semua Kelas</option>
                {uniqueClasses.map((kelas) => (
                  <option key={kelas} value={kelas}>{kelas}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Search & Tombol Aksi (Sama) */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Cari nama/NISN/kelas..."
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Tombol Tambah Siswa (DIUBAH JADI LINK) */}
            {currentUser?.role === 'admin' && (
              <Link 
              href="/list/students/create" // <-- ROUTE BARU
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <FiPlus className="w-4 h-4" />
            </Link>
            )}
          </div>
        </div>
        
        {/* Tabel Konten (Sama) */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Info</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NISN</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis Kelamin</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  
                  {/* Kolom Info (Sama) */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <Image
                          className="h-10 w-10 rounded-full object-cover"
                          src={item.foto_profil || '/placeholder-avatar.png'} 
                          alt={item.nama_lengkap}
                          width={40}
                          height={40}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{item.nama_lengkap}</div>
                        <div className="text-sm text-gray-500">{item.email || '-'}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.nisn}</td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.kelas || '-'}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.jenis_kelamin || '-'}</td>
                  
                  {/* Kolom Aksi (Tombol Edit DIUBAH JADI LINK) */}
                  <td className="px-6 py-4 whitespace-nowGrap text-sm font-medium">
                    <div className="flex gap-3">
                      <Link 
                        href={currentUser?.role ? `/list/students/${item.id}` : `/students/${item.id}`} 
                        className="text-blue-500 hover:text-blue-700 p-2 bg-blue-50 rounded-lg" 
                        title="Lihat Detail"
                      >
                        <FiEye className="w-5 h-5" />
                      </Link>

                      {currentUser?.role === 'admin' && (
                        <Link 
                        href={`/list/students/edit/${item.id}`} // <-- ROUTE EDIT BARU
                        className="text-purple-500 hover:text-purple-700 p-2 bg-purple-50 rounded-lg" 
                        title="Edit"
                      >
                        <FiEdit className="w-5 h-5" />
                      </Link>
                      )}
                      
                      {currentUser?.role === 'admin' && (
                        <button 
                        onClick={() => handleDeleteStudent(item.id, item.nama_lengkap)} 
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

          {!loading && filteredStudents.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              Tidak ada murid yang ditemukan.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
