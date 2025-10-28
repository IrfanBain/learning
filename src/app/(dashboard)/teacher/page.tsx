import Announcements from "@/components/Announcements";
import BigCalendar from "@/components/BigCalender";
import dynamic from "next/dynamic";
const DynamicEventCalendar = dynamic(
  () => import("@/components/EventCalendar"),
  {
    ssr: false,
    loading: () => <div style={{ height: "300px" }}>Memuat acara...</div>,
  }
);
const TeacherPage = () => {
  return (
    <div className="p-4 flex gap-4 flex-col lg:flex-row">
      {/* LEFT */}
      <div className="w-full lg:w-2/3">
        <div className="h-full bg-white p-4 rounded-md">
          <h1 className="text-xl font-semibold">Schedule</h1>
          <BigCalendar />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        <DynamicEventCalendar />
        <Announcements />
      </div>
    </div>
  );
};

export default TeacherPage;
