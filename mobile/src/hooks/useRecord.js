import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/client";

// Loads one record for a detail screen and reloads it whenever the screen
// regains focus (e.g. after coming back from its Edit screen).
export default function useRecord(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const first = useRef(true);

  const load = useCallback(
    async (mode) => {
      if (!path) return;
      if (mode === "refresh") setRefreshing(true);
      try {
        const r = await api.get(path);
        setData(r);
        setError("");
      } catch (err) {
        setError(err.message || "Could not load this record.");
      } finally {
        setRefreshing(false);
      }
    },
    [path]
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      load();
    }, [load])
  );

  return { data, error, refreshing, reload: () => load("refresh"), setData };
}

// Loads a list endpoint once (for lookups/dropdowns); returns rows.
export function useList(path, deps = []) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .swr(path, (r) => !cancelled && setRows(Array.isArray(r) ? r : r.data || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return rows;
}
