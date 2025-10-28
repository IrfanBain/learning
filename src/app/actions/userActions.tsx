// src/app/actions/userActions.ts
"use server"; // <-- Ini PENTING! Menandakan ini adalah Server Action

import * as admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/firebaseAdminConfig"; // Sesuaikan path
import { revalidatePath } from "next/cache"; // Untuk refresh data

// Definisikan tipe data yang kita harapkan dari form
interface UserFormData {
  uid: string; // Hanya untuk update, tidak untuk create
  name: string;
  username: string; // NISN/NIP
  email: string;
  password?: string;
  role: 'student' | 'teacher' | 'admin';
}

// Tipe untuk nilai kembalian
interface ActionResult {
  success: boolean;
  message: string;
}

export async function createUserAction(formData: UserFormData): Promise<ActionResult> {
  const { name, username, email, password, role } = formData;

  try {
    // 1. Buat akun di Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: name,
      disabled: false, // Pastikan akunnya langsung aktif
    });
    
    const uid = userRecord.uid;

    // 2. Simpan data tambahan ke Firestore Database
    await adminDb.collection("users").doc(uid).set({
      name: name,
      username: username,
      email: email,
      role: role,
      // Tambahkan field lain jika perlu, misal createdAt
      createdAt: new Date().toISOString(), 
    });
    
    // 3. Beri tahu Next.js untuk refresh data di halaman /admin/users
    revalidatePath("/admin/users"); 
    
    return { success: true, message: "Pengguna berhasil dibuat." };

  } catch (error: any) {
    console.error("Error creating user:", error);
    
    // Beri pesan error yang lebih jelas
    if (error.code === 'auth/email-already-exists') {
      return { success: false, message: "Email ini sudah terdaftar." };
    }
    if (error.code === 'auth/invalid-password') {
      return { success: false, message: "Password terlalu lemah (minimal 6 karakter)." };
    }
    
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

export async function updateUserAction(formData: UserFormData): Promise<ActionResult> {
  const { uid, name, username, email, role, password } = formData;

  try {
    // --- 1. Update Firebase Authentication ---
    const authUpdatePayload: admin.auth.UpdateRequest = {
      email: email,
      displayName: name,
    };
    
    // HANYA update password jika diisi (lebih dari 6 karakter)
    if (password && password.length >= 6) {
      authUpdatePayload.password = password;
    }
    
    await adminAuth.updateUser(uid, authUpdatePayload);

    // --- 2. Update Firestore Database ---
    const dbUpdatePayload = {
      name: name,
      username: username,
      email: email,
      role: role,
    };
    
    await adminDb.collection("users").doc(uid).update(dbUpdatePayload);

    // 3. Beri tahu Next.js untuk refresh data
    revalidatePath("/admin/users"); 
    
    return { success: true, message: "Pengguna berhasil diupdate." };

  } catch (error: any) {
    console.error("Error updating user:", error);
    
    if (error.code === 'auth/email-already-exists') {
      return { success: false, message: "Email ini sudah terdaftar." };
    }
    
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

export async function deleteUserAction(uid: string): Promise<ActionResult> {
  // PENTING: Kita harus cegah admin menghapus akunnya sendiri
  // (Ini hanya pencegahan di server, kita akan tambahkan di client juga)
  // Anda bisa tambahkan logic untuk membandingkan UID admin yang login
  // vs UID yang akan dihapus jika Anda meneruskan UID admin.
  // Untuk saat ini, kita fokus pada fungsionalitasnya.
  
  try {
    // 1. Hapus akun dari Firebase Authentication
    await adminAuth.deleteUser(uid);

    // 2. Hapus dokumen dari Firestore Database
    await adminDb.collection("users").doc(uid).delete();

    // 3. Beri tahu Next.js untuk refresh data
    revalidatePath("/admin/users"); 

    return { success: true, message: "Pengguna berhasil dihapus." };

  } catch (error: any) {
    console.error("Error deleting user:", error);
    
    // Error jika user tidak ditemukan (mungkin sudah terhapus)
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: "Gagal: Pengguna tidak ditemukan di Autentikasi." };
    }
    
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}