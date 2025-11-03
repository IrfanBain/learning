"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from "next/image";
import Link from "next/link"; // Meskipun tidak dipakai langsung, baik untuk ada
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // Pastikan path ini benar
import { format } from 'date-fns'; // Untuk format tanggal
import { toast } from 'react-hot-toast';
import { FiArrowLeft } from 'react-icons/fi'; // Ikon untuk tombol kembali

// Impor Action dan Interface yang relevan dari teacherActions
import { TeacherUpdateFormData, updateTeacherAction } from '@/app/actions/teacherActions'; // Pastikan path ini benar

// Interface Data Guru (dari Firestore, untuk fetch awal)
// Ini mendefinisikan struktur data yang kita BACA dari Firestore
interface TeacherDetailData {
  nama_lengkap: string;
  nip_nuptk: string;
  email: string | null;
  foto_profil: string | null;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: Timestamp | null;
  agama: string | null;
  nomor_hp: string | null;
  status_kepegawaian: string | null;
  pendidikan_terakhir: string | null;
  almamater: string | null;
  jurusan_pendidikan: string | null;
  tanggal_mulai_kerja: Timestamp | null;
  mata_pelajaran_diampu: string[]; // Ini array di Firestore
  peran: string[]; // Ini array di Firestore
  wali_kelas_ref: string | null;
  alamat: {
    jalan?: string | null;
    rt_rw?: string | null;
    kelurahan_desa?: string | null;
    kecamatan?: string | null;
    kota_kabupaten?: string | null;
    provinsi?: string | null;
    kode_pos?: string | null;
  } | null;
}

// State Awal Form (kosong, akan diisi dari fetch)
// Tipe datanya Omit<TeacherUpdateFormData...> karena UID dan foto_profil ditangani terpisah
const initialFormState: Omit<TeacherUpdateFormData, 'uid' | 'foto_profil'> = {
  nama_lengkap: '', nip_nuptk: '', email: '',
  jenis_kelamin: 'L', tempat_lahir: '', tanggal_lahir: '', agama: 'Islam', nomor_hp: '',
  status_kepegawaian: 'pns', pendidikan_terakhir: 's1', almamater: '', jurusan_pendidikan: '',
  tanggal_mulai_kerja: '', mata_pelajaran_diampu: '', peran: 'guru', wali_kelas_ref: '',
  alamat_jalan: '', alamat_rt_rw: '', alamat_kelurahan_desa: '', alamat_kecamatan: '',
  alamat_kota_kabupaten: '', alamat_provinsi: '', alamat_kode_pos: '',
};


// Komponen Utama Halaman Edit Guru
export default function EditTeacherPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.id as string; // Ambil UID guru dari URL

  // State untuk form
  const [formData, setFormData] = useState(initialFormState);
  // State untuk foto
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null); // Menyimpan URL foto saat ini dari DB

  // State UI
  const [loading, setLoading] = useState(false); // Loading saat submit
  const [pageLoading, setPageLoading] = useState(true); // Loading saat fetch data awal
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Data Guru ---
  useEffect(() => {
    if (!teacherId) return; // Jangan fetch jika ID belum ada

    const fetchTeacherData = async () => {
      setPageLoading(true); setError(null);
      try {
        const docRef = doc(db, 'teachers', teacherId); // Referensi ke dokumen guru
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const teacher = docSnap.data() as TeacherDetailData; // Ambil data

          // Helper format tanggal dari Timestamp ke YYYY-MM-DD (untuk input type="date")
          const formatTimestampToInput = (ts: Timestamp | null | undefined): string => {
            if (!ts) return '';
            try { return ts.toDate().toISOString().split('T')[0]; }
            catch { return ''; }
          };

          // Helper format array ke string dipisah koma (untuk input text)
          const formatArrayToString = (arr: string[] | null | undefined): string => {
            if (!arr || arr.length === 0) return '';
            return arr.join(', '); // Gabungkan dengan koma dan spasi
          };

          // Isi state form `formData` dengan data yang diambil dari Firestore
          setFormData({
            nama_lengkap: teacher.nama_lengkap || '',
            nip_nuptk: teacher.nip_nuptk || '', // NIP/NUPTK tidak bisa diedit di form ini
            email: teacher.email || '',
            jenis_kelamin: teacher.jenis_kelamin || 'L',
            tempat_lahir: teacher.tempat_lahir || '',
            tanggal_lahir: formatTimestampToInput(teacher.tanggal_lahir),
            agama: teacher.agama || 'Islam',
            nomor_hp: teacher.nomor_hp || '',
            status_kepegawaian: teacher.status_kepegawaian || 'pns',
            pendidikan_terakhir: teacher.pendidikan_terakhir || 's1',
            almamater: teacher.almamater || '',
            jurusan_pendidikan: teacher.jurusan_pendidikan || '',
            tanggal_mulai_kerja: formatTimestampToInput(teacher.tanggal_mulai_kerja),
            mata_pelajaran_diampu: formatArrayToString(teacher.mata_pelajaran_diampu), // Format ke string
            peran: formatArrayToString(teacher.peran), // Format ke string
            wali_kelas_ref: teacher.wali_kelas_ref || '',
            alamat_jalan: teacher.alamat?.jalan || '',
            alamat_rt_rw: teacher.alamat?.rt_rw || '',
            alamat_kelurahan_desa: teacher.alamat?.kelurahan_desa || '',
            alamat_kecamatan: teacher.alamat?.kecamatan || '',
            alamat_kota_kabupaten: teacher.alamat?.kota_kabupaten || '',
            alamat_provinsi: teacher.alamat?.provinsi || '',
            alamat_kode_pos: teacher.alamat?.kode_pos || '',
          });

          // Set preview foto dan simpan URL foto saat ini
          setPreviewUrl(teacher.foto_profil || null);
          setCurrentPhotoUrl(teacher.foto_profil || null);

        } else {
          setError("Data guru tidak ditemukan.");
          toast.error("Data guru tidak ditemukan.");
        }
      } catch (err: any) {
        console.error("Error fetching teacher data: ", err);
        setError("Gagal mengambil data guru. Error: " + err.message);
        toast.error("Gagal mengambil data guru.");
      } finally {
        setPageLoading(false);
      }
    };
    fetchTeacherData();
  }, [teacherId]); // Fetch ulang jika teacherId berubah

  // Handler perubahan input form (text, select, textarea)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler perubahan input file foto
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Batas 5MB
          toast.error("Ukuran file terlalu besar. Maksimal 5MB.");
          // Reset input file jika terlalu besar
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
      }
      setSelectedFile(file); // Simpan file yang dipilih
      setPreviewUrl(URL.createObjectURL(file)); // Buat URL preview lokal
    }
  };

  // Handler Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validasi dasar
    if (!formData.nama_lengkap || !formData.nip_nuptk) {
      setError("Nama Lengkap dan NIP/NUPTK wajib diisi.");
      toast.error("Nama Lengkap dan NIP/NUPTK wajib diisi.");
      return;
    }
     // Validasi panjang NIP
     if (formData.nip_nuptk.length < 6) {
        setError("NIP/NUPTK harus minimal 6 karakter.");
        toast.error("NIP/NUPTK harus minimal 6 karakter.");
        return;
    }


    setLoading(true); // Mulai loading submit
    setError(null);

    let finalPhotoURL = currentPhotoUrl; // Mulai dengan URL foto yang sudah ada di DB

    // --- Langkah 1: Upload Foto Baru ke R2 (Jika ada file dipilih) ---
    if (selectedFile) {
      const toastId = toast.loading('Mempersiapkan unggah foto...');
      try {
        const fileExtension = selectedFile.name.split('.').pop() || 'jpg'; // Default ke jpg jika ekstensi tidak ada

        // 1a. Minta URL aman dari API Route
        const response = await fetch('/api/upload-url', { // Pastikan endpoint API ini benar
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: selectedFile.type,
            fileExtension: fileExtension,
            fileName: selectedFile.name,
            // Anda bisa tambahkan prefix folder di sini jika mau
            prefix: `user_photo`
          }),
        });

        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error || 'Gagal mendapatkan URL upload dari server.');
        }
        // Pastikan response adalah JSON dan memiliki properti yang diharapkan
        const { uploadUrl, fileUrl } = await response.json() as { uploadUrl: string, fileUrl: string };

        // 1b. Upload file langsung ke Cloudflare R2 menggunakan URL yang didapat
        toast.loading('Mengunggah foto...', { id: toastId });
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
             // Cloudflare R2 mungkin tidak butuh Content-Length jika streaming, tapi bisa ditambahkan jika perlu
             // 'Content-Length': selectedFile.size.toString()
          },
        });

        if (!uploadResponse.ok) {
           // Coba baca respons error dari R2 jika ada
           const errorText = await uploadResponse.text();
           console.error("R2 Upload Error Response:", errorText);
           throw new Error(`Upload ke R2 gagal. Status: ${uploadResponse.status}`);
        }

        finalPhotoURL = fileUrl; // Sukses! Gunakan URL R2 baru ini.
        toast.success('Foto profil berhasil diunggah!', { id: toastId });

      } catch (uploadError: any) {
        console.error("Upload Error:", uploadError); // Log detail error
        setError("Gagal mengunggah foto profil: " + uploadError.message);
        toast.error(`Gagal upload foto: ${uploadError.message}`, { id: toastId });
        setLoading(false); // Hentikan loading submit
        return; // Hentikan proses jika upload gagal
      }
    }

    // --- Langkah 2: Panggil Server Action Update Guru ---
    try {
      // Panggil action `updateTeacherAction` dengan data lengkap
      const result = await updateTeacherAction({
        uid: teacherId,             // Sertakan UID guru
        ...formData,               // Sertakan semua data dari form state
        foto_profil: finalPhotoURL, // Sertakan URL foto (baru dari R2 atau lama dari DB)
      });

      setLoading(false); // Selesai loading submit

      if (result.success) {
        toast.success(result.message);
        // Reset state file setelah sukses
        setSelectedFile(null);
        setCurrentPhotoUrl(finalPhotoURL); // Update URL foto saat ini
        if (fileInputRef.current) fileInputRef.current.value = ""; // Kosongkan input file
        // Arahkan kembali ke daftar guru
        router.push('/list/teachers'); // Pastikan path ini benar
        router.refresh(); // Minta Next.js refresh data di halaman tujuan
      } else {
        // Jika action gagal, tampilkan pesan error
        setError(result.message);
        toast.error(`Gagal update data: ${result.message}`);
      }
    } catch (dbError: any) {
        // Tangani error tak terduga saat memanggil action
        setLoading(false); // Selesai loading submit
        console.error("DB Update Error:", dbError); // Log detail error
        setError("Gagal menyimpan data guru: " + dbError.message);
        toast.error("Gagal menyimpan data guru: " + dbError.message);
    }
  };


  // Handler Tombol Batal
  const handleBatal = () => { if (!loading && !pageLoading) router.push('/list/teachers'); }; // Pastikan path ini benar

  // Tampilan Loading Awal
  if (pageLoading) {
     return <div className="p-8 text-center text-gray-600">Memuat data guru...</div>;
  }
   // Tampilan Error Fetching Awal
   if (error && !pageLoading) { // Hanya tampilkan error fetch jika pageLoading selesai
     return (
       <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
         <p>{error}</p>
         <button onClick={handleBatal} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Kembali</button>
       </div>
     );
   }


  // --- Render Form Edit ---
  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Tombol Kembali */}
       <button onClick={handleBatal} disabled={loading || pageLoading} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 self-start">
        <FiArrowLeft /> Kembali ke Daftar Guru
      </button>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto border border-gray-200">

        {/* Header Form */}
        <div className="border-b p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
            Edit Guru: {formData.nama_lengkap || '...'}
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">

          {/* Tampilkan error submit jika ada */}
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-200">{error}</div>
          )}

          {/* --- BAGIAN AKUN, PROFIL, FOTO --- */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Kolom 1+2: Info Akun & Profil */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 text-gray-700">Informasi Akun & Profil</h3>
                {/* Nama Lengkap */}
                <Input name="nama_lengkap" label="Nama Lengkap (Wajib)" value={formData.nama_lengkap} onChange={handleChange} required />
                {/* NIP/NUPTK (Read Only) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIP / NUPTK (Tidak bisa diubah)</label>
                    <input type="text" value={formData.nip_nuptk} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"/>
                </div>
                 {/* Penanda Login (Read Only) */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Username (Otomatis)</label>
                        <input type="text" value={formData.nip_nuptk} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Password Awal (Otomatis)</label>
                        <input type="text" value={formData.nip_nuptk} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"/>
                    </div>
                </div>
                 {/* Email & Jenis Kelamin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                   <Input name="email" label="Email (Kontak)" value={formData.email} onChange={handleChange} type="email" placeholder="email@guru.com"/>
                   <Select name="jenis_kelamin" label="Jenis Kelamin" value={formData.jenis_kelamin} onChange={handleChange} options={[{value: 'L', label: 'Laki-laki'}, {value: 'P', label: 'Perempuan'}]} />
                </div>
              </div>

              {/* Kolom 3: Upload Foto */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-center md:text-left">Foto Profil</label>
                {/* Preview Foto */}
                <div className="w-40 h-40 mx-auto md:mx-0 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mb-2 border-2 border-gray-300">
                  {previewUrl ? (
                    <Image
                      src={previewUrl} alt="Preview Foto Profil"
                      width={160} height={160} // Beri ukuran eksplisit
                      className="object-cover w-full h-full"
                      onError={() => {
                          console.warn("Gagal memuat preview:", previewUrl);
                          setPreviewUrl(null); // Hapus preview jika URL rusak
                      }}
                    />
                  ) : (
                    <span className="text-gray-500 text-sm">Tidak Ada Foto</span>
                  )}
                </div>
                {/* Input File */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp" // Tipe file yang diizinkan
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1 text-center md:text-left">Pilih foto baru (maks 5MB).</p>
              </div>
          </div>


          {/* --- BAGIAN DATA DIRI --- */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
             <h3 className="text-lg font-semibold border-b pb-2 text-gray-700">Data Pribadi</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input name="tempat_lahir" label="Tempat Lahir" value={formData.tempat_lahir} onChange={handleChange} />
                <Input name="tanggal_lahir" label="Tanggal Lahir" value={formData.tanggal_lahir} onChange={handleChange} type="date" />
                 <Select name="agama" label="Agama" value={formData.agama} onChange={handleChange} options={[{value: 'Islam', label: 'Islam'}, {value: 'Kristen', label: 'Kristen'}, {value: 'Katolik', label: 'Katolik'}, {value: 'Hindu', label: 'Hindu'}, {value: 'Buddha', label: 'Buddha'}, {value: 'Konghucu', label: 'Konghucu'}]} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input name="nomor_hp" label="Nomor HP" value={formData.nomor_hp} onChange={handleChange} type="tel"/>
             </div>
          </div>


          {/* --- BAGIAN PROFESIONAL/MENGAJAR --- */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-gray-700">Data Profesional & Mengajar</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select name="status_kepegawaian" label="Status Kepegawaian" value={formData.status_kepegawaian} onChange={handleChange} options={[{value: 'pns', label: 'PNS'}, {value: 'pppk', label: 'PPPK'}, {value: 'honor', label: 'Honor/GTT'}, {value: 'lainnya', label: 'Lainnya'}]} />
              <Select name="pendidikan_terakhir" label="Pendidikan Terakhir" value={formData.pendidikan_terakhir} onChange={handleChange} options={[{value: 's1', label: 'S1'}, {value: 's2', label: 'S2'}, {value: 's3', label: 'S3'}, {value: 'd3', label: 'D3'}, {value: 'sma', label: 'SMA/Sederajat'}]} />
              <Input name="almamater" label="Almamater" value={formData.almamater} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input name="jurusan_pendidikan" label="Jurusan Pendidikan" value={formData.jurusan_pendidikan} onChange={handleChange} />
              <Input name="tanggal_mulai_kerja" label="Tgl. Mulai Kerja" value={formData.tanggal_mulai_kerja} onChange={handleChange} type="date" />
              <Input name="wali_kelas_ref" label="ID Wali Kelas (Opsional)" value={formData.wali_kelas_ref} onChange={handleChange} placeholder="Kosongkan jika bukan wali kelas"/>
            </div>
            {/* Input untuk Array (dipisah koma) */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <Input name="mata_pelajaran_diampu" label="Mata Pelajaran (Dipisah Koma)" value={formData.mata_pelajaran_diampu} onChange={handleChange} placeholder="Contoh: mtk, fisika, b. indo" />
              </div>
              <div>
                <Input name="peran" label="Peran (Dipisah Koma)" value={formData.peran} onChange={handleChange} placeholder="Minimal 'guru'. Contoh: guru, staf tu" required />
              </div>
             </div>
          </div>


          {/* --- BAGIAN ALAMAT --- */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 text-gray-700">Alamat Guru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input name="alamat_jalan" label="Jalan/Dusun" value={formData.alamat_jalan} onChange={handleChange} />
                <Input name="alamat_rt_rw" label="RT/RW" value={formData.alamat_rt_rw} onChange={handleChange} placeholder="Contoh: 001/002"/>
                <Input name="alamat_kelurahan_desa" label="Kelurahan/Desa" value={formData.alamat_kelurahan_desa} onChange={handleChange} />
                <Input name="alamat_kecamatan" label="Kecamatan" value={formData.alamat_kecamatan} onChange={handleChange} />
                <Input name="alamat_kota_kabupaten" label="Kota/Kabupaten" value={formData.alamat_kota_kabupaten} onChange={handleChange} />
                <Input name="alamat_provinsi" label="Provinsi" value={formData.alamat_provinsi} onChange={handleChange} />
                <Input name="alamat_kode_pos" label="Kode Pos" value={formData.alamat_kode_pos} onChange={handleChange} type="number"/>
              </div>
          </div>


          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <button type="button" onClick={handleBatal} disabled={loading || pageLoading}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
              Batal
            </button>
            <button type="submit" disabled={loading || pageLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[150px] transition-colors"> {/* Lebarkan sedikit */}
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// --- Komponen Helper (Input & Select) --- (DIAKTIFKAN KEMBALI)
type InputProps = {
  label: string;
  name: string;
  value: string | null | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}

const Input = ({ label, name, value, onChange, type = 'text', required = false, readOnly = false, placeholder = '' }: InputProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value || ''}
      onChange={onChange}
      required={required}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
    />
  </div>
);

type SelectProps = {
  label: string;
  name: string;
  value: string | null | undefined;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}

const Select = ({ label, name, value, onChange, options, required = false }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      id={name}
      name={name}
      value={value || ''}
      onChange={onChange}
      required={required}
      className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
    >
      {/* Tambahkan opsi default kosong jika tidak required */}
      {/* {!required && <option value="">-- Pilih --</option>} */}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);
// --- AKHIR KOMPONEN HELPER ---

