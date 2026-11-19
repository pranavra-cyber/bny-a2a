import { Suspense } from "react";
import { DocumentsPage } from "@/components/eliza/DocumentsPage";

export default function Page() {
  return (
    <Suspense>
      <DocumentsPage />
    </Suspense>
  );
}
