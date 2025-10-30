"use server";

import * as admin from 'firebase-admin';
import { adminDb } from "@/lib/firebaseAdminConfig"; // Pastikan path ini benar
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  message: string;
}

// 1. Interface Form Data (Data dari <form>, pakai ID string dulu)
export interface ScheduleFormData {
  hari: string;           // "Senin", "Selasa", ...
  jam_mulai: string;      // "HH:MM"
  jam_selesai: string;    // "HH:MM"
  kelas_id: string;       // ID Dokumen Kelas (cth: "VII-A")
  mapel_id: string;       // ID Dokumen Mapel (cth: "MTK")
  guru_id: string;        // UID Guru
  tahun_ajaran: string; // "YYYY/YYYY"
  jumlah_jam_pelajaran: number;
  ruangan?: string;       // Opsional
}

// 2. Interface Update Data (Mirip, tapi pakai ID Jadwal)
export interface ScheduleUpdateFormData extends ScheduleFormData {
  id: string; // ID Dokumen Jadwal yang mau diupdate
}

// --- FUNGSI CREATE (TAMBAH JADWAL) ---
export async function createScheduleAction(formData: ScheduleFormData): Promise<ActionResult> {

  const {
    hari, jam_mulai, jam_selesai, kelas_id, mapel_id, guru_id,
    tahun_ajaran, jumlah_jam_pelajaran, ruangan
  } = formData;

  // Validasi dasar
  if (!hari || !jam_mulai || !jam_selesai || !kelas_id || !mapel_id || !guru_id || !tahun_ajaran || jumlah_jam_pelajaran === undefined || jumlah_jam_pelajaran === null) {
    return { success: false, message: "Semua field (kecuali ruangan) wajib diisi." };
  }
  // Validasi format jam (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(jam_mulai) || !timeRegex.test(jam_selesai)) {
      return { success: false, message: "Format jam mulai/selesai harus HH:MM (contoh: 07:00)." };
  }
  // Validasi jam selesai > jam mulai (opsional tapi bagus)
  if (jam_selesai <= jam_mulai) {
      return { success: false, message: "Jam selesai harus setelah jam mulai." };
  }
   // Validasi jumlah jam
  if (isNaN(jumlah_jam_pelajaran) || jumlah_jam_pelajaran <= 0) {
      return { success: false, message: "Jumlah Jam Pelajaran harus angka positif." };
  }
   // Validasi Tahun Ajaran
   if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran)) {
       return { success: false, message: "Format Tahun Ajaran harus YYYY/YYYY." };
   }


  try {
    // --- Buat Document References ---
    const classRef = adminDb.collection("classes").doc(kelas_id);
    const subjectRef = adminDb.collection("subjects").doc(mapel_id);
    const teacherRef = adminDb.collection("teachers").doc(guru_id);
    // -------------------------------

    // --- Opsional: Cek apakah referensi valid (dokumennya ada)? ---
    const classSnap = await classRef.get();
    const subjectSnap = await subjectRef.get();
    const teacherSnap = await teacherRef.get();
    if (!classSnap.exists) throw new Error(`Kelas dengan ID '${kelas_id}' tidak ditemukan.`);
    if (!subjectSnap.exists) throw new Error(`Mata Pelajaran dengan ID '${mapel_id}' tidak ditemukan.`);
    if (!teacherSnap.exists) throw new Error(`Guru dengan ID '${guru_id}' tidak ditemukan.`);
    // -------------------------------------------------------------

    // --- Opsional: Cek Konflik Jadwal ---
    // Query ke 'schedules' untuk cek apakah sudah ada jadwal lain di kelas/guru/ruangan
    // yang sama pada hari dan jam yang overlap. Ini bisa jadi kompleks.
    // Contoh sederhana: cek jika ada jadwal di kelas yg sama, hari sama, jam mulai sama
    const conflictQuery = adminDb.collection("schedules")
                            .where('kelas_ref', '==', classRef)
                            .where('hari', '==', hari)
                            .where('jam_mulai', '==', jam_mulai);
    const conflictSnap = await conflictQuery.get();
    if (!conflictSnap.empty) {
        // Ambil data konflik pertama untuk pesan error
        const conflictingDoc = conflictSnap.docs[0];
        const conflictMapelRef = conflictingDoc.data().mapel_ref as admin.firestore.DocumentReference;
        // const conflictMapelSnap = await conflictMapelRef?.get(); // Perlu ? karena bisa null
        // const conflictMapelName = conflictMapelSnap?.data()?.nama_mapel || 'Mapel Lain';
        throw new Error(`Sudah ada jadwal lain (${conflictMapelRef.id}) di kelas ini pada hari dan jam mulai yang sama.`);
    }
    // ------------------------------------


    // Siapkan data untuk disimpan
    const scheduleData = {
      hari,
      jam_mulai,
      jam_selesai,
      kelas_ref: classRef,     // Simpan Reference
      mapel_ref: subjectRef,   // Simpan Reference
      guru_ref: teacherRef,    // Simpan Reference
      tahun_ajaran,
      jumlah_jam_pelajaran: Number(jumlah_jam_pelajaran), // Pastikan Number
      ruangan: ruangan?.trim() || null, // Simpan null jika kosong
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Tambahkan dokumen baru (ID akan dibuat otomatis oleh Firestore)
    await adminDb.collection("schedules").add(scheduleData); // Gunakan addDoc

    revalidatePath("/list/schedules"); // Sesuaikan path jika lokasi halaman daftar beda

    return { success: true, message: `Jadwal berhasil ditambahkan.` };

  } catch (error: any) {
    console.error("Error creating schedule:", error);
    // Berikan pesan error yang lebih spesifik
    if (error.message.includes('tidak ditemukan')) {
        return { success: false, message: `Gagal: ${error.message}` };
    }
    if (error.message.includes('Sudah ada jadwal lain')) {
         return { success: false, message: `Gagal: ${error.message}` };
    }
    return { success: false, message: `Gagal menambahkan jadwal: Terjadi kesalahan server.` };
  }
}
// --- AKHIR FUNGSI CREATE ---


// --- FUNGSI UPDATE (Disiapkan) ---
export async function updateScheduleAction(formData: ScheduleUpdateFormData): Promise<ActionResult> {
   const {
    id, hari, jam_mulai, jam_selesai, kelas_id, mapel_id, guru_id,
    tahun_ajaran, jumlah_jam_pelajaran, ruangan
   } = formData;

   if (!id) { return { success: false, message: "ID Jadwal tidak ditemukan." }; }
   // Validasi lain (sama seperti create)...
    if (!hari || !jam_mulai || !jam_selesai || !kelas_id || !mapel_id || !guru_id || !tahun_ajaran || jumlah_jam_pelajaran === undefined || jumlah_jam_pelajaran === null) { /*...*/ }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(jam_mulai) || !timeRegex.test(jam_selesai)) { /*...*/ }
    if (jam_selesai <= jam_mulai) { /*...*/ }
    if (isNaN(jumlah_jam_pelajaran) || jumlah_jam_pelajaran <= 0) { /*...*/ }
    if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran)) { /*...*/ }


   const scheduleDocRef = adminDb.collection("schedules").doc(id);

   try {
     // Buat Referensi baru
     const classRef = adminDb.collection("classes").doc(kelas_id);
     const subjectRef = adminDb.collection("subjects").doc(mapel_id);
     const teacherRef = adminDb.collection("teachers").doc(guru_id);

      // Opsional: Cek referensi baru & cek konflik (lebih kompleks di update)

     const scheduleDataToUpdate = {
        hari,
        jam_mulai,
        jam_selesai,
        kelas_ref: classRef,
        mapel_ref: subjectRef,
        guru_ref: teacherRef,
        tahun_ajaran,
        jumlah_jam_pelajaran: Number(jumlah_jam_pelajaran),
        ruangan: ruangan?.trim() || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
     };

     await scheduleDocRef.update(scheduleDataToUpdate);

     revalidatePath("/list/schedules"); // Sesuaikan path
     revalidatePath(`/list/schedules/${id}`); // Detail (jika ada)
     revalidatePath(`/list/schedules/${id}/edit`); // Edit

     return { success: true, message: `Jadwal ${id} berhasil diupdate.` };

   } catch (error: any) {
     console.error("Error updating schedule:", error);
     return { success: false, message: `Gagal mengupdate jadwal: ${error.message}` };
   }
}
// --- AKHIR FUNGSI UPDATE ---


// --- FUNGSI DELETE (Disiapkan) ---
export async function deleteScheduleAction(id: string): Promise<ActionResult> {
   if (!id) { return { success: false, message: "ID Jadwal tidak ditemukan." }; }
   const scheduleDocRef = adminDb.collection("schedules").doc(id);
   try {
     await scheduleDocRef.delete();
     revalidatePath("/list/schedules"); // Sesuaikan path
     return { success: true, message: `Jadwal ${id} berhasil dihapus.` };
   } catch (error: any) {
     console.error("Error deleting schedule:", error);
     return { success: false, message: `Gagal menghapus jadwal: ${error.message}` };
   }
}
// --- AKHIR FUNGSI DELETE ---
