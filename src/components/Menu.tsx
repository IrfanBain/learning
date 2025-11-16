"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/context/authContext';
// import { useRouter } from "next/navigation";

const menuItems = [
  {
    title: "MENU",
    items: [
      {
        icon: "/home.png",
        label: "Beranda",
        getHref: (role: string | null) => { 
          if (role === 'admin') return '/admin';
          if (role === 'teacher') return '/teacher'; 
          if (role === 'student') return '/student';
          return '/'; 
      },
        visible: ["admin", "teacher", "student",],
      },
      {
        icon: "/teacher.png",
        label: "Guru",
        href: "/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/student.png",
        label: "Siswa",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/parent.png",
        label: "Jadwal",
        href: "/list/schedules",
        visible: ["admin"],
      },
      {
        icon: "/class.png",
        label: "Kelas",
        href: "/list/classes",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/lesson.png",
        label: "Mata Pelajaran",
        href: "/list/subjects",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: "Ujian",
        getHref: (role: string | null) => { 
          if (role === 'admin') return '/admin/examPage';
          if (role === 'teacher') return '/teacher/examsPage'; 
          if (role === 'student') return '/student/examPage';
          return '/'; 
      },
        visible: ["admin", "teacher", "student",],
      },
      {
        icon: "/assignment.png",
        label: "Tugas PR",
        getHref: (role: string | null) => { 
          if (role === 'admin') return '/admin/homework';
          if (role === 'teacher') return '/teacher/homework'; 
          if (role === 'student') return '/student/homework';
          return '/'; 
      },
        visible: ["admin", "teacher", "student",],
      },
      {
        icon: "/assignment.png",
        label: "Diskusi",
        href: "/list/discussions",
        visible: ["admin", "teacher", "student",],
      },
      {
        icon: "/result.png",
        label: "Nilai",
         getHref: (role: string | null) => { 
          if (role === 'admin') return '/admin/results';
          if (role === 'teacher') return '/teacher/results'; 
          if (role === 'student') return '/student/results';
          return '/'; 
      },
        visible: ["admin", "teacher", "student",],
      },
      // {
      //   icon: "/attendance.png",
      //   label: "Absensi",
      //   href: "/list/absensi",
      //   visible: ["admin", "teacher", "student",],
      // },
      {
        icon: "/calendar.png",
        label: "Event",
        href: "/list/events",
        visible: ["admin", "teacher", "student",],
      },
      // {
      //   icon: "/message.png",
      //   label: "Pesan",
      //   href: "/list/messages",
      //   visible: ["admin", "teacher", "student",],
      // },
      {
        icon: "/announcement.png",
        label: "Pengumuman",
        href: "/list/announcements",
        visible: ["admin", "teacher", "student",],
      },
    ],
  },
  {
    title: "LAINNYA",
    items: [
      {
        icon: "/profile.png",
        label: "Profil",
        getHref: (role: string | null) => { 
          if (role === 'teacher') return '/profile/guru'; 
          if (role === 'student') return '/profile/siswa';
          return '/'; 
      },
        visible: [ "teacher", "student",],
      },
      // {
      //   icon: "/setting.png",
      //   label: "Pengaturan",
      //   href: "/settings",
      //   visible: ["admin", "teacher", "student",],
      // },
      {
        icon: "/profile.png",
        label: "Pengguna",
        href: "/users",
        visible: ["admin"],
      },
      {
        icon: "/logout.png",
        label: "Keluar",
        href: "/logout",
        visible: ["admin", "teacher", "student",],
      },
    ],
  },
];

const Menu = () => {
  const { user, loading, logout } = useAuth();
  // const router = useRouter();
  const handleLogout = async () => {
    try {
      await logout();
      // router.push('/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  if (loading) {
     return <div>Loading menu...</div>; // Atau tampilkan skeleton
  }
  const currentRole = user?.role;
  return (
    <div className="mt-4 text-sm ">
      {menuItems.map((i) => (
        <div className="flex flex-col gap-2" key={i.title}>
          <span className="hidden lg:block text-gray-400 font-light my-4">
            {i.title}
          </span>
          {i.items.map((item) => {
            if (currentRole && item.visible.includes(currentRole)) {
              if (item.label === "Keluar") {
                return (
                  <button // Ubah dari <Link> menjadi <a> atau <button>
                    key={item.label}
                    onClick={handleLogout} // Panggil handler saat di-klik
                    className="flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-lamaSkyLight"
                    style={{ cursor: "pointer" }} // Ubah kursor jadi pointer
                  >
                    <Image src={item.icon} alt="" width={20} height={20} />
                    <span className="hidden lg:block">{item.label}</span>
                  </button>
                );
              }
              let finalHref = "/";
              if (item.getHref) {
                finalHref = item.getHref(currentRole); 
              } else if (item.href) {
                const basePath = currentRole === 'admin' ? '/admin' : currentRole === 'teacher' ? '/teacher' : currentRole === 'student' ? '/student' : '/';
                if (item.href.startsWith('/list/') || item.href === '/profile' || item.href === '/settings') {
                    finalHref = item.href; 
                } else {
                    finalHref = `${basePath}/${item.href.startsWith('/') ? item.href.substring(1) : item.href}`;
                }
              }
              return (
                <Link
                  href={finalHref}
                  key={item.label}
                  className="flex items-center justify-center lg:justify-start gap-4 text-gray-500 py-2 md:px-2 rounded-md hover:bg-lamaSkyLight"
                >
                  <Image src={item.icon} alt="" width={20} height={20} />
                  <span className="hidden lg:block">{item.label}</span>
                </Link>
              );
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
};

export default Menu;
