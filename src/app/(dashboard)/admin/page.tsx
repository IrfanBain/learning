import Announcements from "@/components/Announcements";
import AttendanceChart from "@/components/AttendanceChart";
import PRChart from "@/components/PRChart";
import EventCalendar from "@/components/EventCalendar";
import FinanceChart from "@/components/FinanceChart";
import UserCard from "@/components/UserCard";
import CalendarWidget from "@/components/CalendarWidget";
import TugasTerbaru from "@/components/TugasTerbaru";
import LatihanTerbaru from "@/components/LatihanTerbaru";

const AdminPage = () => {
  return (
    <div className="p-4 flex gap-4 flex-col md:flex-row">
    
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
       
        <div className="flex gap-4 justify-between flex-wrap">
          <UserCard type="siswa" />
          <UserCard type="guru" />
          <UserCard type="kelas" />
        </div>
      
        <div className="flex gap-4 flex-col lg:flex-row">
        
          <div className="w-full lg:w-1/3 h-[450px]">
            <PRChart />
          </div>
        
          <div className="w-full lg:w-2/3 h-[450px]">
            <AttendanceChart />
          </div>
        </div>
       
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* <FinanceChart /> */}
          <TugasTerbaru />
          <LatihanTerbaru />
        </div>
      </div>
     
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        <CalendarWidget />
        <EventCalendar />
        <Announcements/>
      </div>
    </div>
  );
};

export default AdminPage;
