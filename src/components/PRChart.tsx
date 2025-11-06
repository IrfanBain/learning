"use client";
import Image from "next/image";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis, // <-- Pastikan ini di-import
} from "recharts";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // Sesuaikan path ini

const PRChart = () => {
  // --- STATE ---
  const [totalTugasCount, setTotalTugasCount] = useState(0); // Untuk di tengah
  const [terkumpulCount, setTerkumpulCount] = useState(0); // Untuk chart & kiri bawah
  const [rataRataNilai, setRataRataNilai] = useState(0); // Untuk chart & kanan bawah
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. HITUNG TOTAL TUGAS (untuk di tengah lingkaran)
        const homeworkCol = collection(db, "homework");
        const homeworkSnapshot = await getDocs(homeworkCol);
        const totalTugas = homeworkSnapshot.size;
        setTotalTugasCount(totalTugas);

        // 2. HITUNG PENGUMPULAN & RATA-RATA NILAI
        const submissionCol = collection(db, "homework_submissions");
        const submissionSnapshot = await getDocs(submissionCol);
        
        const totalTerkumpul = submissionSnapshot.size;
        setTerkumpulCount(totalTerkumpul);

        // Hitung Rata-rata Nilai
        let totalNilai = 0;
        let jumlahPenilaian = 0;

        submissionSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.nilai_tugas && typeof data.nilai_tugas === 'number') {
            totalNilai += data.nilai_tugas;
            jumlahPenilaian++;
          }
        });

        const avg = jumlahPenilaian > 0 ? totalNilai / jumlahPenilaian : 0;
        setRataRataNilai(avg);

      } catch (error) {
        console.error("Error fetching stats data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- PERUBAHAN 1: Data untuk chart ---
  // Sekarang berisi 2 bar
  const chartData = [
    {
      name: "Terkumpul",
      count: terkumpulCount, // Angka terkumpul (cth: 5)
      fill: "#C3EBFA", // BIRU MUDA
    },
    {
      name: "Rata-rata",
      count: rataRataNilai, // Angka rata-rata (cth: 21.2)
      fill: "#FAE27C", // KUNING
    },
  ];

  // Hitung persentase untuk di bawah (logika ini tetap sama)
  const persenTerkumpul = totalTugasCount > 0 ? Math.round((terkumpulCount / totalTugasCount) * 100) : 0;

  if (loading) {
     return (
       <div className="bg-white rounded-xl w-full h-full p-4 flex justify-center items-center">
         <p className="text-gray-500">Memuat data PR...</p>
       </div>
     );
   }

  return (
    <div className="bg-white rounded-xl w-full h-full p-4">
      {/* TITLE - Ambil dari gambar pertama */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">PR Siswa</h1>
        <Image src="/moreDark.png" alt="" width={20} height={20} />
      </div>

      {/* CHART */}
      <div className="relative w-full h-[75%]">
        <ResponsiveContainer>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="40%" // <-- Bar luar akan 80-100%
            outerRadius="100%"
            barSize={15} // <-- Ukuran bar individu
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            {/* --- PERUBAHAN 2: Skala/Domain Chart --- */}
            <PolarAngleAxis
              type="number"
              domain={[0, 100]} // <-- DIUBAH KE 100 (skala nilai)
              tick={false}
              axisLine={false}
            />

            <RadialBar
              background // Ini akan memberi background abu-abu muda
              dataKey="count"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          {/* Angka di tengah tetap Total PR */}
          <h1 className="text-xl font-bold">{totalTugasCount}</h1>
          <span className="text-xs text-gray-400">Total PR</span>
        </div>
      </div>
      
      {/* BOTTOM - (Tidak ada perubahan, sudah benar) */}
      <div className="flex justify-center gap-16">
        {/* Kiri: Terkumpul */}
        <div className="flex flex-col gap-1">
          <div style={{ backgroundColor: '#C3EBFA' }} className="w-5 h-5 rounded-full" />
          <h1 className="font-bold">{terkumpulCount}</h1>
          <h2 className="text-xs text-gray-300">
            Terkumpul ({persenTerkumpul}%)
          </h2>
        </div>
        {/* Kanan: Rata-rata Nilai */}
        <div className="flex flex-col gap-1">
          <div style={{ backgroundColor: '#FAE27C' }} className="w-5 h-5 rounded-full" />
          <h1 className="font-bold">{rataRataNilai.toFixed(1)}</h1>
          <h2 className="text-xs text-gray-300">
            Rata-rata Nilai
          </h2>
        </div>
      </div>
    </div>
  );
};

export default PRChart;