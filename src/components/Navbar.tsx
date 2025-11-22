"use client"

import Image from "next/image"
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/authContext';
import Link from "next/link";

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
     
      {/* ICONS AND USER */}
        <div className='flex items-center gap-6 justify-end w-full'>   
          <div className='flex flex-col'>
            <span className="text-xs leading-3 font-medium">{user.name}</span>
            <span className="text-[10px] text-gray-500 text-right">{user.role}</span>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-green-500 flex items-center justify-center text-white font-bold">
            {/* <Link href="/profile"> */}
          {user.foto_profil ? (
            // Jika ada foto, tampilkan
            <Image
              src={user.foto_profil}
              alt="Foto Profil"
              width={100}
              height={100}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            // Jika tidak ada, tampilkan inisial
            <span>{getInitials(user.name)}</span>
          )}
          {/* </Link> */}
          </div>
        </div>
    </div>
  )
}

export default Navbar