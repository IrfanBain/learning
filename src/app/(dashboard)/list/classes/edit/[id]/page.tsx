"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseConfig";
import { doc, getDoc, collection, getDocs, DocumentReference } from "firebase/firestore";
import { ClassUpdateFormData, updateClassAction } from '@/app/actions/classActions';
import { toast } from "react-hot-toast";

interface TeacherData {
  id: string;
  nama_lengkap: string;
}

interface ClassData {
  id: string;
  nama_kelas: string;
  tingkat: number;
  tahun_ajaran: string;
  wali_kelas_ref: DocumentReference | null;
}

interface PageProps {
  params: {
    id: string;
  };
}

export default function EditClassPage({ params }: PageProps) {
  const router = useRouter();
  const classId = params.id; // Menggunakan params.id dari dynamic route

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [form, setForm] = useState({
    nama_kelas: "",
    tingkat: 0,
    tahun_ajaran: "",
    wali_kelas_uid: "",
  });

  // Fetch data kelas & guru
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        if (!classId) throw new Error("ID kelas tidak ditemukan di URL.");
        // Fetch kelas
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) throw new Error("Data kelas tidak ditemukan.");
        const data = classSnap.data();
        setForm({
          nama_kelas: data.nama_kelas || classId,
          tingkat: data.tingkat || 0,
          tahun_ajaran: data.tahun_ajaran || "",
          wali_kelas_uid: data.wali_kelas_ref?.id || "",
        });
        // Fetch guru
        const teachersSnap = await getDocs(collection(db, "teachers"));
        setTeachers(
          teachersSnap.docs.map((doc) => ({
            id: doc.id,
            nama_lengkap: doc.data().nama_lengkap || doc.id,
          }))
        );
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [classId]);

  // Handle input
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "tingkat" ? Number(value) : value }));
  }

  // Handle submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!form.nama_kelas || !form.tingkat || !form.tahun_ajaran || !form.wali_kelas_uid) {
        setError("Semua field wajib diisi.");
        setSaving(false);
        return;
      }
      if (!classId) throw new Error("ID kelas tidak ditemukan.");

      const payload: ClassUpdateFormData = {
        id: classId,
        tingkat: form.tingkat,
        tahun_ajaran: form.tahun_ajaran,
        wali_kelas_uid: form.wali_kelas_uid,
      };

      const result = await updateClassAction(payload);

      if (result.success) {
        toast.success(result.message);
        router.push('/list/classes');
      } else {
        setError(result.message);
        toast.error(`Gagal: ${result.message}`);
      }

    } catch (err: any) {
      setError(err.message || String(err));
      toast.error(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-8 text-center text-blue-700">Edit Kelas</h1>
      {loading ? (
        <div className="text-center text-gray-500 text-md">Memuat data...</div>
      ) : error ? (
        <div className="text-center text-red-600 mb-6 text-md">{error}</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
          <div>
            <label className="block font-medium mb-2 text-gray-700 text-md">Nama Kelas</label>
            <input
              type="text"
              name="nama_kelas"
              value={form.nama_kelas}
              disabled
              className="w-full px-5 py-3 border rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed text-md"
            />
          </div>
          <div>
            <label className="block font-medium mb-2 text-gray-700 text-md">Tingkat</label>
            <input
              type="number"
              name="tingkat"
              value={form.tingkat}
              onChange={handleChange}
              min={1}
              max={12}
              className="w-full px-5 py-3 border rounded-lg focus:ring-2 focus:ring-blue-400 text-md"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-2 text-gray-700 text-md">Tahun Ajaran</label>
            <input
              type="text"
              name="tahun_ajaran"
              value={form.tahun_ajaran}
              onChange={handleChange}
              placeholder="2025/2026"
              className="w-full px-5 py-3 border rounded-lg focus:ring-2 focus:ring-blue-400 text-md"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-2 text-gray-700 text-md">Wali Kelas</label>
            <select
              name="wali_kelas_uid"
              value={form.wali_kelas_uid}
              onChange={handleChange}
              className="w-full px-5 py-3 border rounded-lg focus:ring-2 focus:ring-blue-400 text-md"
              required
            >
              <option value="">Pilih Wali Kelas</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.nama_lengkap}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={() => router.push('/list/classes')}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition text-md"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-md disabled:opacity-70"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      )}
    </div>
    </div>
  );
}
