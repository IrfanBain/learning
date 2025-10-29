"use server";

import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from "@/lib/firebaseAdminConfig";
import { revalidatePath } from "next/cache";

// Interface untuk hasil operasi
export interface ActionResult {
  success: boolean;
  message: string;
}

// 1. INTERFACE FORM DATA (FLAT)
// Ini adalah data yang kita harapkan dari form <form>
// Kita buat 'flat' (datar) agar mudah dikelola oleh state React
export interface TeacherFormData {
  nama_lengkap: string;
  nip_nuptk: string; // Akan jadi username & password
  email: string; // Email kontak
  
  // Data Diri
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string; // YYYY-MM-DD from <input type="date">
  agama: string;
  nomor_hp: string;
  
  // Data Profesional
  status_kepegawaian: string;
  pendidikan_terakhir: string;
  almamater: string;
  jurusan_pendidikan: string;
  tanggal_mulai_kerja: string; // YYYY-MM-DD
  
  // Data Mengajar (Akan kita proses dari string)
  mata_pelajaran_diampu: string; // Cth: "mtk, fisika, biologi"
  peran: string; // Cth: "guru, staf tu"
  wali_kelas_ref: string; // String ID kelas
  
  // Data Alamat (Flat)
  alamat_jalan: string;
  alamat_rt_rw: string;
  alamat_kelurahan_desa: string;
  alamat_kecamatan: string;
  alamat_kota_kabupaten: string;
  alamat_provinsi: string;
  alamat_kode_pos: string;
}

// 2. INTERFACE UPDATE (Untuk form Edit nanti)
// Mirip dengan Create, tapi ada 'uid' dan 'foto_profil'
export interface TeacherUpdateFormData extends TeacherFormData {
  uid: string;
  foto_profil?: string | null; // URL foto dari R2
}


// 3. FUNGSI CREATE (TAMBAH)
export async function createTeacherAction(formData: TeacherFormData): Promise<ActionResult> {
  
  const { 
    nama_lengkap, nip_nuptk, email, jenis_kelamin, 
    tempat_lahir, tanggal_lahir, agama, nomor_hp,
    status_kepegawaian, pendidikan_terakhir, almamater, jurusan_pendidikan,
    tanggal_mulai_kerja, mata_pelajaran_diampu, peran, wali_kelas_ref,
    // Alamat flat
    alamat_jalan, alamat_rt_rw, alamat_kelurahan_desa, 
    alamat_kecamatan, alamat_kota_kabupaten, alamat_provinsi, alamat_kode_pos
  } = formData;
  
  // Validasi dasar
  if (!nama_lengkap || !nip_nuptk) {
    return { success: false, message: "Nama Lengkap dan NIP/NUPTK wajib diisi." };
  }
  
  // Buat kredensial login (sama seperti Siswa)
  const internalEmail = `${nip_nuptk}@sekolah.app`; // Email unik untuk login
  const initialPassword = nip_nuptk; // Password awal = NIP/NUPTK

  let uid = ''; // Siapkan variabel untuk UID

  try {
    if (initialPassword.length < 6) {
      throw new Error("NIP/NUPTK harus memiliki minimal 6 karakter untuk dijadikan password.");
    }

    // --- LANGKAH 1: Buat Akun di Firebase Authentication ---
    const userRecord = await adminAuth.createUser({
      email: internalEmail,
      password: initialPassword,
      displayName: nama_lengkap,
      disabled: false,
    });
    
    uid = userRecord.uid;

    // --- LANGKAH 2: Buat Dokumen di Koleksi 'users' ---
    // Proses string 'peran' menjadi array
    const peranArray = peran.split(',').map(p => p.trim()).filter(Boolean);
    
    await adminDb.collection("users").doc(uid).set({
      name: nama_lengkap, 
      email: internalEmail,
      username: nip_nuptk, // Username untuk login
      role: "teacher",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // --- LANGKAH 3: Buat Dokumen di Koleksi 'teachers' ---
    // Konversi string tanggal ke Timestamp
    const tanggalLahirTimestamp = tanggal_lahir 
      ? admin.firestore.Timestamp.fromDate(new Date(tanggal_lahir)) 
      : null;
    const tanggalMulaiKerjaTimestamp = tanggal_mulai_kerja
      ? admin.firestore.Timestamp.fromDate(new Date(tanggal_mulai_kerja))
      : null;
      
    // Proses string 'mata_pelajaran' menjadi array
    const mapelArray = mata_pelajaran_diampu.split(',').map(m => m.trim()).filter(Boolean);

    await adminDb.collection("teachers").doc(uid).set({
      nama_lengkap,
      nip_nuptk,
      email: email || null, // Email kontak
      
      jenis_kelamin: jenis_kelamin || null,
      tempat_lahir: tempat_lahir || null,
      tanggal_lahir: tanggalLahirTimestamp,
      agama: agama || null,
      nomor_hp: nomor_hp || null,
      
      status_kepegawaian: status_kepegawaian || null,
      pendidikan_terakhir: pendidikan_terakhir || null,
      almamater: almamater || null,
      jurusan_pendidikan: jurusan_pendidikan || null,
      tanggal_mulai_kerja: tanggalMulaiKerjaTimestamp,
      
      mata_pelajaran_diampu: mapelArray, // Simpan sebagai array
      peran: peranArray, // Simpan sebagai array
      wali_kelas_ref: wali_kelas_ref || null,
      
      foto_profil: null, // Default saat create
      
      // Susun Map 'alamat'
      alamat: {
        jalan: alamat_jalan || null,
        rt_rw: alamat_rt_rw || null,
        kelurahan_desa: alamat_kelurahan_desa || null,
        kecamatan: alamat_kecamatan || null,
        kota_kabupaten: alamat_kota_kabupaten || null,
        provinsi: alamat_provinsi || null,
        kode_pos: alamat_kode_pos || null,
      },
    });
    
    // Sesuaikan path ini jika beda (misal: /listguru)
    revalidatePath("/listteachers"); 
    
    return { success: true, message: `Guru ${nama_lengkap} berhasil dibuat.` };

  } catch (error: any) {
    console.error("Error creating teacher:", error);
    
    // Rollback: Hapus user Auth jika gagal simpan ke DB
    if (uid) {
      await adminAuth.deleteUser(uid);
      console.log(`Rollback: Deleted auth user ${uid} due to error.`);
    }

    if (error.code === 'auth/email-already-exists') {
      return { success: false, message: `Gagal: NIP/NUPTK (${internalEmail}) ini sudah terdaftar.` };
    }
    
    return { success: false, message: `Gagal: ${error.message}` };
  }
}

// 4. FUNGSI UPDATE (Disiapkan untuk nanti)
// Logikanya sama persis dengan updateStudentAction
export async function updateTeacherAction(formData: TeacherUpdateFormData): Promise<ActionResult> {
  
  const { uid, foto_profil, ...profileData } = formData;

  if (!uid) {
    return { success: false, message: "UID Guru tidak ditemukan." };
  }

  try {
    // --- LANGKAH 1: Update Firebase Authentication ---
    await adminAuth.updateUser(uid, {
      displayName: profileData.nama_lengkap,
    });

    // --- LANGKAH 2: Update Dokumen di Koleksi 'users' ---
    const peranArray = profileData.peran.split(',').map(p => p.trim()).filter(Boolean);
    await adminDb.collection("users").doc(uid).update({
      name: profileData.nama_lengkap,
      role: "teacher",
    });

    // --- LANGKAH 3: Update Dokumen di Koleksi 'teachers' ---
    const tanggalLahirTimestamp = profileData.tanggal_lahir
      ? admin.firestore.Timestamp.fromDate(new Date(profileData.tanggal_lahir)) 
      : null;
    const tanggalMulaiKerjaTimestamp = profileData.tanggal_mulai_kerja
      ? admin.firestore.Timestamp.fromDate(new Date(profileData.tanggal_mulai_kerja))
      : null;
    const mapelArray = profileData.mata_pelajaran_diampu.split(',').map(m => m.trim()).filter(Boolean);
      
    // Susun ulang data untuk disimpan
    const teacherDbPayload = {
      nama_lengkap: profileData.nama_lengkap,
      nip_nuptk: profileData.nip_nuptk, // Seharusnya tidak berubah
      email: profileData.email || null,
      jenis_kelamin: profileData.jenis_kelamin || null,
      tempat_lahir: profileData.tempat_lahir || null,
      tanggal_lahir: tanggalLahirTimestamp,
      agama: profileData.agama || null,
      nomor_hp: profileData.nomor_hp || null,
      status_kepegawaian: profileData.status_kepegawaian || null,
      pendidikan_terakhir: profileData.pendidikan_terakhir || null,
      almamater: profileData.almamater || null,
      jurusan_pendidikan: profileData.jurusan_pendidikan || null,
      tanggal_mulai_kerja: tanggalMulaiKerjaTimestamp,
      mata_pelajaran_diampu: mapelArray,
      peran: peranArray,
      wali_kelas_ref: profileData.wali_kelas_ref || null,

      // Hanya update 'foto_profil' jika nilainya dikirim (bukan undefined)
      ...(foto_profil !== undefined && { foto_profil: foto_profil }),
      
      alamat: {
        jalan: profileData.alamat_jalan || null,
        rt_rw: profileData.alamat_rt_rw || null,
        kelurahan_desa: profileData.alamat_kelurahan_desa || null,
        kecamatan: profileData.alamat_kecamatan || null,
        kota_kabupaten: profileData.alamat_kota_kabupaten || null,
        provinsi: profileData.alamat_provinsi || null,
        kode_pos: profileData.alamat_kode_pos || null,
      },
    };
    
    await adminDb.collection("teachers").doc(uid).update(teacherDbPayload);

    revalidatePath("/listteachers"); 
    revalidatePath(`/listteachers/${uid}/edit`); // (Sesuaikan path ini jika perlu)
    
    return { success: true, message: `Data ${profileData.nama_lengkap} berhasil diupdate.` };

  } catch (error: any) {
    console.error("Error updating teacher:", error);
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

// 5. FUNGSI DELETE (Disiapkan untuk nanti)
// Logikanya sama persis dengan deleteStudentAction
export async function deleteTeacherAction(uid: string): Promise<ActionResult> {
  
  try {
    // 1. Hapus dokumen dari Koleksi 'teachers'
    await adminDb.collection("teachers").doc(uid).delete();

    // 2. Hapus dokumen dari Koleksi 'users'
    await adminDb.collection("users").doc(uid).delete();
    
    // 3. Hapus akun dari Firebase Authentication
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.warn(`User ${uid} not found in Auth, but deleted from Firestore.`);
      } else {
        throw authError; // Lemparkan error lain
      }
    }

    revalidatePath("/listteachers"); 

    return { success: true, message: "Guru berhasil dihapus." };

  } catch (error: any) {
    console.error("Error deleting teacher:", error);
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}
