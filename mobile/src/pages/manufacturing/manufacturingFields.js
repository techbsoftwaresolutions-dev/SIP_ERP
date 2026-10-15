import { JOB_CARD_STATUSES, MACHINE_STATUSES, UNITS } from "./manufacturingLookups";

// Form field definitions for the manufacturing master records. Kept here so
// each list page and its standalone Add/Edit page share one definition.
// The builders take the lookup lists the dropdowns need.

export const WORK_CENTER_FIELDS = [
  { key: "name", label: "Work Center Name", required: true, placeholder: "e.g. Press Line 1" },
  { key: "code", label: "Short Code", placeholder: "e.g. PL1" },
  { key: "location", label: "Location", placeholder: "e.g. Shed B" },
  { key: "supervisor", label: "Supervisor", placeholder: "Who runs this area" },
  { key: "capacityPerDay", label: "Capacity / Day", type: "number", placeholder: "Rated output per working day" },
  { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
  { key: "workingHoursPerDay", label: "Working Hours / Day", type: "number", defaultValue: 8 },
  { key: "costPerHour", label: "Cost / Hour (₹)", type: "number", placeholder: "Used to cost BOM routing steps" },
  { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], defaultValue: "Active" },
  { key: "description", label: "Description", type: "textarea", full: true },
];

export function buildMachineFields({ workCenters = [] }) {
  return [
    { key: "name", label: "Machine Name", required: true, placeholder: "e.g. Hydraulic Press 40T" },
    { key: "code", label: "Asset Code", placeholder: "e.g. HP-40" },
    {
      key: "workCenter",
      label: "Work Center",
      type: "combo",
      options: workCenters.map((w) => w.name),
      placeholder: "Which area this machine sits in",
    },
    { key: "machineType", label: "Machine Type", placeholder: "e.g. Press, Lathe, CNC" },
    { key: "manufacturer", label: "Manufacturer", placeholder: "Make" },
    { key: "serialNo", label: "Serial No.", placeholder: "Manufacturer serial number" },
    { key: "installedOn", label: "Installed On", type: "date" },
    { key: "capacityPerHour", label: "Capacity / Hour", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
    { key: "status", label: "Status", type: "select", options: MACHINE_STATUSES, defaultValue: "Idle" },
    { key: "lastServiceDate", label: "Last Service Date", type: "date" },
    { key: "nextServiceDate", label: "Next Service Date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];
}

export function buildJobCardFields({ workOrders = [], workCenters = [], machines = [] }) {
  return [
    {
      key: "workOrder",
      label: "Work Order",
      type: "combo",
      required: true,
      options: workOrders.map((w) => w.id),
      full: true,
    },
    {
      key: "product",
      label: "Product",
      deriveFrom: { field: "workOrder", source: workOrders, match: "id", pick: "product" },
      placeholder: "Filled in from the work order",
    },
    { key: "operation", label: "Operation", required: true, placeholder: "e.g. Press, Weld, Paint" },
    { key: "sequence", label: "Sequence", type: "number" },
    { key: "workCenter", label: "Work Center", type: "combo", options: workCenters.map((w) => w.name) },
    { key: "machine", label: "Machine", type: "combo", options: machines.map((m) => m.name) },
    { key: "operator", label: "Operator" },
    { key: "shift", label: "Shift", type: "select", options: ["Shift A", "Shift B", "Shift C", "General"] },
    { key: "plannedQty", label: "Planned Qty", type: "number" },
    { key: "completedQty", label: "Completed Qty", type: "number" },
    { key: "rejectedQty", label: "Rejected Qty", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
    { key: "date", label: "Date", type: "date" },
    { key: "startTime", label: "Start Time" },
    { key: "endTime", label: "End Time" },
    { key: "hours", label: "Hours Booked", type: "number" },
    { key: "status", label: "Status", type: "select", options: JOB_CARD_STATUSES, defaultValue: "Pending" },
    { key: "remarks", label: "Remarks", type: "textarea", full: true },
  ];
}
