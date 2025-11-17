"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // <-- Sesuaikan path ke firebase Anda

// Tipe data untuk Latihan (sesuaikan jika perlu)
interface Latihan {
  id: string;
  judul: string; // Ganti 'judul' dengan field Anda
  tanggal_dibuat_formatted?: string; // Field opsional
}

const LatihanTerbaru = () => {
  const [latihan, setLatihan] = useState<Latihan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatihan = async () => {
      try {
        const examsCol = collection(db, "exams");
        // GANTI 'tanggal_dibuat' dengan field timestamp Anda
        const q = query(
          examsCol,
          orderBy("tanggal_dibuat", "desc"), // 'desc' = terbaru dulu
          limit(3) // Ambil 3 saja
        );

        const snapshot = await getDocs(q);
        const latihanList: Latihan[] = snapshot.docs.map(doc => ({
          id: doc.id,
          judul: doc.data().judul || "Tanpa Judul",
          tanggal_dibuat_formatted: doc.data().tanggal_dibuat?.toDate().toLocaleDateString("id-ID")
        }));
        
        setLatihan(latihanList);
      } catch (error) {
        console.error("Error fetching exams: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatihan();
  }, []);

  if (loading) {
    return <div className="p-4 bg-white rounded-lg shadow">Memuat Ujian...</div>;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Ujian Baru Ditambahkan</h2>
        {/* <span className="text-sm text-blue-500 cursor-pointer">Lihat Semua</span> */}
      </div>
      
      {/* Daftar Latihan */}
      <div className="space-y-3">
        {latihan.length > 0 ? (
          latihan.map((item) => (
            <div key={item.id} className="p-3 bg-purple-100 rounded-lg">
              <h3 className="font-semibold text-purple-800">{item.judul}</h3>
              {item.tanggal_dibuat_formatted && (
                <p className="text-sm text-gray-600">
                  Dibuat: {item.tanggal_dibuat_formatted}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">Belum ada Ujian baru.</p>
        )}
      </div>
    </div>
  );
};

export default LatihanTerbaru;