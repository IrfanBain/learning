"use client";

import React, { useState, useEffect, useRef } from 'react'; // Impor useRef
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Impor Image
import { toast } from 'react-hot-toast';
import { updateStudentAction, StudentUpdateFormData } from '@/app/actions/studentActions';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc, Timestamp, collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Interface untuk props halaman dinamis
interface EditStudentPageProps {
  params: {
    id: string; 
  };
}

// Interface untuk data siswa
interface StudentData {
  nama_lengkap: string;
  nisn: string;
  nis: string | null;
  kelas: string | null;
  email: string | null;
  jenis_kelamin: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: any; // Timestamp
  agama: string | null;
  kewarganegaraan: string | null;
  asal_sekolah: string | null;
  nomor_hp: string | null;
  status_siswa: string | null;
  foto_profil: string | null; // <-- TAMBAHKAN INI (URL foto dari R2)
  alamat: { [key: string]: string | null };
  orang_tua: { 
    [key: string]: any;
    alamat: string | null;
    ayah: { [key: string]: string | null };
    ibu: { [key: string]: string | null };
  };
}

interface ClassOption {
    id: string;         // ID Dokumen Kelas (cth: "VII-A")
    nama_kelas: string; // Nama Kelas (cth: "VII A")
}

// State Awal Form (tidak berubah)
const initialFormState: Omit<StudentUpdateFormData, 'uid' | 'foto_profil'> = {
  nama_lengkap: '', nisn: '', nis: '', kelas: '', email: '',
  jenis_kelamin: 'L', tempat_lahir: '', tanggal_lahir: '',
  agama: 'Islam', kewarganegaraan: 'Indonesia', asal_sekolah: '',
  nomor_hp: '', status_siswa: 'aktif',
  alamat_jalan: '', alamat_rt_rw: '', alamat_kelurahan_desa: '',
  alamat_kecamatan: '', alamat_kota_kabupaten: '', alamat_provinsi: '',
  alamat_kode_pos: '', ortu_alamat: '', ortu_ayah_nama: '',
  ortu_ayah_pendidikan: '', ortu_ayah_pekerjaan: '', ortu_ayah_telepon: '',
  ortu_ibu_nama: '', ortu_ibu_pendidikan: '', ortu_ibu_pekerjaan: '',
  ortu_ibu_telepon: '',
};

export default function EditStudentPage({ params }: EditStudentPageProps) {
  const router = useRouter();
  const { id: studentId } = params; 

  const [formData, setFormData] = useState(initialFormState);
  
  // --- State Baru untuk Foto ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Untuk loading submit
  const [pageLoading, setPageLoading] = useState(true); // Untuk loading fetch data awal

  // --- LOGIKA FETCH DATA (Diperbarui) ---
  useEffect(() => {
    if (!studentId) return;

    const fetchStudentData = async () => {
      setPageLoading(true);
      setError(null);
      setLoadingClasses(true);
      let fetchedStudentData: StudentData | null = null;
      try {
        // 1. Fetch Data Siswa
        const studentDocRef = doc(db, 'students', studentId);
        const studentSnap = await getDoc(studentDocRef);
        if (!studentSnap.exists()) { throw new Error("Data siswa tidak ditemukan."); }
        fetchedStudentData = studentSnap.data() as StudentData;

        // 2. Fetch Daftar Kelas (taruh di sini agar berjalan paralel jika memungkinkan)
        try {
            const classesCollection = collection(db, "classes");
            const q = query(classesCollection, orderBy("tingkat", "asc"), orderBy("nama_kelas", "asc"));
            const querySnapshot = await getDocs(q);
            const classList = querySnapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
                id: docSnap.id,
                nama_kelas: docSnap.data().nama_kelas || docSnap.id,
            }));
            setClasses(classList);
        } catch (classErr) {
            console.error("Error fetching classes:", classErr);
            toast.error("Gagal memuat daftar kelas."); // Beri tahu user
            // Lanjutkan meski kelas gagal dimuat
        } finally {
            setLoadingClasses(false); // Selesai loading kelas
        }

        // 3. Isi Form State (SETELAH kedua fetch selesai atau gagal)
        if (fetchedStudentData) {
            const formatTimestampToInput = (ts: Timestamp | null | undefined): string => { return !ts?'':ts.toDate().toISOString().split('T')[0]; };

            setFormData({
                nama_lengkap: fetchedStudentData.nama_lengkap || '',
                nisn: fetchedStudentData.nisn || '', // NISN tidak bisa diedit
                nis: fetchedStudentData.nis || '',
                kelas: fetchedStudentData.kelas || '', // <-- Isi dengan ID kelas dari DB
                email: fetchedStudentData.email || '',
                jenis_kelamin: fetchedStudentData.jenis_kelamin || 'L',
                tempat_lahir: fetchedStudentData.tempat_lahir || '',
                tanggal_lahir: formatTimestampToInput(fetchedStudentData.tanggal_lahir),
                agama: fetchedStudentData.agama || 'Islam',
                kewarganegaraan: fetchedStudentData.kewarganegaraan || 'Indonesia',
                asal_sekolah: fetchedStudentData.asal_sekolah || '',
                nomor_hp: fetchedStudentData.nomor_hp || '',
                status_siswa: fetchedStudentData.status_siswa || 'aktif',
                alamat_jalan: fetchedStudentData.alamat?.jalan || '',
                alamat_rt_rw: fetchedStudentData.alamat?.rt_rw || '',
                alamat_kelurahan_desa: fetchedStudentData.alamat?.kelurahan_desa || '',
                alamat_kecamatan: fetchedStudentData.alamat?.kecamatan || '',
                alamat_kota_kabupaten: fetchedStudentData.alamat?.kota_kabupaten || '',
                alamat_provinsi: fetchedStudentData.alamat?.provinsi || '',
                alamat_kode_pos: fetchedStudentData.alamat?.kode_pos || '',
                ortu_alamat: fetchedStudentData.orang_tua?.alamat || '',
                ortu_ayah_nama: fetchedStudentData.orang_tua?.ayah?.nama || '',
                ortu_ayah_pendidikan: fetchedStudentData.orang_tua?.ayah?.pendidikan || '',
                ortu_ayah_pekerjaan: fetchedStudentData.orang_tua?.ayah?.pekerjaan || '',
                ortu_ayah_telepon: fetchedStudentData.orang_tua?.ayah?.telepon || '',
                ortu_ibu_nama: fetchedStudentData.orang_tua?.ibu?.nama || '',
                ortu_ibu_pendidikan: fetchedStudentData.orang_tua?.ibu?.pendidikan || '',
                ortu_ibu_pekerjaan: fetchedStudentData.orang_tua?.ibu?.pekerjaan || '',
                ortu_ibu_telepon: fetchedStudentData.orang_tua?.ibu?.telepon || '',
            });
             // Set preview foto
            setPreviewUrl(fetchedStudentData.foto_profil || null);
        }

      } catch (err: any) {
        console.error("Error fetching student data:", err);
        setError("Gagal memuat data siswa: " + err.message);
        toast.error("Gagal memuat data siswa.");
      } finally {
        setPageLoading(false); // Selesai loading halaman utama
      }
    };
    fetchStudentData();
  }, [studentId]); 

  // Handler form (sama)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Handler Baru untuk File ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Batas 5MB
        toast.error("Ukuran file terlalu besar. Maksimal 5MB.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Buat preview lokal
    }
  };

  // --- Handler Submit (DIUBAH TOTAL) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_lengkap) {
      setError("Nama Lengkap wajib diisi.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Ambil URL foto yang ada sekarang (jika ada)
    const docRef = doc(db, 'students', studentId as string);
    const docSnap = await getDoc(docRef);
    let finalPhotoURL: string | null = null;
    if(docSnap.exists()) {
        finalPhotoURL = (docSnap.data() as StudentData).foto_profil || null;
    }

    // --- Langkah 1: Upload Foto (Jika ada file baru) ---
    if (selectedFile) {
      const toastId = toast.loading('Mempersiapkan unggah foto...');
      try {
        const fileExtension = selectedFile.name.split('.').pop();
        
        // 1a. Minta URL aman dari API Route
        const response = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contentType: selectedFile.type,
            fileExtension: fileExtension,
            fileName: selectedFile.name,
            prefix: `user_photo`,
          }),
        });

        if (!response.ok) {
          throw new Error((await response.json()).error || 'Gagal mendapatkan URL upload.');
        }
        
        const { uploadUrl, fileUrl } = await response.json() as { uploadUrl: string, fileUrl: string };
        
        // 1b. Upload file langsung ke Cloudflare R2
        toast.loading('Mengunggah foto...', { id: toastId });
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type },
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload ke R2 gagal.');
        }

        finalPhotoURL = fileUrl; // Sukses! Gunakan URL baru ini.
        toast.success('Foto berhasil diunggah!', { id: toastId });

      } catch (uploadError: any) {
        setError("Gagal mengunggah foto: " + uploadError.message);
        toast.error(`Gagal mengunggah foto: ${uploadError.message}`, { id: toastId });
        setLoading(false); 
        return; // Hentikan proses jika upload gagal
      }
    }
    
    // --- Langkah 2: Update Data ke Firestore ---
    try {
      const result = await updateStudentAction({
        uid: studentId,
        ...formData,
        foto_profil: finalPhotoURL, // Kirim URL foto (baru atau lama)
      });
      
      setLoading(false);

      if (result.success) {
        toast.success(result.message);
        router.push('/list/students');
        router.refresh();
      } else {
        setError(result.message); 
      }
    } catch (dbError: any) {
        setLoading(false);
        setError(dbError.message);
        toast.error(dbError.message);
    }
  };

  // Handler Tombol Batal (sama)
  const handleBatal = () => {
    if (loading) return; 
    router.push('/list/students');
  };

  if (pageLoading) {
    return (
      <div className="p-8 text-center text-gray-600">
        Memuat data siswa...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center border-b p-4 md:p-6">
          <h1 className="text-xl md:text-2xl font-semibold">
            Edit Siswa: {formData.nama_lengkap || '...'}
          </h1>
          <button 
            onClick={handleBatal} 
            disabled={loading || pageLoading}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; Kembali ke Daftar Siswa
          </button>
        </div>
        
        {/* Form diubah menjadi 'space-y-6' untuk jarak antar kartu */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
          
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4">{error}</div>
          )}

          {/* --- BAGIAN AKUN & PROFIL (Di-refactor) --- */}
          <div className="bg-white p-6 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-3 gap-6 items-start border">
              {/* Kolom 1+2: Info Profil & Akun */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Informasi Akun & Profil</h3>
                <Input name="nama_lengkap" label="Nama Lengkap (Wajib)" value={formData.nama_lengkap} onChange={handleChange} required />
                <div>
                    <label className="block text-sm font-medium text-gray-700">NISN (Tidak bisa diubah)</label>
                    <input type="text" value={formData.nisn} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Username (Otomatis)</label>
                        <input type="text" value={formData.nisn} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Password Awal (dari NISN)</label>
                        <input type="text" value={formData.nisn} readOnly className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"/>
                    </div>
                </div>
                {/* <Input name="kelas" label="Kelas" value={formData.kelas} onChange={handleChange} /> */}
                <Input name="email" label="Email (Kontak)" value={formData.email} onChange={handleChange} type="email" />
              </div>
              
              {/* Kolom 3: Upload Foto */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-center md:text-left">Foto Profil</label>
                <div className="w-40 h-40 mx-auto rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mb-2 border-2 border-gray-300">
                  {previewUrl ? (
                    <Image 
                      src={previewUrl} 
                      alt="Preview" 
                      width={160} height={160} 
                      className="object-cover w-full h-full" 
                      onError={() => setPreviewUrl(null)} // Handle jika URL R2 rusak
                    />
                  ) : (
                    <span className="text-gray-500 text-sm">Tidak Ada Foto</span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1 text-center md:text-left">Pilih foto baru untuk mengganti.</p>
              </div>
          </div>
          
          {/* --- BAGIAN DATA DIRI --- */}
          <div className="bg-white p-6 rounded-lg shadow-md space-y-4 border">
              <h3 className="text-lg font-semibold border-b pb-2">Data Diri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select name="kelas" label="Kelas (Wajib)" value={formData.kelas} onChange={handleChange} required
                         disabled={loadingClasses || classes.length === 0} // Disable saat loading/kosong
                         options={
                             loadingClasses
                             ? [{ value: formData.kelas || '', label: 'Pilih Kelas' }]
                             : classes.length === 0
                             ? [{ value: '', label: 'Tidak ada kelas'}]
                             // Opsi dari daftar kelas + pastikan kelas saat ini ada
                             : (formData.kelas && !classes.some(c=>c.id===formData.kelas) ? [{value:formData.kelas, label:`Kelas ID: ${formData.kelas} (Memuat...)`}] : [])
                               .concat(classes.map(cls => ({ value: cls.id, label: cls.nama_kelas })))
                         }
                 />
                <Input name="nis" label="NIS" value={formData.nis} onChange={handleChange} />
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
          <div className="bg-white p-6 rounded-lg shadow-md space-y-4 border">
              <h3 className="text-lg font-semibold border-b pb-2">Alamat Siswa</h3>
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
          <div className="bg-white p-6 rounded-lg shadow-md space-y-4 border">
              <h3 className="text-lg font-semibold border-b pb-2">Data Orang Tua</h3>
              <Input name="ortu_alamat" label="Alamat Orang Tua" value={formData.ortu_alamat} onChange={handleChange} />
              <h4 className="text-md font-semibold pt-2">Ayah</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input name="ortu_ayah_nama" label="Nama Ayah" value={formData.ortu_ayah_nama} onChange={handleChange} />
                <Input name="ortu_ayah_pendidikan" label="Pendidikan Ayah" value={formData.ortu_ayah_pendidikan} onChange={handleChange} />
                <Input name="ortu_ayah_pekerjaan" label="Pekerjaan Ayah" value={formData.ortu_ayah_pekerjaan} onChange={handleChange} />
                <Input name="ortu_ayah_telepon" label="Telepon Ayah" value={formData.ortu_ayah_telepon} onChange={handleChange} />
              </div>
              <h4 className="text-md font-semibold pt-2">Ibu</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input name="ortu_ibu_nama" label="Nama Ibu" value={formData.ortu_ibu_nama} onChange={handleChange} />
                <Input name="ortu_ibu_pendidikan" label="Pendidikan Ibu" value={formData.ortu_ibu_pendidikan} onChange={handleChange} />
                <Input name="ortu_ibu_pekerjaan" label="Pekerjaan Ibu" value={formData.ortu_ibu_pekerjaan} onChange={handleChange} />
                <Input name="ortu_ibu_telepon" label="Telepon Ibu" value={formData.ortu_ibu_telepon} onChange={handleChange} />
              </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <button type="button" onClick={handleBatal} disabled={loading || pageLoading}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
              Batal
            </button>
            <button type="submit" disabled={loading || pageLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[120px]">
              {loading ? 'Menyimpan...' : 'Update Siswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Helper (Tidak Berubah) ---
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
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value || ''} 
      onChange={onChange}
      required={required}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
    />
  </div>
);

type SelectProps = {
  label: string;
  name: string;
  value: string | null | undefined;
  required?: boolean;
  disabled?: boolean; 
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}

const Select = ({ label, name, value, onChange, options }: SelectProps) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
    <select
      id={name}
      name={name}
      value={value || ''} 
      onChange={onChange}
      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

