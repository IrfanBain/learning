"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { doc, getDoc, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { db } from '@/lib/firebaseConfig'; // Pastikan path benar
// Impor Action dan Interface Update
import { SubjectUpdateFormData, updateSubjectAction } from '@/app/actions/subjectActions'; // Pastikan path benar
import { ActionResult } from '@/app/actions/teacherActions'; // Impor Tipe Hasil
import { FiArrowLeft } from 'react-icons/fi';

// Opsi Tingkat (Sama seperti di Create Page)
const TINGKAT_OPTIONS = ["6", "7", "8", "9"]; // Pastikan ini string

// Interface Data Mapel dari Firestore (untuk fetch)
interface SubjectFetchData {
  nama_mapel: string;
  nama_pendek: string;
  kelompok: string | null;
  kkm: number | null;
  tingkat: string[]; // Array string
  urutan: number | null;
  deskripsi?: string | null; // Opsional
}

// State Awal Form (kosong, akan diisi)
// Tipe Omit<> karena 'id' ditangani terpisah, tetapi kita tambahkan nama_pendek sebagai optional di state lokal
const initialFormState: Omit<SubjectUpdateFormData, 'id'> & { nama_pendek?: string } = {
  nama_pendek: '', // Akan diisi tapi read-only
  nama_mapel: '',
  kelompok: '',
  kkm: 0, // Default 0
  urutan: 0, // Default 0
  tingkat: [],
  // deskripsi: '', // Tambahkan jika Anda menyertakan field deskripsi
};

export default function EditSubjectPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string; // Ini adalah nama_pendek (ID dokumen)

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false); // Loading submit
  const [pageLoading, setPageLoading] = useState(true); // Loading fetch data
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Data Mapel ---
  useEffect(() => {
    if (!subjectId) return;

    const fetchSubjectData = async () => {
      setPageLoading(true); setError(null);
      try {
        const subjectDocRef = doc(db, "subjects", subjectId); // Koleksi 'subjects'
        const docSnap = await getDoc(subjectDocRef);

        if (docSnap.exists()) {
          const subject = docSnap.data() as SubjectFetchData;
          // Isi form state dengan data yang diambil
          setFormData({
            nama_pendek: subject.nama_pendek || subjectId, // Nama pendek tidak bisa diedit
            nama_mapel: subject.nama_mapel || '',
            kelompok: subject.kelompok || '',
            kkm: subject.kkm ?? 0, // Default ke 0 jika null
            urutan: subject.urutan ?? 0, // Default ke 0 jika null
            tingkat: subject.tingkat || [], // Pastikan ini array
            // deskripsi: subject.deskripsi || '', // Isi deskripsi jika ada
          });
        } else {
          setError("Data mata pelajaran tidak ditemukan.");
          toast.error("Data mata pelajaran tidak ditemukan.");
        }
      } catch (err: any) {
        console.error("Error fetching subject data:", err);
        setError("Gagal memuat data mata pelajaran: " + err.message);
        toast.error("Gagal memuat data.");
      } finally {
        setPageLoading(false);
      }
    };
    fetchSubjectData();
  }, [subjectId]);

  // Handler input biasa (tidak berubah)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'kkm' || name === 'urutan') ? Number(value) : value
    }));
  };

  // Handler Checkbox Tingkat (tidak berubah)
  const handleTingkatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => {
        const currentTingkat = prev.tingkat || [];
        if (checked) { return { ...prev, tingkat: [...currentTingkat, value].sort() }; }
        else { return { ...prev, tingkat: currentTingkat.filter(t => t !== value).sort() }; }
    });
  };

  // Handler Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validasi
    if (!formData.nama_mapel || !formData.kelompok || formData.tingkat.length === 0) {
      setError("Nama Mapel, Kelompok, dan minimal satu Tingkat wajib diisi.");
      toast.error("Field wajib belum lengkap.");
      return;
    }
     if (isNaN(formData.kkm) || formData.kkm < 0 || formData.kkm > 100) {
        setError("KKM harus angka 0-100.");
        toast.error("KKM tidak valid.");
        return;
    }
     if (isNaN(formData.urutan)) {
         setError("Urutan harus angka.");
         toast.error("Urutan tidak valid.");
         return;
     }

    setLoading(true); setError(null);

    // Siapkan payload untuk update action
    const payload: SubjectUpdateFormData = {
        id: subjectId, // Kirim ID dokumen (nama_pendek)
        nama_mapel: formData.nama_mapel,
        kelompok: formData.kelompok,
        kkm: formData.kkm,
        urutan: formData.urutan,
        tingkat: formData.tingkat,
        // nama_pendek tidak dikirim karena tidak diubah
        // deskripsi: formData.deskripsi, // Kirim deskripsi jika ada
    };

    const result: ActionResult = await updateSubjectAction(payload); // Panggil update action
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.push('/list/subjects'); // Kembali ke daftar mapel
      router.refresh();
    } else {
      setError(result.message);
      toast.error(`Gagal: ${result.message}`);
    }
  };

  // Handler Batal
  const handleBatal = () => { if (!loading) router.push('/list/subjects'); };

  // Tampilan Loading Awal
   if (pageLoading) {
     return <div className="p-8 text-center text-gray-600">Memuat data mata pelajaran...</div>;
   }
   // Tampilan Error Fetch Awal
   if (error && !pageLoading) {
     return (
       <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
         <p>{error}</p>
         <button onClick={handleBatal} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Kembali</button>
       </div>
     );
   }

  return (
    <div className="container mx-auto p-4 md:p-8">
       {/* Tombol Kembali */}
       <button onClick={handleBatal} disabled={loading || pageLoading} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 self-start">
        <FiArrowLeft /> Kembali ke Daftar Mata Pelajaran
      </button>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto border border-gray-200">
        {/* Header Form */}
        <div className="border-b p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
            Edit Mata Pelajaran: {formData.nama_mapel || '...'} ({subjectId})
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
          {/* Tampilkan error submit jika ada */}
          {error && !loading && ( <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-200">{error}</div> )}

          {/* Kode (Nama Pendek) & Nama Mapel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {/* Nama Pendek (Read Only) */}
            <Input name="nama_pendek" label="Nama Pendek (ID)" value={formData.nama_pendek} onChange={handleChange} readOnly />
            <Input name="nama_mapel" label="Nama Mata Pelajaran" value={formData.nama_mapel} onChange={handleChange} required placeholder="Cth: Matematika" readOnly/>
          </div>

          {/* Kelompok, KKM, Urutan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select name="kelompok" label="Kelompok Mapel" value={formData.kelompok} onChange={handleChange} required
                      options={[
                          {value: '', label: '-- Pilih --'},
                          {value: 'UMUM', label: 'Umum'},
                          {value: 'AGAMA', label: 'Agama'},
                          {value: 'MULOK', label: 'Muatan Lokal'},
                          {value: 'LAIN', label: 'Lainnya'},
                      ]}
              />
            <Input name="kkm" label="KKM (0-100)" value={String(formData.kkm)} onChange={handleChange} type="number" required min="0" max="100"/>
            <Input name="urutan" label="Urutan Tampil" value={String(formData.urutan)} onChange={handleChange} type="number" required />
          </div>

           {/* Tingkat (Checkbox) */}
           <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Diajarkan di Tingkat:</label>
               <div className="flex flex-wrap gap-x-6 gap-y-2">
                   {TINGKAT_OPTIONS.map(tingkat => (
                       <label key={tingkat} className="flex items-center space-x-2 cursor-pointer">
                           <input type="checkbox" name="tingkat" value={tingkat}
                                  // Cek apakah string tingkat ada di array formData.tingkat
                                  checked={formData.tingkat?.includes(tingkat)}
                                  onChange={handleTingkatChange}
                                  className="h-4 w-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"/>
                           <span className="text-sm text-gray-700">Tingkat {tingkat}</span>
                       </label>
                   ))}
               </div>
           </div>

           {/* Deskripsi (Opsional) - Aktifkan jika field 'deskripsi' ada */}
           {/* <TextArea name="deskripsi" label="Deskripsi Singkat (Opsional)" value={formData.deskripsi || ''} onChange={handleChange} rows={3} placeholder="Penjelasan singkat..."/> */}

          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-5 border-t mt-5">
            <button type="button" onClick={handleBatal} disabled={loading || pageLoading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Batal</button>
            <button type="submit" disabled={loading || pageLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[150px] transition-colors">
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Helper (Input, Select, TextArea) - LENGKAP ---
type InputProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void; type?: string; required?: boolean; readOnly?: boolean; placeholder?: string; min?: string | number; max?: string | number; };
const Input = ({ label, name, value, onChange, type = 'text', required = false, readOnly = false, placeholder = '', min, max }: InputProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} id={name} name={name} value={value || ''} onChange={onChange} required={required} readOnly={readOnly} placeholder={placeholder} min={min} max={max}
           className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
  </div>
);

type SelectProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean; };
const Select = ({ label, name, value, onChange, options, required = false, disabled = false }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select id={name} name={name} value={value || ''} onChange={onChange} required={required} disabled={disabled}
            className={`block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
      {/* Opsi default yang lebih baik */}
      {/* Tambahkan placeholder jika opsi pertama bukan value kosong */}
      {options.length === 0 || options[0]?.value !== '' && <option value="" disabled={required}> -- Pilih -- </option>}
      {options.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))}
    </select>
  </div>
);



