import Menu from "@/components/Menu";
import Navbar from "@/components/Navbar";
import AuthGuard from "@/components/AuthGuard";
import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT */}
      <div className="w-[14%] md:w-[8%] lg:w-[16%] xl:w-[14%] flex flex-col p-4">
        <Link
          href="/"
          className="flex items-center justify-center lg:justify-start gap-2"
        >
          <Image src="/logo.png" alt="logo" width={32} height={32} />
          <span className="hidden lg:block font-bold">E-Learning</span>
        </Link>
        <div className="mt-4 flex-1 overflow-y-auto min-h-0">
          <Menu />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-[86%] md:w-[92%] lg:w-[84%] xl:w-[86%] bg-[#F7F8FA] flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
          <AuthGuard>
            {children}
          </AuthGuard>
        </main>
      </div>
    </div>
  );
}
