/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "learning-app.irfannurbain.workers.dev",
      },
       {
        protocol: 'https',
        hostname: 'ac75e414db868079036abe0589c14b97.r2.cloudflarestorage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        // Ganti hostname ini dengan hostname dari URL R2 Anda
        // (Berdasarkan error Anda, ini adalah hostname-nya)
        hostname: 'pub-959fbdae8a654ba09b1992c567c1c826.r2.dev', 
        port: '',
        pathname: '/**', // Izinkan semua path file (misal: /students/...)
      },
      {
        protocol: 'https',
        // Ganti hostname ini dengan hostname dari URL R2 Anda
        // (Berdasarkan error Anda, ini adalah hostname-nya)
        hostname: 'pub-63e0b2ff258f42a095014df693ae0ba3.r2.dev', 
        port: '',
        pathname: '/**', // Izinkan semua path file (misal: /students/...)
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // <-- Add this domain
      },
      { protocol: "https",
        hostname: "images.pexels.com", 
      }],

  },
};

export default nextConfig;
