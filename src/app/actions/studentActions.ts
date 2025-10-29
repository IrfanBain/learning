"use server";

import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from "@/lib/firebaseAdminConfig";
import { revalidatePath } from "next/cache";
// Kita asumsikan 'StudentFormData' diimpor dari file 'create' page
import { StudentFormData } from '@/app/(dashboard)/list/students/create/page'; // (Perbarui path jika perlu)

interface ActionResult {
  success: boolean;
  message: string;
}

// === INTERFACE DIPERBARUI ===
export interface StudentUpdateFormData {
  uid: string;
  nama_lengkap: string;
  nisn: string; 
  nis: string;
  kelas: string;
  email: string;
  jenis_kelamin: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  agama: string;
  kewarganegaraan: string;
  asal_sekolah: string;
  nomor_hp: string;
  status_siswa: string;
  alamat_jalan: string;
  alamat_rt_rw: string;
  alamat_kelurahan_desa: string;
  alamat_kecamatan: string;
  alamat_kota_kabupaten: string;
  alamat_provinsi: string;
  alamat_kode_pos: string;
  ortu_alamat: string;
  ortu_ayah_nama: string;
  ortu_ayah_pendidikan: string;
  ortu_ayah_pekerjaan: string;
  ortu_ayah_telepon: string;
  ortu_ibu_nama: string;
  ortu_ibu_pendidikan: string;
  ortu_ibu_pekerjaan: string;
  ortu_ibu_telepon: string;
  foto_profil?: string | null; // <-- TAMBAHAN: Foto URL dari Cloudflare R2
}

// --- FUNGSI CREATE (TIDAK BERUBAH) ---
export async function createStudentAction(formData: StudentFormData): Promise<ActionResult> {
  
  const { 
    nama_lengkap, nisn, nis, kelas, email, jenis_kelamin, 
    tempat_lahir, tanggal_lahir, agama, kewarganegaraan, 
    asal_sekolah, nomor_hp, status_siswa,
    alamat_jalan, alamat_rt_rw, alamat_kelurahan_desa, 
    alamat_kecamatan, alamat_kota_kabupaten, alamat_provinsi, alamat_kode_pos,
    ortu_ayah_nama, ortu_ayah_pendidikan, ortu_ayah_pekerjaan, ortu_ayah_telepon,
    ortu_ibu_nama, ortu_ibu_pendidikan, ortu_ibu_pekerjaan, ortu_ibu_telepon,
    ortu_alamat
  } = formData;
  
  const internalEmail = `${nisn}@sekolah.app`; 
  const initialPassword = nisn; 

  let uid = ''; 

  try {
    if (initialPassword.length < 6) {
      throw new Error("NISN harus memiliki minimal 6 karakter untuk dijadikan password.");
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
    await adminDb.collection("users").doc(uid).set({
      name: nama_lengkap, 
      email: internalEmail,
      username: nisn, 
      role: "student",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const classRef = adminDb.collection("classes").doc(kelas);

    // --- LANGKAH 3: Buat Dokumen di Koleksi 'students' ---
    const tanggalLahirTimestamp = tanggal_lahir 
      ? admin.firestore.Timestamp.fromDate(new Date(tanggal_lahir)) 
      : null;

    await adminDb.collection("students").doc(uid).set({
      nama_lengkap: nama_lengkap,
      nisn: nisn,
      nis: nis || null,
      kelas: kelas || null,
      email: email || null, 
      jenis_kelamin: jenis_kelamin || null,
      tempat_lahir: tempat_lahir || null,
      tanggal_lahir: tanggalLahirTimestamp,
      agama: agama || null,
      kewarganegaraan: kewarganegaraan || null,
      asal_sekolah: asal_sekolah || null,
      nomor_hp: nomor_hp || null,
      status_siswa: status_siswa || "aktif",
      foto_profil: null, // Default
      kelas_ref: classRef,
      tanggal_masuk: admin.firestore.FieldValue.serverTimestamp(), 

      alamat: {
        jalan: alamat_jalan || null,
        rt_rw: alamat_rt_rw || null,
        kelurahan_desa: alamat_kelurahan_desa || null,
        kecamatan: alamat_kecamatan || null,
        kota_kabupaten: alamat_kota_kabupaten || null,
        provinsi: alamat_provinsi || null,
        kode_pos: alamat_kode_pos || null,
      },
      
      orang_tua: {
        alamat: ortu_alamat || null,
        ayah: {
          nama: ortu_ayah_nama || null,
          pendidikan: ortu_ayah_pendidikan || null,
          pekerjaan: ortu_ayah_pekerjaan || null,
          telepon: ortu_ayah_telepon || null,
        },
        ibu: {
          nama: ortu_ibu_nama || null,
          pendidikan: ortu_ibu_pendidikan || null,
          pekerjaan: ortu_ibu_pekerjaan || null,
          telepon: ortu_ibu_telepon || null,
        }
      }
    });
    
    revalidatePath("/list/students"); 
    
    return { success: true, message: `Siswa ${nama_lengkap} berhasil dibuat.` };

  } catch (error: any) {
    console.error("Error creating student:", error);
    
    if (uid) {
      await adminAuth.deleteUser(uid);
      console.log(`Rollback: Deleted auth user ${uid} due to error.`);
    }

    if (error.code === 'auth/email-already-exists') {
      return { success: false, message: `Gagal: NISN/Email (${internalEmail}) ini sudah terdaftar.` };
    }
    
    return { success: false, message: `Gagal: ${error.message}` };
  }
}

// --- FUNGSI UPDATE (DIPERBARUI) ---
export async function updateStudentAction(formData: StudentUpdateFormData): Promise<ActionResult> {
  
  // Ambil UID, sisanya adalah data profil
  // 'foto_profil' sekarang ada di dalam formData
  const { uid, ...profileData } = formData;

  if (!uid) {
    return { success: false, message: "UID Siswa tidak ditemukan." };
  }
  // if (!kelas) { return { success: false, message: "Kelas wajib dipilih." }; }

  try {
    // --- LANGKAH 1: Update Firebase Authentication ---
    const authUpdatePayload: admin.auth.UpdateRequest = {
      displayName: profileData.nama_lengkap,
    };
    await adminAuth.updateUser(uid, authUpdatePayload);

    // --- LANGKAH 2: Update Dokumen di Koleksi 'users' ---
    await adminDb.collection("users").doc(uid).update({
      name: profileData.nama_lengkap,
    });

    // Buat class reference jika ada kelas yang dipilih
    const classRef = profileData.kelas 
      ? adminDb.collection("classes").doc(profileData.kelas)
      : null;

    // --- LANGKAH 3: Update Dokumen di Koleksi 'students' ---
    const tanggalLahirTimestamp = profileData.tanggal_lahir
      ? admin.firestore.Timestamp.fromDate(new Date(profileData.tanggal_lahir)) 
      : null;
      
    // Susun ulang data untuk disimpan
    const studentDbPayload = {
      nama_lengkap: profileData.nama_lengkap,
      nisn: profileData.nisn,
      nis: profileData.nis || null,
      kelas: profileData.kelas || null,
      kelas_ref: classRef,
      email: profileData.email || null,
      jenis_kelamin: profileData.jenis_kelamin || null,
      tempat_lahir: profileData.tempat_lahir || null,
      tanggal_lahir: tanggalLahirTimestamp,
      agama: profileData.agama || null,
      kewarganegaraan: profileData.kewarganegaraan || null,
      asal_sekolah: profileData.asal_sekolah || null,
      nomor_hp: profileData.nomor_hp || null,
      status_siswa: profileData.status_siswa || "aktif",
      
      // === PERUBAHAN DI SINI ===
      // Hanya update 'foto_profil' jika nilainya dikirim (bukan undefined)
      // Ini mencegah 'foto_profil: undefined' menimpa 'null' atau URL yang ada
      ...(profileData.foto_profil !== undefined && { foto_profil: profileData.foto_profil }),
      
      alamat: {
        jalan: profileData.alamat_jalan || null,
        rt_rw: profileData.alamat_rt_rw || null,
        kelurahan_desa: profileData.alamat_kelurahan_desa || null,
        kecamatan: profileData.alamat_kecamatan || null,
        kota_kabupaten: profileData.alamat_kota_kabupaten || null,
        provinsi: profileData.alamat_provinsi || null,
        kode_pos: profileData.alamat_kode_pos || null,
      },
      orang_tua: {
        alamat: profileData.ortu_alamat || null,
        ayah: {
          nama: profileData.ortu_ayah_nama || null,
          pendidikan: profileData.ortu_ayah_pendidikan || null,
          pekerjaan: profileData.ortu_ayah_pekerjaan || null,
          telepon: profileData.ortu_ayah_telepon || null,
        },
        ibu: {
          nama: profileData.ortu_ibu_nama || null,
          pendidikan: profileData.ortu_ibu_pendidikan || null,
          pekerjaan: profileData.ortu_ibu_pekerjaan || null,
          telepon: profileData.ortu_ibu_telepon || null,
        }
      }
    };
    
    // Gunakan update, bukan set, agar field lain yang tidak diubah (seperti 'tanggal_masuk') tetap ada
    await adminDb.collection("students").doc(uid).update(studentDbPayload);

    revalidatePath("/list/students"); 
    revalidatePath(`/list/students/${uid}/edit`); // Revalidate halaman edit juga
    
    return { success: true, message: `Data ${profileData.nama_lengkap} berhasil diupdate.` };

  } catch (error: any) {
    console.error("Error updating student:", error);
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

// --- FUNGSI DELETE (TIDAK BERUBAH) ---
export async function deleteStudentAction(uid: string): Promise<ActionResult> {
  
  try {
    // 1. Hapus dokumen dari Koleksi 'students'
    await adminDb.collection("students").doc(uid).delete();

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

    revalidatePath("/list/students"); 

    return { success: true, message: "Siswa berhasil dihapus." };

  } catch (error: any) {
    console.error("Error deleting student:", error);
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}
