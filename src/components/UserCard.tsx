"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig"; // Pastikan path ini benar

const UserCard = ({ type }: { type: string }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      setLoading(true);
      
      let collectionRef;
      let q; 

      const lowerType = type.toLowerCase();

      try {
        if (lowerType === "siswa") {
          collectionRef = collection(db, "students");
          q = query(collectionRef);
        } else if (lowerType === "guru") {
          collectionRef = collection(db, "teachers");
          q = query(collectionRef);
        } else if (lowerType === "kelas") { // <-- INI TAMBAHANNYA
          collectionRef = collection(db, "classes");
          q = query(collectionRef);
        } else {
          console.warn("Tipe user tidak dikenal:", type);
          setLoading(false);
          return;
        }

        const snapshot = await getDocs(q);
        setCount(snapshot.size);

      } catch (error) {
        console.error("Error fetching count for", type, ":", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, [type]);

  return (
    <div className="rounded-2xl odd:bg-lamaPurple even:bg-lamaYellow p-4 flex-1 min-w-[130px]">
      <div className="flex justify-between items-center">
        <span className="text-[10px] bg-white px-2 py-1 rounded-full text-green-600">
          2025/2026
        </span>
        {/* <Image src="/more.png" alt="" width={20} height={20} /> */}
      </div>

      <h1 className="text-2xl font-semibold my-4">
        {loading ? "..." : count}
      </h1>
      
      <h2 className="capitalize text-sm font-medium text-gray-500">{type}</h2>
    </div>
  );
};

export default UserCard;