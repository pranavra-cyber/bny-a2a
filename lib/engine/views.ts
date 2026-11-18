import type { View } from "./types";

export const parseView = (v: string | null): View => (v === "goldman" || v === "bny" ? v : "network");
