"use server";

import * as admin from 'firebase-admin';
import { adminDb } from "@/lib/firebaseAdminConfig"; // Pastikan path ini benar
import { revalidatePath } from "next/cache";


// 1. Interface Form Data (Data dari <form>)
export interface ClassFormData {
  nama_kelas: string;       // Ini akan jadi Document ID (cth: "VIIA", "X-IPA-1")
  tingkat: number;          // Angka (cth: 7, 10)
  tahun_ajaran: string;     // Cth: "2024/2025"
  wali_kelas_uid: string;   // UID (Document ID) dari guru di koleksi 'teachers'
  // Tambahkan field lain jika perlu (misal: jurusan, kapasitas)
  // jurusan?: string;
  // kapasitas?: number;
}

export type ActionResult = {
  success: boolean;
  message: string;
  // tambahkan field lain jika ada
};

// 2. Interface Update Data (Mirip, tapi pakai ID)
export interface ClassUpdateFormData extends Omit<ClassFormData, 'nama_kelas'> { // Omit nama_kelas karena ID tidak diubah
  id: string; // Document ID yang sudah ada
}

// --- FUNGSI CREATE (TAMBAH KELAS) ---
export async function createClassAction(formData: ClassFormData): Promise<ActionResult> {

  const { nama_kelas, tingkat, tahun_ajaran, wali_kelas_uid } = formData;

  // Validasi dasar
  if (!nama_kelas || !tingkat || !tahun_ajaran || !wali_kelas_uid) {
    return { success: false, message: "Semua field wajib diisi." };
  }

  // --- Gunakan nama_kelas sebagai Document ID ---
  // Bersihkan ID (opsional: hapus spasi, ganti karakter aneh)
  const docId = nama_kelas.trim().toUpperCase().replace(/\s+/g, '-'); // Contoh: "VII A" -> "VII-A"
  if (!docId) {
    return { success: false, message: "Nama Kelas tidak valid untuk dijadikan ID." };
  }
  // ---------------------------------------------

  const classDocRef = adminDb.collection("classes").doc(docId); // Nama koleksi: 'classes'
  const teacherDocRef = adminDb.collection("teachers").doc(wali_kelas_uid);

  try {
    // --- Gunakan Batched Write ---
    const batch = adminDb.batch();
    // ---------------------------

    // 1. Cek Duplikasi Kelas & Keberadaan Guru (Tidak berubah)
    const classSnap = await classDocRef.get();
    if (classSnap.exists) { throw new Error(`Kelas dengan ID '${docId}' sudah ada.`); }
    const teacherSnap = await teacherDocRef.get();
    if (!teacherSnap.exists) { throw new Error(`Guru dengan ID '${wali_kelas_uid}' tidak ditemukan.`); }

    // --- Opsional: Cek apakah guru sudah jadi wali kelas lain? ---
    const teacherData = teacherSnap.data();
    if (teacherData && teacherData.wali_kelas_ref) {
    //   Guru ini sudah menjadi wali kelas lain. Anda bisa:
    //   1. Melempar error: throw new Error(`Guru ${teacherData.nama_lengkap} sudah menjadi wali kelas ${teacherData.wali_kelas_ref}.`);
    //   2. Membiarkannya (satu guru bisa jadi wali banyak kelas, jika sistem mengizinkan)
    //   3. Menimpanya (wali kelas sebelumnya akan hilang dari data guru ini) - Ini yang akan terjadi jika kita lanjutkan tanpa cek.
      console.warn(`Guru ${wali_kelas_uid} sudah menjadi wali kelas ${teacherData.wali_kelas_ref}, akan ditimpa.`);
    }
    // -----------------------------------------------------------

    // 2. Siapkan Data Kelas (Tidak berubah)
    const classData = {
      nama_kelas: nama_kelas.trim(),
      tingkat: Number(tingkat),
      tahun_ajaran,
      wali_kelas_ref: teacherDocRef, // Simpan reference ke guru
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // ... field lain
    };

    // --- Operasi 1: Set Dokumen Kelas Baru ---
    batch.set(classDocRef, classData);
    // ----------------------------------------

    // --- Operasi 2: Update Dokumen Guru ---
    // Simpan ID kelas (string) di field wali_kelas_ref guru
    batch.update(teacherDocRef, { wali_kelas_ref: docId });
    // Jika Anda ingin menyimpan reference: batch.update(teacherDocRef, { wali_kelas_ref: classDocRef });
    // ---------------------------------------

    // --- Commit Batch ---
    await batch.commit(); // Jalankan kedua operasi secara atomik
    // --------------------

    revalidatePath("/list/classes"); // Sesuaikan path jika perlu
    revalidatePath("/list/teachers"); // Revalidate daftar guru juga
    // Revalidate halaman detail guru yang baru diupdate
    revalidatePath(`/list/teachers/${wali_kelas_uid}`); // Sesuaikan path jika perlu

    return { success: true, message: `Kelas ${nama_kelas} berhasil dibuat dan ${teacherSnap.data()?.nama_lengkap || wali_kelas_uid} ditetapkan sebagai wali kelas.` };

  } catch (error: any) {
    console.error("Error creating class:", error);
    // Rollback tidak diperlukan karena batch gagal secara keseluruhan
    return { success: false, message: `Gagal membuat kelas: ${error.message}` };
  }
}
// --- AKHIR FUNGSI CREATE ---


// --- FUNGSI UPDATE (Disiapkan) ---
export async function updateClassAction(formData: ClassUpdateFormData): Promise<ActionResult> {
   const { id, tingkat, tahun_ajaran, wali_kelas_uid } = formData; // wali_kelas_uid adalah UID guru BARU

  // Validasi dasar
  if (!id) { return { success: false, message: "ID Kelas tidak ditemukan." }; }
  if (!tingkat || !tahun_ajaran || !wali_kelas_uid) { return { success: false, message: "Tingkat, Tahun Ajaran, dan Wali Kelas wajib diisi." }; }

  // Referensi dokumen
  const classDocRef = adminDb.collection("classes").doc(id);
  const newTeacherDocRef = adminDb.collection("teachers").doc(wali_kelas_uid); // Ref guru BARU

  try {
    // --- Mulai Batched Write ---
    const batch = adminDb.batch();
    // ---------------------------

    // 1. Ambil data kelas SAAT INI untuk mendapatkan wali kelas LAMA
    const currentClassSnap = await classDocRef.get();
    if (!currentClassSnap.exists) {
        throw new Error(`Kelas dengan ID '${id}' tidak ditemukan.`);
    }
    const currentClassData = currentClassSnap.data();
    // Dapatkan referensi wali kelas LAMA (ini adalah DocumentReference)
    const oldWaliKelasRef = currentClassData?.wali_kelas_ref as admin.firestore.DocumentReference | null | undefined;
    const oldWaliKelasUid = oldWaliKelasRef?.id; // Dapatkan ID guru LAMA

    // 2. Cek apakah guru BARU ada
    const newTeacherSnap = await newTeacherDocRef.get();
    if (!newTeacherSnap.exists) {
        throw new Error(`Guru baru dengan ID '${wali_kelas_uid}' tidak ditemukan.`);
    }

    // 3. Siapkan data untuk update kelas
    const classDataToUpdate = {
      tingkat: Number(tingkat),
      tahun_ajaran,
      wali_kelas_ref: newTeacherDocRef, // Update reference ke guru BARU
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // ... field lain (jurusan, kapasitas) jika ada ...
      // jurusan: formData.jurusan || admin.firestore.FieldValue.delete(), // Hapus jika kosong
      // kapasitas: formData.kapasitas ? Number(formData.kapasitas) : admin.firestore.FieldValue.delete(),
    };

    // --- Operasi 1: Update dokumen kelas ---
    batch.update(classDocRef, classDataToUpdate);
    // ----------------------------------------

    // 4. Cek apakah wali kelas berubah
    if (oldWaliKelasUid !== wali_kelas_uid) {
        console.log(`Wali kelas berubah dari ${oldWaliKelasUid || 'Tidak Ada'} ke ${wali_kelas_uid}`);

        // --- Operasi 2 (Jika ada wali kelas LAMA): Update guru LAMA ---
        if (oldWaliKelasRef) {
            // Hapus referensi kelas dari guru lama
            batch.update(oldWaliKelasRef, { wali_kelas_ref: null }); // Set ke null
            // Atau hapus field: batch.update(oldWaliKelasRef, { wali_kelas_ref: admin.firestore.FieldValue.delete() });
            console.log(`Updating old teacher ${oldWaliKelasUid}: set wali_kelas_ref to null`);
        }
        // -----------------------------------------------------------

        // --- Operasi 3: Update guru BARU ---
        // Tambahkan referensi kelas (ID string) ke guru baru
        batch.update(newTeacherDocRef, { wali_kelas_ref: id }); // 'id' adalah ID kelas ini
        console.log(`Updating new teacher ${wali_kelas_uid}: set wali_kelas_ref to ${id}`);
        // ------------------------------------

    } else {
        console.log(`Wali kelas tidak berubah (tetap ${wali_kelas_uid})`);
        // Tidak perlu update dokumen guru
    }

    // --- Commit Batch ---
    await batch.commit();
    // --------------------

    // Revalidasi path
    revalidatePath("/classes"); // Daftar kelas
    revalidatePath(`/classes/${id}`); // Detail kelas
    revalidatePath(`/classes/${id}/edit`); // Halaman edit kelas
    revalidatePath("/teachers"); // Daftar guru (karena wali_kelas_ref mungkin berubah)
    if (oldWaliKelasUid && oldWaliKelasUid !== wali_kelas_uid) {
        revalidatePath(`/teachers/${oldWaliKelasUid}`); // Detail guru lama
    }
    revalidatePath(`/teachers/${wali_kelas_uid}`); // Detail guru baru

    return { success: true, message: `Data kelas ${id} berhasil diupdate.` };

   } catch (error: any) {
     console.error("Error updating class:", error);
     return { success: false, message: `Gagal mengupdate kelas: ${error.message}` };
   }
}
// --- AKHIR FUNGSI UPDATE ---


// --- FUNGSI DELETE (Perlu Disesuaikan Juga) ---
export async function deleteClassAction(id: string): Promise<ActionResult> {
   if (!id) { return { success: false, message: "ID Kelas tidak ditemukan." }; }

   const classDocRef = adminDb.collection("classes").doc(id);

   try {
     // --- Mulai Batched Write ---
     const batch = adminDb.batch();
     // ---------------------------

     // 1. Ambil data kelas untuk mendapatkan wali kelas LAMA
     const currentClassSnap = await classDocRef.get();
     if (!currentClassSnap.exists) {
         // Jika kelas sudah tidak ada, anggap berhasil dihapus
         console.warn(`Class ${id} not found during delete, assuming already deleted.`);
         revalidatePath("/classes");
         return { success: true, message: `Kelas ${id} sudah dihapus.` };
     }
     const currentClassData = currentClassSnap.data();
     const oldWaliKelasRef = currentClassData?.wali_kelas_ref as admin.firestore.DocumentReference | null | undefined;
     const oldWaliKelasUid = oldWaliKelasRef?.id;

     // --- Operasi 1: Hapus dokumen kelas ---
     batch.delete(classDocRef);
     // --------------------------------------

     // --- Operasi 2 (Jika ada wali kelas LAMA): Update guru LAMA ---
     if (oldWaliKelasRef) {
         // Hapus referensi kelas dari guru lama
         batch.update(oldWaliKelasRef, { wali_kelas_ref: null }); // Set ke null
         console.log(`Updating old teacher ${oldWaliKelasUid} during class delete: set wali_kelas_ref to null`);
     }
     // -----------------------------------------------------------

     // --- Commit Batch ---
     await batch.commit();
     // --------------------

     revalidatePath("/classes");
     if (oldWaliKelasUid) {
         revalidatePath("/teachers"); // Revalidate daftar guru
         revalidatePath(`/teachers/${oldWaliKelasUid}`); // Revalidate detail guru lama
     }

     return { success: true, message: `Kelas ${id} berhasil dihapus.` };

   } catch (error: any) {
     console.error("Error deleting class:", error);
     return { success: false, message: `Gagal menghapus kelas: ${error.message}` };
   }
}
// --- AKHIR FUNGSI DELETE ---
