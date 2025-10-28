"use client";

import { Calendar, momentLocalizer, View, Views } from "react-big-calendar";
import moment from "moment";
import "moment/locale/id"; // <-- Import locale Indonesia
import { calendarEvents } from "@/lib/data";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";

// Perbarui setting locale 'id' agar minggu dimulai hari Senin (dow: 1)
// dow = Day of Week. (Minggu=0, Senin=1, Selasa=2, dst.)
moment.updateLocale('id', {
  week: {
    dow: 1, // <-- INI KUNCINYA
  },
});

const localizer = momentLocalizer(moment);

const messages = {
  week: "Minggu ini",
  day: "Hari ini",
  previous: "<",
  next: ">",
  today: "Hari Ini",
};

const BigCalendar = () => {
  const [view, setView] = useState<View>(Views.DAY);

  const handleOnChangeView = (selectedView: View) => {
    setView(selectedView);
  };

  return (
    <Calendar
      localizer={localizer}
      events={calendarEvents}
      startAccessor="start"
      endAccessor="end"
      views={["week", "day"]}
      view={view}
      style={{ height: "98%" }}
      onView={handleOnChangeView}
      min={new Date(2025, 1, 0, 8, 0, 0)}
      max={new Date(2025, 1, 0, 17, 0, 0)}
      messages={messages}
    />
  );
};

export default BigCalendar;