"use client";

import { useState } from "react";
import Calendar from "react-calendar";
// Kita tidak import 'react-calendar/dist/Calendar.css'
// karena kita pakai style kustom di bawah

// Tipe Kalender
type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const CalendarWidget = () => {
  const [value, onChange] = useState<Value>(new Date());

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
      {/* --- Style Kustom untuk Kalender --- */}
      <style jsx global>{`
        .custom-calendar {
          border: none;
          width: 100%;
          font-family: 'Inter', sans-serif;
        }
        .custom-calendar .react-calendar__navigation {
          display: flex;
          margin-bottom: 0.5rem;
        }
        .custom-calendar .react-calendar__navigation button {
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.5rem;
          border-radius: 0.375rem;
          background: none;
        }
        .custom-calendar .react-calendar__navigation button:hover {
          background-color: #f3f4f6;
        }
        .custom-calendar .react-calendar__month-view__weekdays {
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          color: #6b7280;
          text-decoration: none;
        }
        .custom-calendar .react-calendar__tile {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 36px;
          border-radius: 0.375rem;
          background: none;
          border: none;
        }
        .custom-calendar .react-calendar__tile:hover {
          background-color: #f3f4f6;
        }
        .custom-calendar .react-calendar__tile--now {
          background-color: #eff6ff; /* bg-blue-50 */
          color: #2563eb; /* text-blue-600 */
          font-weight: 700;
        }
        .custom-calendar .react-calendar__tile--active {
          background-color: #2563eb !important; /* bg-blue-600 */
          color: white !important;
        }
        .custom-calendar .react-calendar__month-view__days__day--neighboringMonth {
          color: #d1d5db; /* text-gray-300 */
        }
        /* CSS untuk hari Minggu (Minggu) menjadi merah */
        .custom-calendar .react-calendar__month-view__weekdays__weekday:last-child {
          color: #EF4444; /* text-red-500 */
        }
        .custom-calendar .react-calendar__month-view__days__day:nth-child(7n) {
          color: #EF4444; /* text-red-500 */
        }
        .custom-calendar .react-calendar__month-view__days__day--neighboringMonth:nth-child(7n) {
          color: #FCA5A5; /* text-red-300 */
        }
      `}</style>

      <Calendar 
          onChange={onChange} 
          value={value} 
          className="custom-calendar"
          view="month"
          locale="id-ID" // Memulai hari Senin (Sen)
      />
    </div>
  );
};

export default CalendarWidget;

