"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'; // Import Firestore
import { db } from '@/lib/firebaseConfig'; // Import db
import { ClassFormData, createClassAction } from '@/app/actions/classActions'; // Import action & interface
import { FiArrowLeft } from 'react-icons/fi';

// Interface sederhana untuk data guru (hanya ID dan Nama)
interface TeacherOption {
  uid: string;
  nama_lengkap: string;
}

// Nilai Awal Form
const initialState: ClassFormData = {
  nama_kelas: '',
  tingkat: 7, // Default tingkat 7
  tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, // Default tahun ajaran saat ini
  wali_kelas_uid: '', // Kosongkan, akan dipilih dari dropdown
};

export default function CreateClassPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ClassFormData>(initialState);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]); // State untuk daftar guru
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true); // Loading untuk fetch guru
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Daftar Guru untuk Dropdown Wali Kelas ---
  useEffect(() => {
    const fetchTeachers = async () => {
      setFetchLoading(true);
      try {
        const teachersCollection = collection(db, "teachers");
        const q = query(teachersCollection, orderBy("nama_lengkap", "asc"));
        const querySnapshot = await getDocs(q);
        const teacherList = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          uid: doc.id,
          nama_lengkap: doc.data().nama_lengkap || 'Tanpa Nama',
        }));
        setTeachers(teacherList);
        // Set wali kelas default ke guru pertama jika ada
        if (teacherList.length > 0 && !formData.wali_kelas_uid) {
             setFormData(prev => ({ ...prev, wali_kelas_uid: teacherList[0].uid }));
        }
      } catch (err) {
        console.error("Error fetching teachers:", err);
        toast.error("Gagal memuat daftar guru.");
        // Tetap lanjutkan meski guru gagal dimuat, user bisa coba lagi nanti
      } finally {
        setFetchLoading(false);
      }
    };
    fetchTeachers();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya fetch sekali saat komponen mount

  // Handler perubahan input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      // Konversi ke angka jika tipenya number (untuk tingkat)
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  // Handler Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_kelas || !formData.tingkat || !formData.tahun_ajaran || !formData.wali_kelas_uid) {
      setError("Semua field wajib diisi.");
      toast.error("Semua field wajib diisi.");
      return;
    }
    // Validasi tambahan (misal: format tahun ajaran YYYY/YYYY)
    if (!/^\d{4}\/\d{4}$/.test(formData.tahun_ajaran)) {
        setError("Format Tahun Ajaran harus YYYY/YYYY (contoh: 2024/2025).");
        toast.error("Format Tahun Ajaran salah.");
        return;
    }
     // Validasi nama kelas untuk ID (tidak boleh kosong setelah trim)
    if (!formData.nama_kelas.trim()) {
        setError("Nama Kelas tidak boleh kosong.");
        toast.error("Nama Kelas tidak boleh kosong.");
        return;
    }


    setLoading(true);
    setError(null);

    const result = await createClassAction(formData);

    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.push('/list/classes'); // Sesuaikan path jika perlu
      router.refresh();
    } else {
      setError(result.message);
      toast.error(`Gagal: ${result.message}`);
    }
  };

  // Handler Batal
  const handleBatal = () => { if (!loading) router.push('/list/classes'); }; // Sesuaikan path jika perlu

  return (
    <div className="container mx-auto p-4 md:p-8">
       {/* Tombol Kembali */}
       <button onClick={handleBatal} disabled={loading} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 self-start">
        <FiArrowLeft /> Kembali ke Daftar Kelas
      </button>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto border border-gray-200"> {/* Max-width lebih kecil */}
        {/* Header Form */}
        <div className="border-b p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
            Tambah Kelas Baru
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5"> {/* Kurangi space */}
          {error && ( <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-200">{error}</div> )}

          {/* Input Nama Kelas (Jadi ID) */}
          <Input name="nama_kelas" label="Nama Kelas (Akan Jadi ID Unik)" value={formData.nama_kelas} onChange={handleChange} required placeholder="Contoh: VII-A, X-IPA-1"/>

           {/* Input Tingkat & Tahun Ajaran (Side by side) */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <Input name="tingkat" label="Tingkat" value={String(formData.tingkat)} onChange={handleChange} type="number" required min="1" max="12"/>
             <Input name="tahun_ajaran" label="Tahun Ajaran" value={formData.tahun_ajaran} onChange={handleChange} required placeholder="YYYY/YYYY"/>
           </div>

          {/* Dropdown Wali Kelas */}
          <Select name="wali_kelas_uid" label="Wali Kelas" value={formData.wali_kelas_uid} onChange={handleChange} required
                  disabled={fetchLoading} // Disable saat guru sedang dimuat
                  options={
                      fetchLoading
                      ? [{ value: '', label: 'Memuat guru...' }]
                      : teachers.length === 0
                      ? [{ value: '', label: 'Tidak ada guru ditemukan' }]
                      : teachers.map(teacher => ({ value: teacher.uid, label: teacher.nama_lengkap }))
                  }
          />
          {teachers.length === 0 && !fetchLoading && (
              <p className="text-xs text-yellow-600">Data guru kosong. Harap tambahkan data guru terlebih dahulu.</p>
          )}


          {/* Tambahkan input lain jika perlu (Jurusan, Kapasitas) */}
          {/* <Input name="jurusan" label="Jurusan (Opsional)" value={formData.jurusan || ''} onChange={handleChange} /> */}
          {/* <Input name="kapasitas" label="Kapasitas (Opsional)" value={String(formData.kapasitas || '')} onChange={handleChange} type="number" /> */}


          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-5 border-t mt-5">
            <button type="button" onClick={handleBatal} disabled={loading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading || fetchLoading || teachers.length === 0} // Disable jika guru belum ada/loading
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[120px] transition-colors">
              {loading ? 'Menyimpan...' : 'Simpan Kelas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Helper (Input & Select) ---
// (Salin dari file create/edit guru)
type InputProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; type?: string; required?: boolean; readOnly?: boolean; placeholder?: string; min?: string | number; max?: string | number; };
const Input = ({ label, name, value, onChange, type = 'text', required = false, readOnly = false, placeholder = '', min, max }: InputProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input type={type} id={name} name={name} value={value || ''} onChange={onChange} required={required} readOnly={readOnly} placeholder={placeholder} min={min} max={max}
           className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
  </div>
);
type SelectProps = { label: string; name: string; value: string | null | undefined; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean; };
const Select = ({ label, name, value, onChange, options, required = false, disabled = false }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select id={name} name={name} value={value || ''} onChange={onChange} required={required} disabled={disabled}
            className={`block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
      {/* Tambahkan opsi "-- Pilih --" jika tidak required dan belum ada pilihan */}
      {!required && value === '' && <option value="" disabled>-- Pilih Wali Kelas --</option>}
      {options.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))}
    </select>
  </div>
);
