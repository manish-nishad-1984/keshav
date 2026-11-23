import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

// The company name of this installation (Settings → Company), shown on the login page, top bar,
// sidebar, footer and browser tab. Kept in localStorage so it shows instantly on the next visit.
const KEY = "brand-name";
const readCached = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export const useBrand = () => {
  const { data } = useQuery({
    queryKey: ["brand"],
    queryFn: () => apiClient.get<{ name: string }>("/brand"),
    staleTime: 5 * 60 * 1000,
  });
  const name = data?.name || readCached();

  useEffect(() => {
    if (!data?.name) return;
    try {
      localStorage.setItem(KEY, data.name);
    } catch {
      /* private mode */
    }
  }, [data?.name]);

  useEffect(() => {
    if (name) document.title = name;
  }, [name]);

  // "Keshav Trading & Co" → first word bold, the rest lighter (as the design had it).
  const [first = "", ...rest] = name.split(" ");
  return { name, first, rest: rest.join(" ") };
};
