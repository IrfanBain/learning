"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { collection, getDocs, query, orderBy, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // Pastikan path benar
import { ScheduleFormData, createScheduleAction } from '@/app/actions/schedulesActions'; // Impor action & interface
import { ActionResult } from '@/app/actions/teacherActions'; // Impor Tipe Hasil
import { FiArrowLeft } from 'react-icons/fi';

// Interface Opsi Dropdown
interface Option { value: string; label: string; }
interface TeacherOption { value: string; label: string; } // Bisa dipisah jika perlu data guru lain
interface ClassOption { value: string; label: string; }
interface SubjectOption { value: string; label: string; }

// Opsi Hari
const HARI_OPTIONS: Option[] = [
    { value: "Senin", label: "Senin" }, { value: "Selasa", label: "Selasa" },
    { value: "Rabu", label: "Rabu" }, { value: "Kamis", label: "Kamis" },
    { value: "Jumat", label: "Jumat" }, { value: "Sabtu", label: "Sabtu" },
    // { value: "Minggu", label: "Minggu" }, // Jika perlu
];

// Nilai Awal Form
const currentYear = new Date().getFullYear();
const initialState: ScheduleFormData = {
  hari: 'Senin',
  jam_mulai: '07:00',
  jam_selesai: '08:30',
  kelas_id: '',
  mapel_id: '',
  guru_id: '',
  tahun_ajaran: `${currentYear}/${currentYear + 1}`,
  jumlah_jam_pelajaran: 2, // Default 2 JP
  ruangan: '',
};

export default function CreateSchedulePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ScheduleFormData>(initialState);

  // State untuk data dropdown
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  // State UI
  const [loading, setLoading] = useState(false); // Submit loading
  const [dataLoading, setDataLoading] = useState(true); // Loading fetch data dropdown
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Data untuk Dropdown (Kelas, Mapel, Guru) ---
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        // Fetch Kelas
        const classQuery = query(collection(db, "classes"), orderBy("tingkat"), orderBy("nama_kelas"));
        const classSnap = await getDocs(classQuery);
        const classList = classSnap.docs.map(doc => ({ value: doc.id, label: doc.data().nama_kelas || doc.id }));
        setClasses(classList);
        // Set default jika ada kelas
        if (classList.length > 0 && !formData.kelas_id) {
             setFormData(prev => ({ ...prev, kelas_id: classList[0].value }));
        }


        // Fetch Mapel
        const subjectQuery = query(collection(db, "subjects"), orderBy("urutan"), orderBy("nama_mapel"));
        const subjectSnap = await getDocs(subjectQuery);
        const subjectList = subjectSnap.docs.map(doc => ({ value: doc.id, label: doc.data().nama_mapel || doc.id }));
        setSubjects(subjectList);
         // Set default jika ada mapel
        if (subjectList.length > 0 && !formData.mapel_id) {
             setFormData(prev => ({ ...prev, mapel_id: subjectList[0].value }));
        }


        // Fetch Guru
        const teacherQuery = query(collection(db, "teachers"), orderBy("nama_lengkap"));
        const teacherSnap = await getDocs(teacherQuery);
        const teacherList = teacherSnap.docs.map(doc => ({ value: doc.id, label: doc.data().nama_lengkap || doc.id }));
        setTeachers(teacherList);
         // Set default jika ada guru
        if (teacherList.length > 0 && !formData.guru_id) {
             setFormData(prev => ({ ...prev, guru_id: teacherList[0].value }));
        }


      } catch (err) {
        console.error("Error fetching dropdown data:", err);
        toast.error("Gagal memuat data Kelas/Mapel/Guru.");
        setError("Gagal memuat data untuk dropdown.");
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Hanya fetch sekali

  // Handler perubahan input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'jumlah_jam_pelajaran' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  // Handler Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     // Validasi di client
     if (!formData.hari || !formData.jam_mulai || !formData.jam_selesai || !formData.kelas_id || !formData.mapel_id || !formData.guru_id || !formData.tahun_ajaran || formData.jumlah_jam_pelajaran <= 0) {
      setError("Semua field (kecuali ruangan) wajib diisi dengan benar.");
      toast.error("Pastikan semua field terisi dengan benar.");
      return;
    }
     const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
     if (!timeRegex.test(formData.jam_mulai) || !timeRegex.test(formData.jam_selesai)) {
         setError("Format jam salah (HH:MM)."); toast.error("Format jam salah."); return;
     }
     if (formData.jam_selesai <= formData.jam_mulai) {
         setError("Jam selesai harus setelah jam mulai."); toast.error("Jam selesai salah."); return;
     }
      if (!/^\d{4}\/\d{4}$/.test(formData.tahun_ajaran)) {
          setError("Format Tahun Ajaran salah (YYYY/YYYY)."); toast.error("Format Tahun Ajaran salah."); return;
      }


    setLoading(true); setError(null);
    const result: ActionResult = await createScheduleAction(formData);
    setLoading(false);

    if (result.success) {
      toast.success(result.message);
      router.push('/list/schedules'); // Arahkan ke daftar jadwal (sesuaikan path)
      router.refresh();
    } else {
      setError(result.message);
      toast.error(`Gagal: ${result.message}`);
    }
  };

  // Handler Batal
  const handleBatal = () => { if (!loading) router.push('/list/schedules'); }; // Sesuaikan path

  return (
    <div className="container mx-auto p-4 md:p-8">
       <button onClick={handleBatal} disabled={loading || dataLoading} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 self-start">
        <FiArrowLeft /> Kembali ke Daftar Jadwal
      </button>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto border border-gray-200"> {/* Lebar disesuaikan */}
        <div className="border-b p-4 md:p-6"><h1 className="text-xl md:text-2xl font-semibold text-gray-800">Tambah Jadwal Pelajaran Baru</h1></div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
          {error && ( <div className="p-3 bg-red-100 text-red-700 rounded-md border border-red-200 text-sm">{error}</div> )}

          {/* Hari & Tahun Ajaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select name="hari" label="Hari*" value={formData.hari} onChange={handleChange} required options={HARI_OPTIONS} />
              <Input name="tahun_ajaran" label="Tahun Ajaran*" value={formData.tahun_ajaran} onChange={handleChange} required placeholder="YYYY/YYYY"/>
          </div>

           {/* Jam Mulai, Selesai, Jumlah JP */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <Input name="jam_mulai" label="Jam Mulai*" value={formData.jam_mulai} onChange={handleChange} type="time" required />
             <Input name="jam_selesai" label="Jam Selesai*" value={formData.jam_selesai} onChange={handleChange} type="time" required />
             <Input name="jumlah_jam_pelajaran" label="Jumlah JP*" value={String(formData.jumlah_jam_pelajaran)} onChange={handleChange} type="number" required min="1" />
           </div>

           {/* Dropdown Kelas, Mapel, Guru */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <Select name="kelas_id" label="Kelas*" value={formData.kelas_id} onChange={handleChange} required disabled={dataLoading || classes.length === 0}
                       options={ dataLoading ? [{value:'', label:'Memuat...'}] : classes.length === 0 ? [{value:'', label:'Kosong'}] : classes } />

               <Select name="mapel_id" label="Mata Pelajaran*" value={formData.mapel_id} onChange={handleChange} required disabled={dataLoading || subjects.length === 0}
                       options={ dataLoading ? [{value:'', label:'Memuat...'}] : subjects.length === 0 ? [{value:'', label:'Kosong'}] : subjects } />

               <Select name="guru_id" label="Guru Pengajar*" value={formData.guru_id} onChange={handleChange} required disabled={dataLoading || teachers.length === 0}
                       options={ dataLoading ? [{value:'', label:'Memuat...'}] : teachers.length === 0 ? [{value:'', label:'Kosong'}] : teachers } />
           </div>
            {(classes.length === 0 || subjects.length === 0 || teachers.length === 0) && !dataLoading && (
                <p className="text-xs text-yellow-600 -mt-3">Pastikan data Kelas, Mapel, dan Guru sudah ada.</p>
            )}


           {/* Ruangan (Opsional) */}
           <Input name="ruangan" label="Ruangan (Opsional)" value={formData.ruangan || ''} onChange={handleChange} placeholder="Cth: Lab IPA, R.101"/>


          {/* Tombol Aksi */}
          <div className="flex justify-end gap-4 pt-5 border-t mt-6">
            <button type="button" onClick={handleBatal} disabled={loading || dataLoading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Batal</button>
            <button type="submit" disabled={loading || dataLoading || classes.length === 0 || subjects.length === 0 || teachers.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 min-w-[150px] transition-colors">
              {loading ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Helper (Input & Select) ---
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
      {/* Tambahkan placeholder jika opsi pertama bukan value kosong ATAU jika disabled */}
      {(options.length === 0 || options[0]?.value !== '' || disabled) && <option value="" disabled={required}> -- Pilih -- </option>}
      {options.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))}
    </select>
  </div>
);
// --- AKHIR KOMPONEN HELPER ---
