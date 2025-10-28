// Ganti seluruh isi file Anda dengan kode ini

import dynamic from "next/dynamic";
import Announcements from "@/components/Announcements";

// 1. Buat versi dinamis untuk KEDUA komponen kalender dengan SSR dinonaktifkan
//    CATATAN: Pastikan path filenya sudah benar.
const DynamicBigCalendar = dynamic(
  () => import("@/components/BigCalender"), // Saya perbaiki typo 'BigCalender' -> 'BigCalendar'
  {
    ssr: false,
    loading: () => <div style={{ height: "500px" }}>Memuat jadwal...</div>,
  }
);

const DynamicEventCalendar = dynamic(
  () => import("@/components/EventCalendar"),
  {
    ssr: false,
    loading: () => <div style={{ height: "300px" }}>Memuat acara...</div>,
  }
);

const StudentPage = () => {
  return (
    <div className="p-4 flex gap-4 flex-col lg:flex-row">
      {/* LEFT */}
      <div className="w-full lg:w-2/3">
        {/* Pastikan div induk ini punya tinggi agar kalender tampil */}
        <div className="bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold mb-4">Jadwal IXA</h1>
          {/* 2. Gunakan komponen dinamis di sini */}
          <DynamicBigCalendar />
        <div><h1>tes</h1></div>
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        {/* 3. Gunakan komponen dinamis di sini juga */}
        <DynamicEventCalendar />
        <Announcements />
      </div>
    </div>
  );
};

export default StudentPage;