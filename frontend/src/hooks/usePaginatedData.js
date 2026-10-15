import { useEffect, useState, useCallback, useRef } from "react";
import api, { readSwr, writeSwr } from "../api/client";

const buildPath = (endpoint, page, pageSize, params) =>
  `${endpoint}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...params }).toString()}`;

export default function usePaginatedData(endpoint, { pageSize = 5, params = {} } = {}) {
  const [page, setPage] = useState(1);
  // The last answer for this exact list is shown immediately (no spinner) and
  // then replaced by the fresh one — revisiting a screen feels instant.
  const [data, setData] = useState(() => readSwr(buildPath(endpoint, 1, pageSize, params)) || { data: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(() => !readSwr(buildPath(endpoint, 1, pageSize, params)));
  const latest = useRef(0);

  const paramsKey = JSON.stringify(params);

  // `fresh` is used after a create/edit/delete: skip the cached copy so a
  // removed row can't flash back on screen.
  const load = useCallback(
    async (fresh = false) => {
      const path = buildPath(endpoint, page, pageSize, params);
      const ticket = ++latest.current;
      const cached = fresh ? null : readSwr(path);
      if (cached) {
        setData(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      try {
        const result = await api.get(path);
        writeSwr(path, result);
        // Ignore an answer that arrives after a newer request was made
        // (fast typing in a search box, quick page changes).
        if (ticket === latest.current) setData(result);
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, page, pageSize, paramsKey]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [paramsKey]);

  const reload = useCallback(() => load(true), [load]);

  return { ...data, page, setPage, loading, reload };
}
