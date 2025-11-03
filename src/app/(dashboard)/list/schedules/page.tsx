"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot, DocumentReference, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/authContext';

import {
  FiSearch, FiPlus, FiChevronDown, FiEdit, FiTrash2, FiClock, FiBookOpen, FiUsers, FiUserCheck, FiArrowLeft // Tambah ikon
} from 'react-icons/fi';

// Impor Action Delete & ActionResult
import { deleteScheduleAction, ActionResult } from '@/app/actions/schedulesActions'; // Pastikan path benar

// Interface ScheduleData (tidak berubah)
interface ScheduleData {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  kelas_ref: DocumentReference | null;
  mapel_ref: DocumentReference | null;
  guru_ref: DocumentReference | null;
  tahun_ajaran: string;
  jumlah_jam_pelajaran: number;
  ruangan: string | null;
}

// Interface RelatedData (tidak berubah)
interface RelatedData {
    [key: string]: { nama?: string | null } | undefined;
}

// Urutan hari (tidak berubah)
const HARI_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Komponen Utama Halaman
export default function ManageSchedulesPage() {
  const { user } = useAuth();
  const [allSchedules, setAllSchedules] = useState<ScheduleData[]>([]);
  const [relatedData, setRelatedData] = useState<RelatedData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterHari, setFilterHari] = useState("Semua Hari");

  // --- Fungsi Fetching Utama ---
  const fetchData = async () => {
    setLoading(true); setError(null); setRelatedData({}); // Reset data terkait
    let fetchedSchedules: ScheduleData[] = []; // Tampung jadwal
    try {
      // 1. Fetch Jadwal Utama
      const schedulesCollection = collection(db, "schedules");
      // Urutkan berdasarkan jam mulai (pengurutan hari dilakukan setelah fetch)
      const q = query(schedulesCollection, orderBy("jam_mulai", "asc"));
      const querySnapshot = await getDocs(q);

      fetchedSchedules = querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ScheduleData));

      // Urutkan berdasarkan HARI_ORDER secara manual
      fetchedSchedules.sort((a, b) => {
          const dayA = HARI_ORDER.indexOf(a.hari);
          const dayB = HARI_ORDER.indexOf(b.hari);
          if (dayA === dayB) {
              return a.jam_mulai.localeCompare(b.jam_mulai); // Urutkan jam jika hari sama
          }
          // Handle jika hari tidak ditemukan di HARI_ORDER (kemungkinan kecil)
          if (dayA === -1) return 1;
          if (dayB === -1) return -1;
          return dayA - dayB; // Urutkan hari
      });

      setAllSchedules(fetchedSchedules);

      // 2. Fetch Data Terkait (Kelas, Mapel, Guru)
      if (fetchedSchedules.length > 0) {
          await fetchRelatedNames(fetchedSchedules); // Tunggu fetch nama selesai
      } else {
          setLoading(false); // Selesai loading jika tidak ada jadwal
      }

    } catch (err: any) {
      console.error("Error fetching schedules: ", err);
      setError("Gagal mengambil data jadwal. Pastikan koleksi 'schedules' ada dan Anda memiliki izin.");
      setLoading(false); // Selesai loading jika error
    }
  };

  // --- Fungsi untuk Fetch Nama Kelas, Mapel, Guru ---
  const fetchRelatedNames = async (schedules: ScheduleData[]) => {
      const refsToFetch = new Map<string, DocumentReference>(); // Gunakan Map untuk hindari duplikat

      // Kumpulkan semua referensi unik yang perlu di-fetch namanya
      schedules.forEach(sch => {
          // Hanya tambahkan jika ref ada dan belum ada di relatedData
          if (sch.kelas_ref && !relatedData[sch.kelas_ref.id]) refsToFetch.set(sch.kelas_ref.id, sch.kelas_ref);
          if (sch.mapel_ref && !relatedData[sch.mapel_ref.id]) refsToFetch.set(sch.mapel_ref.id, sch.mapel_ref);
          if (sch.guru_ref && !relatedData[sch.guru_ref.id]) refsToFetch.set(sch.guru_ref.id, sch.guru_ref);
      });


      if (refsToFetch.size === 0) {
           setLoading(false); // Selesai jika tidak ada data baru yg perlu di-fetch
           return;
      }

      const newRelatedData: RelatedData = {};
      // Buat array promise untuk fetch semua data secara paralel
      const fetchPromises = Array.from(refsToFetch.values()).map(async (ref) => {
          try {
              const docSnap = await getDoc(ref);
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  let name: string | null = null;
                  // Tentukan field nama berdasarkan path koleksi
                  if (ref.path.startsWith('classes/')) name = data.nama_kelas;
                  else if (ref.path.startsWith('subjects/')) name = data.nama_mapel;
                  else if (ref.path.startsWith('teachers/')) name = data.nama_lengkap;
                  // Simpan nama ke map sementara
                  newRelatedData[ref.id] = { nama: name || docSnap.id }; // Fallback ke ID jika nama kosong
              } else {
                  newRelatedData[ref.id] = { nama: 'Data Tidak Ditemukan' };
              }
          } catch (fetchErr) {
              console.error(`Error fetching related data for ${ref.path}:`, fetchErr);
              newRelatedData[ref.id] = { nama: 'Gagal Memuat' };
          }
      });

      try {
          await Promise.all(fetchPromises); // Tunggu semua fetch data nama selesai
          // Gabungkan data baru dengan data lama (jika ada)
          setRelatedData(prevData => ({ ...prevData, ...newRelatedData }));
      } catch (error) {
           console.error("Error during Promise.all for related data:", error);
           // Setidaknya tampilkan data yang berhasil di-fetch jika sebagian gagal
           setRelatedData(prevData => ({ ...prevData, ...newRelatedData }));
      } finally {
          setLoading(false); // Selesai loading total di sini
      }
  };


  // Panggil fetch data saat komponen pertama kali dimuat
  useEffect(() => {
    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya fetch sekali saat mount

  // --- Logika Filter & Grouping (Tidak Berubah) ---
  const filteredAndGroupedSchedules = useMemo(() => {
    const filtered = allSchedules.filter(item =>
      (filterHari === "Semua Hari" || item.hari === filterHari)
    );
    const grouped: { [key: string]: ScheduleData[] } = {};
    filtered.forEach(item => {
        if (!grouped[item.hari]) grouped[item.hari] = [];
        grouped[item.hari].push(item);
    });
    return Object.entries(grouped).sort(([dayA], [dayB]) => HARI_ORDER.indexOf(dayA) - HARI_ORDER.indexOf(dayB));
  }, [allSchedules, filterHari]);

  // --- Handler Delete (Lengkap) ---
  const handleDeleteSchedule = (scheduleId: string, scheduleInfo: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <span>Anda yakin ingin menghapus jadwal <strong className="text-red-600">{scheduleInfo}</strong>?</span>
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300 transition-colors">Batal</button>
          <button
            onClick={() => { toast.dismiss(t.id); performDelete(scheduleId, scheduleInfo); }}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors">Ya, Hapus</button>
        </div>
      </div>
    ), { duration: 8000, position: 'top-center' });
  };

  const performDelete = async (scheduleId: string, scheduleInfo: string) => {
    const promise = deleteScheduleAction(scheduleId);
    toast.promise(promise, {
      loading: `Menghapus jadwal ${scheduleInfo}...`,
      success: (result: ActionResult) => {
        if (result.success) {
            fetchData(); // Panggil refetch setelah delete
            return result.message;
         }
        else { throw new Error(result.message); }
      },
      error: (err) => `Gagal menghapus: ${err.message}`,
    });
  };
  // --- Akhir Handler Delete ---


  // --- Render JSX (Tampilan Baru) ---
  return (
    <div className="p-4 md:p-8 space-y-6"> {/* Tambah space-y */}
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">Manajemen Jadwal Pelajaran</h2>
        {/* Tombol Tambah (Hanya Admin) */}
        {user?.role === 'admin' && (
              <Link href="/list/schedules/create"
                    className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm transition-colors shadow hover:shadow-md"
                    title="Tambah Jadwal Baru">
                <FiPlus className="w-4 h-4" /> <span>Tambah Jadwal</span>
              </Link>
          )}
      </div>

       {/* Kontrol Filter */}
      <div className="p-4 bg-white rounded-lg shadow border border-gray-100 flex items-center gap-4">
          <label htmlFor="filterHari" className="text-sm font-medium text-gray-600 flex-shrink-0">Tampilkan Hari:</label>
          <div className="relative flex-grow sm:flex-grow-0"> {/* Batasi lebar filter */}
             <select id="filterHari" value={filterHari} onChange={(e) => setFilterHari(e.target.value)}
                     className="appearance-none w-full bg-gray-50 border border-gray-200 rounded-md py-2 pl-4 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
               <option value="Semua Hari">Semua Hari</option>
               {HARI_ORDER.map(hari => (<option key={hari} value={hari}>{hari}</option>))}
             </select>
            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
      </div>


      {/* Tampilan Loading / Error / No Data */}
      {loading && <div className="p-10 text-center text-gray-500 italic bg-white rounded-lg shadow border border-gray-100">Memuat jadwal...</div>}
      {error && !loading && ( <div className="p-6 text-center text-red-700 bg-red-50 rounded-lg shadow border border-red-100">{error}</div> )}
      {!loading && allSchedules.length === 0 && !error && (
         <div className="p-10 text-center text-gray-500 bg-white rounded-lg shadow border border-gray-100">
             Belum ada data jadwal pelajaran.
             {user?.role === 'admin' && ( <Link href="/list/schedules/create" className="text-blue-600 hover:underline block mt-2 text-sm">+ Tambah Jadwal Baru</Link> )}
         </div>
      )}
       {!loading && allSchedules.length > 0 && filteredAndGroupedSchedules.length === 0 && !error && (
         <div className="p-10 text-center text-gray-500 bg-white rounded-lg shadow border border-gray-100">
             Tidak ada jadwal ditemukan untuk hari <span className='font-semibold'>{filterHari}</span>.
         </div>
      )}

      {/* Daftar Jadwal per Hari (Tampilan Kartu) */}
      {!loading && filteredAndGroupedSchedules.length > 0 && (
        <div className="space-y-6">
          {filteredAndGroupedSchedules.map(([hari, schedulesForDay]) => (
            // --- Kartu untuk Setiap Hari ---
            <div key={hari} className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
              {/* Header Hari */}
              <h3 className="text-xl font-bold p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 text-gray-700">{hari}</h3>
              {/* Konten Jadwal (List) */}
              <ul className="divide-y divide-gray-100">
                    {schedulesForDay.map((item) => {
                       // Ambil nama dari relatedData
                       const className = relatedData[item.kelas_ref?.id || '']?.nama;
                       const subjectName = relatedData[item.mapel_ref?.id || '']?.nama;
                       const teacherName = relatedData[item.guru_ref?.id || '']?.nama;
                       // Info untuk konfirmasi delete
                       const scheduleInfo = `${subjectName || '?'} - ${className || '?'} (${item.jam_mulai})`;

                       return (
                         // --- Item Jadwal (List Item) ---
                         <li key={item.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-blue-50/50 transition-colors">
                            {/* Kiri: Jam & Detail Pelajaran */}
                            <div className='flex-grow space-y-1.5'> {/* Sedikit tambah spasi */}
                               {/* Jam */}
                               <div className="flex items-center gap-2 font-semibold text-gray-800">
                                   <FiClock className="w-4 h-4 text-blue-600 flex-shrink-0"/>
                                   <span>{item.jam_mulai} - {item.jam_selesai}</span>
                                   <span className='ml-2 text-xs font-normal text-gray-500'>({item.jumlah_jam_pelajaran} JP)</span>
                               </div>
                               {/* Mapel */}
                               <div className="flex items-center gap-2 text-sm text-gray-700 pl-6">
                                   <FiBookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0"/>
                                   <span className='font-medium'>{subjectName || (item.mapel_ref ? 'Memuat...' : '-')}</span>
                               </div>
                               {/* Kelas & Ruangan */}
                               <div className="flex items-center gap-2 text-sm text-gray-600 pl-6">
                                   <FiUsers className="w-4 h-4 text-teal-500 flex-shrink-0"/>
                                   <span>{className || (item.kelas_ref ? 'Memuat...' : '-')}</span>
                                   {item.ruangan && <span className='ml-2 text-xs text-gray-400'>({item.ruangan})</span>}
                               </div>
                               {/* Guru */}
                               <div className="flex items-center gap-2 text-sm text-gray-600 pl-6">
                                   <FiUserCheck className="w-4 h-4 text-orange-500 flex-shrink-0"/>
                                   <span>{teacherName || (item.guru_ref ? 'Memuat...' : '-')}</span>
                               </div>
                            </div>
                             {/* Kanan: Tombol Aksi */}
                            <div className="flex-shrink-0 flex gap-2 self-end sm:self-center mt-2 sm:mt-0"> {/* Atur posisi tombol */}
                               {user?.role === 'admin' && (
                                 <Link href={`/list/schedules/${item.id}/edit`} // Sesuaikan path
                                       className="text-purple-600 hover:text-white hover:bg-purple-600 p-2 bg-purple-50 rounded-md transition-all duration-200 shadow-sm hover:shadow-md" title="Edit">
                                   <FiEdit className="w-4 h-4" />
                                 </Link>
                               )}
                               {user?.role === 'admin' && (
                                 <button onClick={() => handleDeleteSchedule(item.id, scheduleInfo)}
                                         className="text-red-600 hover:text-white hover:bg-red-600 p-2 bg-red-50 rounded-md transition-all duration-200 shadow-sm hover:shadow-md" title="Hapus">
                                   <FiTrash2 className="w-4 h-4" />
                                 </button>
                               )}
                            </div>
                         </li>
                         // --- Akhir Item Jadwal ---
                       );
                    })}
                  </ul>
            </div>
             // --- Akhir Kartu Hari ---
          ))}
        </div>
      )}
    </div>
  );
}

// --- Komponen Helper (Input & Select) - LENGKAP ---
type InputProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; type?: string; required?: boolean; readOnly?: boolean; placeholder?: string; min?: string | number; max?: string | number; pattern?: string; };
const Input = ({ label, name, value, onChange, type = 'text', required = false, readOnly = false, placeholder = '', min, max, pattern }: InputProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
    <input type={type} id={name} name={name} value={value ?? ''} onChange={onChange} required={required} readOnly={readOnly} placeholder={placeholder} min={min} max={max} pattern={pattern}
           className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} ${type === 'time' ? 'leading-snug' : ''}`} />
  </div>
);

type SelectProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean; };
const Select = ({ label, name, value, onChange, options, required = false, disabled = false }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
    <select id={name} name={name} value={value ?? ''} onChange={onChange} required={required} disabled={disabled}
            className={`block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
      {/* Tampilkan placeholder "-- Pilih --" jika tidak required ATAU jika disabled ATAU jika opsi pertama bukan value kosong */}
      {(!required || disabled || options.length === 0 || options[0]?.value !== '') && <option value="" disabled={required}> -- Pilih -- </option>}
      {options.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))}
    </select>
  </div>
);
// --- AKHIR KOMPONEN HELPER ---

