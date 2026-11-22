import { Suspense } from "react";
import { SupervisionPage } from "@/components/eliza/SupervisionPage";

export default function Page() {
  return (
    <Suspense>
      <SupervisionPage />
    </Suspense>
  );
}
