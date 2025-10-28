"use client";

import React, { useState } from 'react';
import { 
  FiUser, 
  FiBell, 
  FiSun, 
  FiMoon, 
  FiSave,
  FiSliders // Ikon baru untuk Preferensi
} from 'react-icons/fi';
import Image from 'next/image';

// 1. Tipe data diperbarui
interface UserSettings {
  profile: {
    fullName: string;
    bio: string;
  };
  learningPreferences: { // Bagian baru
    language: 'id' | 'en';
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
  };
  notifications: {
    emailNewAssignment: boolean;
    emailNewGrade: boolean;
    emailDiscussionReply: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
  };
}

export default function SettingsPage() {
  // 2. State diperbarui
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      fullName: "Irfan Bain", 
      bio: "Admin E-Learning SMP Harapan Jaya",
    },
    learningPreferences: { // State baru
      language: 'id',
      fontSize: 'medium',
      highContrast: false,
    },
    notifications: {
      emailNewAssignment: true,
      emailNewGrade: true,
      emailDiscussionReply: false,
    },
    appearance: {
      theme: 'light',
    },
  });

  // Handler notifikasi (tidak berubah)
  const handleNotificationChange = (key: keyof UserSettings['notifications']) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      }
    }));
  };

  // Handler profil (tidak berubah)
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [name]: value,
      }
    }));
  };
  
  // Handler tema (tidak berubah)
   const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({
      ...prev,
      appearance: {
        theme: e.target.value as UserSettings['appearance']['theme'],
      }
    }));
  };


  // --- HANDLER BARU ---
  // Handler untuk preferensi pembelajaran
  const handlePreferenceChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>, 
    key: keyof UserSettings['learningPreferences']
  ) => {
    const { value, type, checked } = e.target as HTMLInputElement; // Type assertion
    const newValue = type === 'checkbox' ? checked : value;

    setSettings(prev => ({
      ...prev,
      learningPreferences: {
        ...prev.learningPreferences,
        [key]: newValue,
      }
    }));
  };
  // --- AKHIR HANDLER BARU ---

  const handleSaveChanges = () => {
    console.log("Saving settings:", settings);
    alert("Pengaturan disimpan!");
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h2 className="text-2xl font-semibold mb-5">Pengaturan</h2>

      {/* --- KARTU PROFIL (Tidak berubah) --- */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiUser /> Profil Publik
        </h3>
        {/* ... (Isi Kartu Profil sama seperti sebelumnya) ... */}
         <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
            <input 
              type="text" 
              name="fullName"
              value={settings.profile.fullName}
              onChange={handleProfileChange}
              className="w-full p-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio Singkat</label>
            <textarea 
              name="bio"
              value={settings.profile.bio}
              // onChange={handleProfileChange} // Pastikan handler ini ada
              rows={3}
              className="w-full p-2 border rounded-lg bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* --- KARTU PREFERENSI PEMBELAJARAN (BARU) --- */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiSliders /> Preferensi Pembelajaran
        </h3>
        <div className="space-y-4">
          {/* Bahasa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bahasa Tampilan</label>
            <select 
              value={settings.learningPreferences.language}
              onChange={(e) => handlePreferenceChange(e, 'language')}
              className="w-full md:w-1/3 p-2 border rounded-lg bg-gray-50 appearance-none pr-8"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
          {/* Ukuran Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ukuran Font</label>
            <div className="flex gap-4">
              {['small', 'medium', 'large'].map(size => (
                <label key={size} className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="radio" 
                    name="fontSize" 
                    value={size}
                    checked={settings.learningPreferences.fontSize === size}
                    onChange={(e) => handlePreferenceChange(e, 'fontSize')}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="capitalize text-sm">{size === 'small' ? 'Kecil' : size === 'medium' ? 'Sedang' : 'Besar'}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Kontras Tinggi */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-800">Mode Kontras Tinggi (Aksesibilitas)</label>
            <button 
              onClick={() => setSettings(prev => ({...prev, learningPreferences: {...prev.learningPreferences, highContrast: !prev.learningPreferences.highContrast}}))}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.learningPreferences.highContrast ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                settings.learningPreferences.highContrast ? 'translate-x-6' : 'translate-x-0'
              }`}></span>
            </button>
          </div>
        </div>
      </div>
      {/* --- AKHIR KARTU PREFERENSI --- */}

      {/* --- KARTU NOTIFIKASI (Tidak berubah) --- */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FiBell /> Notifikasi Email
        </h3>
         {/* ... (Isi Kartu Notifikasi sama seperti sebelumnya) ... */}
         <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-800">Saat ada tugas baru</label>
            <button 
              onClick={() => handleNotificationChange('emailNewAssignment')}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.notifications.emailNewAssignment ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                settings.notifications.emailNewAssignment ? 'translate-x-6' : 'translate-x-0'
              }`}></span>
            </button>
          </div>
          {/* ... (toggle notifikasi lainnya) ... */}
           <div className="flex items-center justify-between">
            <label className="text-sm text-gray-800">Saat nilai baru keluar</label>
             <button 
              onClick={() => handleNotificationChange('emailNewGrade')}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.notifications.emailNewGrade ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                settings.notifications.emailNewGrade ? 'translate-x-6' : 'translate-x-0'
              }`}></span>
            </button>
          </div>
           <div className="flex items-center justify-between">
            <label className="text-sm text-gray-800">Saat ada balasan di diskusi</label>
             <button 
              onClick={() => handleNotificationChange('emailDiscussionReply')}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${
                settings.notifications.emailDiscussionReply ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transform transition-transform ${
                settings.notifications.emailDiscussionReply ? 'translate-x-6' : 'translate-x-0'
              }`}></span>
            </button>
          </div>
        </div>
      </div>

      {/* --- KARTU TAMPILAN (Tidak berubah) --- */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          {settings.appearance.theme === 'dark' ? <FiMoon /> : <FiSun />} Tampilan
        </h3>
         {/* ... (Isi Kartu Tampilan sama seperti sebelumnya) ... */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tema</label>
          <select 
            value={settings.appearance.theme}
            onChange={handleThemeChange}
            className="w-full md:w-1/3 p-2 border rounded-lg bg-gray-50 appearance-none pr-8"
          >
            <option value="light">Terang</option>
            <option value="dark">Gelap</option>
            <option value="system">Sesuai Sistem</option>
          </select>
        </div>
      </div>

      {/* Tombol Simpan (Tidak berubah) */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSaveChanges}
          className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <FiSave /> Simpan Perubahan
        </button>
      </div>

    </div>
  );
}