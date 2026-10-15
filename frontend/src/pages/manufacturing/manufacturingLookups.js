import { useEffect, useState } from "react";
import api from "../../api/client";

export const ITEM_TYPES = ["Raw Material", "Semi-Finished", "Finished Good", "Consumable", "Spare Part"];
export const UNITS = ["Nos", "Pcs", "Kg", "Litre", "Metre", "Box", "Set", "Roll", "Sheet"];
export const BOM_STATUSES = ["Draft", "Active", "Obsolete"];
export const WORK_ORDER_STATUSES = ["Draft", "Released", "In Progress", "Completed", "Cancelled"];
export const JOB_CARD_STATUSES = ["Pending", "In Progress", "Completed", "On Hold"];
export const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
export const MACHINE_STATUSES = ["Running", "Idle", "Under Maintenance", "Breakdown"];

const PAGE = "?page=1&pageSize=500";

// Loads the lists every manufacturing form picks from. Each caller asks only
// for what it needs, so a page that never shows machines does not fetch them.
//
// Deliberately unfiltered by item type: a sub-assembly is a finished good to
// one BOM and a component to the next, so restricting the pickers by type
// would make legitimate multi-level BOMs impossible to enter.
export function useManufacturingLookups({
  items = false,
  boms = false,
  workOrders = false,
  workCenters = false,
  machines = false,
  warehouses = false,
} = {}) {
  const [data, setData] = useState({
    items: [],
    boms: [],
    workOrders: [],
    workCenters: [],
    machines: [],
    warehouses: [],
  });

  useEffect(() => {
    const wanted = [
      items && ["items", "/api/items"],
      boms && ["boms", "/api/manufacturing/boms"],
      workOrders && ["workOrders", "/api/manufacturing/work-orders"],
      workCenters && ["workCenters", "/api/manufacturing/work-centers"],
      machines && ["machines", "/api/manufacturing/machines"],
      warehouses && ["warehouses", "/api/warehouses"],
    ].filter(Boolean);

    let cancelled = false;
    Promise.all(
      wanted.map(([key, path]) =>
        api
          .get(path + PAGE)
          .then((r) => [key, r.data || []])
          // One unreachable list must not blank out the whole form — that
          // field just shows no options, and the rest still works.
          .catch(() => [key, []])
      )
    ).then((pairs) => {
      if (!cancelled) setData((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });

    return () => {
      cancelled = true;
    };
  }, [items, boms, workOrders, workCenters, machines, warehouses]);

  return data;
}

export function inr(n) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function num(n) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
