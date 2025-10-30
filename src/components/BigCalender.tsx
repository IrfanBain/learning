"use client";

import { Calendar, momentLocalizer, View, Views, Event } from "react-big-calendar"; // Import Event type
import moment from "moment";
import "moment/locale/id";
// HAPUS: import { calendarEvents } from "@/lib/data"; // Hapus data dummy
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";

// Perbarui setting locale 'id' (tidak berubah)
moment.updateLocale('id', { week: { dow: 1 } });
const localizer = momentLocalizer(moment);

// Pesan (tidak berubah)
const messages = { /* ... pesan ... */
  week: "Minggu ini", day: "Hari ini", previous: "<", next: ">", today: "Hari Ini", month: "Bulan", agenda: "Agenda", noEventsInRange: "Tidak ada jadwal"
};

// --- TAMBAHKAN Interface Props ---
interface BigCalendarProps {
  events: Event[]; // Terima array events dari parent
}
// ------------------------------

// --- Terima props 'events' ---
const BigCalendar = ({ events }: BigCalendarProps) => { // Terima 'events' di sini
  const [view, setView] = useState<View>(Views.WEEK); // Ubah default view ke 'week'?

  const handleOnChangeView = (selectedView: View) => {
    setView(selectedView);
  };

  return (
    <Calendar
      localizer={localizer}
      // --- Gunakan events dari props ---
      events={events} // Gunakan prop 'events'
      // -------------------------------
      startAccessor="start"
      endAccessor="end"
      // Tambahkan 'month' dan 'agenda' jika Anda mau
      views={[Views.WEEK, Views.DAY, Views.AGENDA]} // Tambah AGENDA
      defaultView={Views.WEEK} // Set default view
      view={view} // Kontrol view saat ini
      style={{ height: "600px" }} // Sesuaikan tinggi jika perlu
      onView={handleOnChangeView}
      // Batas jam (opsional, sesuaikan)
      min={moment().startOf('day').add(7, 'hours').toDate()} // Mulai jam 7 pagi
      max={moment().startOf('day').add(17, 'hours').toDate()} // Sampai jam 5 sore
      messages={messages}
      culture='id' // Set kultur eksplisit
      // Tambahkan opsi lain jika perlu (popup, event styling, etc.)
      popup // Aktifkan popup saat event diklik
      step={30} // Interval waktu di view hari/minggu (30 menit)
      timeslots={2} // Jumlah slot per step (2 slot @15 menit = 30 menit)
    />
  );
};

export default BigCalendar;

