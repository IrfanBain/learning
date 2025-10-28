import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/authContext'; 
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "E-Learning MTs Al-Khairiyah",
  description: "Sistem Informasi Pembelajaran Online Al-Khairiyah",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id"> {/* Ganti lang ke 'id' jika targetnya Indonesia */}
      <body className={inter.className}>
        <Toaster 
          position="top-left" // Atur posisi (opsional)
          toastOptions={{
            duration: 3000, // Durasi 3 detik
          }} 
        />
        {/* --- TAMBAHKAN WRAPPER INI --- */}
        <AuthProvider> 
          {children}
        </AuthProvider>
        {/* --- AKHIR WRAPPER --- */}
      </body>
    </html>
  );
}