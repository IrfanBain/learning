// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server'; // Import type NextRequest

// Beri type pada parameter 'request'
export function middleware(request: NextRequest) {
  // 1. Ambil status maintenance dari Environment Variable
  //    (process.env.MAINTENANCE_MODE akan selalu string atau undefined)
  const isInMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

  // 2. Jika mode maintenance AKTIF...
  if (isInMaintenanceMode) {
    // ...dan pengguna BELUM berada di halaman /maintenance...
    if (request.nextUrl.pathname !== '/maintenance') {
      
      // ...tampilkan halaman maintenance tanpa mengubah URL di browser
      return NextResponse.rewrite(new URL('/maintenance', request.url));
    }
  }

  // 3. Jika mode maintenance MATI, biarkan pengguna lanjut
  return NextResponse.next();
}

// Config: Tentukan di mana saja middleware ini harus berjalan
export const config = {
  matcher: [
    /*
     * Cocokkan semua path KECUALI:
     * - /maintenance (halaman maintenance itu sendiri)
     * - /api (API routes)
     * - _next/static (file-file aset)
     * - _next/image (file-file gambar)
     * - favicon.ico (ikon website)
     */
    '/((?!maintenance|api|_next/static|_next/image|favicon.ico).*)',
  ],
};