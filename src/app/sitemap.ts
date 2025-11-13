// Di dalam file: src/app/sitemap.ts

import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://mtsalkhairiyah.online',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    // --- CONTOH JIKA NANTI ADA HALAMAN LAIN ---
    // {
    //   url: 'https://mtsalkhairiyah.online/login',
    //   lastModified: new Date(),
    //   changeFrequency: 'monthly',
    //   priority: 0.8,
    // },
    // {
    //   url: 'https://mtsalkhairiyah.online/materi',
    //   lastModified: new Date(),
    //   changeFrequency: 'weekly',
    //   priority: 0.5,
    // },
  ]
}