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
}

export type ActionResult = {
  success: boolean;
  message: string;
};

// 2. Interface Update Data (Mirip, tapi pakai ID)
export interface ClassUpdateFormData extends Omit<ClassFormData, 'nama_kelas'> { // Omit nama_kelas karena ID tidak diubah
  id: string; // Document ID yang sudah ada
}

// --- FUNGSI CREATE (TAMBAH KELAS) ---
// (Fungsi ini sudah benar, tidak ada perubahan)
export async function createClassAction(formData: ClassFormData): Promise<ActionResult> {

  const { nama_kelas, tingkat, tahun_ajaran, wali_kelas_uid } = formData;

  // Validasi dasar
  if (!nama_kelas || !tingkat || !tahun_ajaran || !wali_kelas_uid) {
    return { success: false, message: "Semua field wajib diisi." };
  }

  const docId = nama_kelas.trim().toUpperCase().replace(/\s+/g, '-'); 
  if (!docId) {
    return { success: false, message: "Nama Kelas tidak valid untuk dijadikan ID." };
  }

  const classDocRef = adminDb.collection("classes").doc(docId); 
  const teacherDocRef = adminDb.collection("teachers").doc(wali_kelas_uid);

  try {
    const batch = adminDb.batch();

    // 1. Cek Duplikasi Kelas & Keberadaan Guru
    const classSnap = await classDocRef.get();
    if (classSnap.exists) { throw new Error(`Kelas dengan ID '${docId}' sudah ada.`); }
    const teacherSnap = await teacherDocRef.get();
    if (!teacherSnap.exists) { throw new Error(`Guru dengan ID '${wali_kelas_uid}' tidak ditemukan.`); }

    // Opsional: Cek wali kelas lain
    const teacherData = teacherSnap.data();
    if (teacherData && teacherData.wali_kelas_ref) {
      console.warn(`Guru ${wali_kelas_uid} sudah menjadi wali kelas ${teacherData.wali_kelas_ref}, akan ditimpa.`);
    }

    // 2. Siapkan Data Kelas
    const classData = {
      nama_kelas: nama_kelas.trim(),
      tingkat: Number(tingkat),
      tahun_ajaran,
      wali_kelas_ref: teacherDocRef, // Simpan reference ke guru
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Operasi 1: Set Dokumen Kelas Baru
    batch.set(classDocRef, classData);

    // Operasi 2: Update Dokumen Guru
    batch.update(teacherDocRef, { wali_kelas_ref: docId }); 
    
    await batch.commit(); 

    revalidatePath("/list/classes"); 
    revalidatePath("/list/teachers"); 
    revalidatePath(`/list/teachers/${wali_kelas_uid}`); 

    return { success: true, message: `Kelas ${nama_kelas} berhasil dibuat dan ${teacherSnap.data()?.nama_lengkap || wali_kelas_uid} ditetapkan sebagai wali kelas.` };

  } catch (error: any) {
    console.error("Error creating class:", error);
    return { success: false, message: `Gagal membuat kelas: ${error.message}` };
  }
}
// --- AKHIR FUNGSI CREATE ---


// --- FUNGSI UPDATE (INI YANG DIPERBAIKI) ---
export async function updateClassAction(formData: ClassUpdateFormData): Promise<ActionResult> {
   const { id, tingkat, tahun_ajaran, wali_kelas_uid } = formData; // wali_kelas_uid adalah UID guru BARU

  if (!id) { return { success: false, message: "ID Kelas tidak ditemukan." }; }
  if (!tingkat || !tahun_ajaran || !wali_kelas_uid) { return { success: false, message: "Tingkat, Tahun Ajaran, dan Wali Kelas wajib diisi." }; }

  const classDocRef = adminDb.collection("classes").doc(id);
  const newTeacherDocRef = adminDb.collection("teachers").doc(wali_kelas_uid); // Ref guru BARU

  try {
    const batch = adminDb.batch();

    // 1. Ambil data kelas SAAT INI untuk mendapatkan wali kelas LAMA
    const currentClassSnap = await classDocRef.get();
    if (!currentClassSnap.exists) {
        throw new Error(`Kelas dengan ID '${id}' tidak ditemukan.`);
    }
    const currentClassData = currentClassSnap.data();
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
    };

    // --- Operasi 1: Update dokumen kelas ---
    batch.update(classDocRef, classDataToUpdate);

    // 4. Cek apakah wali kelas berubah
    if (oldWaliKelasUid !== wali_kelas_uid) {
        console.log(`Wali kelas berubah dari ${oldWaliKelasUid || 'Tidak Ada'} ke ${wali_kelas_uid}`);

        // --- Operasi 2 (Jika ada wali kelas LAMA): Update guru LAMA ---
        if (oldWaliKelasRef) {
            
            // --- INI PERBAIKAN BUG (SOLUSI B) ---
            // Cek dulu apakah guru lama ("Budi") masih ada di database
            const oldTeacherSnap = await oldWaliKelasRef.get();

            if (oldTeacherSnap.exists) {
                // HANYA update jika dokumennya masih ada
                batch.update(oldWaliKelasRef, { wali_kelas_ref: null }); // Set ke null
                console.log(`Updating old teacher ${oldWaliKelasUid}: set wali_kelas_ref to null`);
            } else {
                // Jika GURU LAMA TIDAK DITEMUKAN (kasus Anda),
                // kita lewati saja, jangan update, dan jangan error.
                console.warn(`Dokumen guru lama ${oldWaliKelasRef.id} tidak ditemukan. Cleanup dilewati.`);
            }
            // --- AKHIR PERBAIKAN ---
        }
        // -----------------------------------------------------------

        // --- Operasi 3: Update guru BARU ---
        batch.update(newTeacherDocRef, { wali_kelas_ref: id }); // 'id' adalah ID kelas ini
        console.log(`Updating new teacher ${wali_kelas_uid}: set wali_kelas_ref to ${id}`);
        // ------------------------------------

    } else {
        console.log(`Wali kelas tidak berubah (tetap ${wali_kelas_uid})`);
    }

    await batch.commit();

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
     // Tangkap eror spesifik (meskipun seharusnya sudah dicegah)
    if (error.code === 5) { // 5 adalah kode 'NOT_FOUND' di Admin SDK
         return { success: false, message: `Error: Dokumen tidak ditemukan saat update. (Ref: ${error.message})` };
    }
     return { success: false, message: `Gagal mengupdate kelas: ${error.message}` };
   }
}
// --- AKHIR FUNGSI UPDATE ---


// --- FUNGSI DELETE (DIPERBAIKI JUGA) ---
export async function deleteClassAction(id: string): Promise<ActionResult> {
   if (!id) { return { success: false, message: "ID Kelas tidak ditemukan." }; }

   const classDocRef = adminDb.collection("classes").doc(id);

   try {
     const batch = adminDb.batch();

     // 1. Ambil data kelas untuk mendapatkan wali kelas LAMA
     const currentClassSnap = await classDocRef.get();
     if (!currentClassSnap.exists) {
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

     // --- Operasi 2 (Jika ada wali kelas LAMA): Update guru LAMA (DIPERBAIKI) ---
     if (oldWaliKelasRef) {
        // --- PERBAIKAN BUG (SOLUSI B) ---
        const oldTeacherSnap = await oldWaliKelasRef.get();
        if (oldTeacherSnap.exists) {
            // Hapus referensi kelas dari guru lama
            batch.update(oldWaliKelasRef, { wali_kelas_ref: null }); // Set ke null
            console.log(`Updating old teacher ${oldWaliKelasUid} during class delete: set wali_kelas_ref to null`);
        } else {
             console.warn(`Dokumen guru lama ${oldWaliKelasRef.id} tidak ditemukan. Cleanup dilewati.`);
        }
        // --- AKHIR PERBAIKAN ---
     }
     // -----------------------------------------------------------

     await batch.commit();

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