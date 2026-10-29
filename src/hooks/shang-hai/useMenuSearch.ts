"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/commerce/types";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";

/** Accent-insensitive menu search ("pato pekin" finds "Pato a la Pekinesa"). */
export function useMenuSearch() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results: MenuItem[] = useMemo(
    () => (deferred.trim() ? shangHaiCatalog.search(deferred) : []),
    [deferred],
  );
  return { query, setQuery, results, active: query.trim().length > 0 };
}
