"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CharacterBuilder } from "@/components/builder/CharacterBuilder";

function BuilderContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  return <CharacterBuilder editId={editId} />;
}

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500">Loading builder...</div>
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
