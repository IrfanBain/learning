"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { toast } from 'react-hot-toast';
import { createStudentAction } from '@/app/actions/studentActions';
import { db } from '@/lib/firebaseConfig';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
// Interface StudentFormData (di-copy dari modal Anda)
// Rekomendasi: Pindahkan interface ini ke file terpusat misal 'types/student.ts'
export interface StudentFormData {
  nama_lengkap: string;
  nisn: string;
  nis: string;
  kelas: string;
  email: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  agama: string;
  kewarganegaraan: string;
  asal_sekolah: string;
  nomor_hp: string;
  status_siswa: string;
  alamat_jalan: string;
  alamat_rt_rw: string;
  alamat_kelurahan_desa: string;
  alamat_kecamatan: string;
  alamat_kota_kabupaten: string;
  alamat_provinsi: string;
  alamat_kode_pos: string;
  ortu_alamat: string;
  ortu_ayah_nama: string;
  ortu_ayah_pendidikan: string;
  ortu_ayah_pekerjaan: string;
  ortu_ayah_telepon: string;
  ortu_ibu_nama: string;
  ortu_ibu_pendidikan: string;
  ortu_ibu_pekerjaan: string;
  ortu_ibu_telepon: string;
}

interface ClassOption {
    id: string;         // ID Dokumen Kelas (cth: "VII-A")
    nama_kelas: string; // Nama Kelas (cth: "VII A")
}

// Nilai Awal (di-copy dari modal Anda)
const initialState: StudentFormData = {
  nama_lengkap: '', nisn: '', nis: '', kelas: '', email: 'email@gmail.com',
  jenis_kelamin: 'L', tempat_lahir: '', tanggal_lahir: '',
  agama: 'Islam', kewarganegaraan: 'Indonesia', asal_sekolah: '',
  nomor_hp: '', status_siswa: 'aktif',
  alamat_jalan: '', alamat_rt_rw: '', alamat_kelurahan_desa: 'Tanjung Wangi',
  alamat_kecamatan: 'Waway Karya', alamat_kota_kabupaten: 'Lampung Timur', alamat_provinsi: 'Lampung',
  alamat_kode_pos: '34376', ortu_alamat: '', ortu_ayah_nama: '',
  ortu_ayah_pendidikan: '', ortu_ayah_pekerjaan: '', ortu_ayah_telepon: '',
  ortu_ibu_nama: '', ortu_ibu_pendidikan: '', ortu_ibu_pekerjaan: '',
  ortu_ibu_telepon: '',
};

// Komponen Halaman Tambah Siswa
export default function CreateStudentPage() {
  const router = useRouter(); // Inisialisasi router
  const [formData, setFormData] = useState<StudentFormData>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // --- Fetch Daftar Kelas ---
  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const classesCollection = collection(db, "classes");
        // Urutkan berdasarkan tingkat lalu nama (opsional tapi bagus)
        const q = query(classesCollection, orderBy("tingkat", "asc"), orderBy("nama_kelas", "asc"));
        const querySnapshot = await getDocs(q);
        const classList = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id, // ID Dokumen ("VII-A")
          nama_kelas: doc.data().nama_kelas || doc.id, // Nama asli ("VII A")
        }));
        setClasses(classList);

        // Jika ada kelas dan kelas di form belum dipilih, set default ke kelas pertama
        if (classList.length > 0 && !formData.kelas) {
             setFormData(prev => ({ ...prev, kelas: classList[0].id }));
        }

      } catch (err) {
        console.error("Error fetching classes:", err);
        toast.error("Gagal memuat daftar kelas.");
        // Biarkan dropdown kosong atau tampilkan pesan error
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya fetch sekali

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nama_lengkap || !formData.nisn) {
      setError("Nama Lengkap dan NISN wajib diisi.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const result = await createStudentAction(formData); 
    
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      // Ganti onClose() dengan navigasi
      router.push('/list/students'); // <-- Sesuaikan dengan route Anda
      router.refresh(); // Memastikan data di halaman list ter-update
    } else {
      setError(result.message); 
    }
  };

  // Handler untuk tombol "Batal"
  const handleCancel = () => {
    if (loading) return;
    router.push('/list/students'); // <-- Sesuaikan dengan route Anda
  };

  return (
    // Ini adalah wrapper halaman, bukan modal
    <div className="container mx-auto p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto">
        
        {/* Header Halaman */}
        <div className="flex justify-between items-center border-b p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-semibold">Tambah Data Siswa</h1>
          <button 
            onClick={handleCancel} 
            disabled={loading} 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; Kembali
          </button>
        </div>
        
        {/* Form (sama persis dengan yang ada di modal) */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6">
          
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4">{error}</div>
          )}

          {/* --- BAGIAN LOGIN (FORM CERDAS) --- */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-4">
            <h4 className="text-lg font-semibold text-blue-800 mb-2">Data Akun & Profil</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nama_lengkap" className="block text-sm font-medium text-gray-700">Nama Lengkap (Wajib)</label>
                <input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleChange} required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
              </div>
              <div>
                <label htmlFor="nisn" className="block text-sm font-medium text-gray-700">NISN (Wajib)</label>
                <input type="text" name="nisn" value={formData.nisn} onChange={handleChange} required
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="auto-username" className="block text-xs font-medium text-gray-600">Username (Otomatis)</label>
                <input type="text" id="auto-username" value={formData.nisn} readOnly
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"/>
              </div>
              <div>
                <label htmlFor="auto-password" className="block text-xs font-medium text-gray-600">Password Awal (Otomatis)</label>
                <input type="text" id="auto-password" value={formData.nisn} readOnly
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"/>
              </div>
            </div>
          </div>
          
          {/* --- BAGIAN DATA DIRI --- */}
          <div className="p-4 border rounded-md mb-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Data Diri</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input name="nis" label="NIS" value={formData.nis} onChange={handleChange} />
                <Select name="kelas" label="Kelas (Wajib)" value={formData.kelas} onChange={handleChange} 
                        required
                        disabled={loadingClasses || classes.length === 0} // Disable jika loading atau tidak ada kelas
                        options={
                            loadingClasses
                            ? [{ value: '', label: 'Memuat kelas...' }]
                            : classes.length === 0
                            ? [{ value: '', label: 'Tidak ada kelas'}]
                            // Map daftar kelas menjadi options
                            : classes.map(cls => ({ value: cls.id, label: cls.nama_kelas }))
                        }
                />
                <Input name="email" label="Email (Kontak)" value={formData.email} onChange={handleChange} type="email" />
                <Select name="jenis_kelamin" label="Jenis Kelamin" value={formData.jenis_kelamin} onChange={handleChange} options={[{value: 'L', label: 'Laki-laki'}, {value: 'P', label: 'Perempuan'}]} />
                <Input name="tempat_lahir" label="Tempat Lahir" value={formData.tempat_lahir} onChange={handleChange} />
                <Input name="tanggal_lahir" label="Tanggal Lahir" value={formData.tanggal_lahir} onChange={handleChange} type="date" />
                <Select name="agama" label="Agama" value={formData.agama} onChange={handleChange} options={[{value: 'Islam', label: 'Islam'}, {value: 'Kristen', label: 'Kristen'}, {value: 'Katolik', label: 'Katolik'}, {value: 'Hindu', label: 'Hindu'}, {value: 'Buddha', label: 'Buddha'}, {value: 'Konghucu', label: 'Konghucu'}]} />
                <Input name="kewarganegaraan" label="Kewarganegaraan" value={formData.kewarganegaraan} onChange={handleChange} />
                <Input name="asal_sekolah" label="Asal Sekolah" value={formData.asal_sekolah} onChange={handleChange} />
                <Input name="nomor_hp" label="Nomor HP" value={formData.nomor_hp} onChange={handleChange} />
                <Select name="status_siswa" label="Status Siswa" value={formData.status_siswa} onChange={handleChange} options={[{value: 'aktif', label: 'Aktif'}, {value: 'lulus', label: 'Lulus'}, {value: 'pindah', label: 'Pindah'}, {value: 'dikeluarkan', label: 'Dikeluarkan'}]} />
              </div>
          </div>

          {/* --- BAGIAN ALAMAT --- */}
          <div className="p-4 border rounded-md mb-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Alamat Siswa <span className='text-sm italic text-gray-500'>(Bisa diisi nanti)</span></h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input name="alamat_jalan" label="Jalan" value={formData.alamat_jalan} onChange={handleChange} />
                <Input name="alamat_rt_rw" label="RT/RW" value={formData.alamat_rt_rw} onChange={handleChange} />
                <Input name="alamat_kelurahan_desa" label="Kelurahan/Desa" value={formData.alamat_kelurahan_desa} onChange={handleChange} />
                <Input name="alamat_kecamatan" label="Kecamatan" value={formData.alamat_kecamatan} onChange={handleChange} />
                <Input name="alamat_kota_kabupaten" label="Kota/Kabupaten" value={formData.alamat_kota_kabupaten} onChange={handleChange} />
                <Input name="alamat_provinsi" label="Provinsi" value={formData.alamat_provinsi} onChange={handleChange} />
                <Input name="alamat_kode_pos" label="Kode Pos" value={formData.alamat_kode_pos} onChange={handleChange} />
              </div>
          </div>
          
          {/* --- BAGIAN ORANG TUA --- */}
          <div className="p-4 border rounded-md">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Data Orang Tua <span className='text-sm italic text-gray-500'>(Bisa diisi nanti)</span></h4>
              <Input name="ortu_alamat" label="Alamat Orang Tua" value={formData.ortu_alamat} onChange={handleChange} />
              <h5 className="text-md font-semibold text-gray-700 mt-4 mb-2 border-b">Data Ayah</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input name="ortu_ayah_nama" label="Nama Ayah" value={formData.ortu_ayah_nama} onChange={handleChange} />
                <Input name="ortu_ayah_pendidikan" label="Pendidikan Ayah" value={formData.ortu_ayah_pendidikan} onChange={handleChange} />
                <Input name="ortu_ayah_pekerjaan" label="Pekerjaan Ayah" value={formData.ortu_ayah_pekerjaan} onChange={handleChange} />
                <Input name="ortu_ayah_telepon" label="Telepon Ayah" value={formData.ortu_ayah_telepon} onChange={handleChange} />
              </div>
              <h5 className="text-md font-semibold text-gray-700 mt-4 mb-2 border-b">Data Ibu</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input name="ortu_ibu_nama" label="Nama Ibu" value={formData.ortu_ibu_nama} onChange={handleChange} />
                <Input name="ortu_ibu_pendidikan" label="Pendidikan Ibu" value={formData.ortu_ibu_pendidikan} onChange={handleChange} />
                <Input name="ortu_ibu_pekerjaan" label="Pekerjaan Ibu" value={formData.ortu_ibu_pekerjaan} onChange={handleChange} />
                <Input name="ortu_ibu_telepon" label="Telepon Ibu" value={formData.ortu_ibu_telepon} onChange={handleChange} />
              </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <button type="button" onClick={handleCancel} disabled={loading}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan Siswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Helper Form (sama persis) ---
type InputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
}

const Input = ({ label, name, value, onChange, type = 'text' }: InputProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
    />
  </div>
);

type SelectProps = {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
}

const Select = ({ label, name, value, onChange, options }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);
