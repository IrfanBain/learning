import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid'; // Gunakan 'npm install uuid' dan 'npm install @types/uuid'

// Inisialisasi S3 client untuk Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { contentType, fileExtension } = await request.json();

    if (!contentType || !fileExtension) {
      return NextResponse.json({ error: "Tipe file atau ekstensi tidak valid" }, { status: 400 });
    }

    const fileId = uuidv4();
    const fileName = `${fileId}.${fileExtension}`;
    
    // Buat command untuk S3
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName, // Nama file unik di R2
      ContentType: contentType,
    });

    // Buat Presigned URL (aman, kadaluarsa dalam 10 menit)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
    
    // Ini adalah URL publik final setelah file di-upload
    const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    return NextResponse.json({ uploadUrl, fileUrl });

  } catch (error) {
    console.error("Error creating presigned URL: ", error);
    return NextResponse.json({ error: "Gagal membuat URL upload" }, { status: 500 });
  }
}
