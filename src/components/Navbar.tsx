"use client"

import Image from "next/image"
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/authContext';

const Navbar = () => {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const showSearchBar = pathname !== '/profile'; 

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-3 w-16 bg-gray-200 rounded mt-1 animate-pulse"></div>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }
  if (!user) {
    return null; // atau tampilkan sesuatu yang lain jika user tidak ada
  }
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className='flex items-center justify-between p-4'>
      {/* SEARCH BAR */}
      {showSearchBar && (
      <div className='hidden md:flex items-center gap-2 text-xs rounded-full ring-[1.5px] ring-gray-300 px-2'>
        <Image src="/search.png" alt="" width={14} height={14}/>
        <input type="text" placeholder="Search..." className="w-[200px] p-2 bg-transparent outline-none"/>
      </div>
      )}
      {/* ICONS AND USER */}
      <div className='flex items-center gap-6 justify-end w-full'>
        <div className='bg-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer'>
          <Image src="/message.png" alt="" width={20} height={20}/>
        </div>
        <div className='bg-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer relative'>
          <Image src="/announcement.png" alt="" width={20} height={20}/>
          <div className='absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center bg-purple-500 text-white rounded-full text-xs'>1</div>
        </div>
        <div className='flex flex-col'>
          <span className="text-xs leading-3 font-medium">{user.name}</span>
          <span className="text-[10px] text-gray-500 text-right">{user.role}</span>
        </div>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-green-500 flex items-center justify-center text-white font-bold">
        {user.photoURL ? (
          // Jika ada foto, tampilkan
          <Image
            src={user.photoURL}
            alt="Foto Profil"
            width={40}
            height={40}
            className="object-cover"
          />
        ) : (
          // Jika tidak ada, tampilkan inisial
          <span>{getInitials(user.name)}</span>
        )}
      </div>
        {/* <Image src="/avatar.png" alt="" width={36} height={36} className="rounded-full"/> */}
      </div>
    </div>
  )
}

export default Navbar