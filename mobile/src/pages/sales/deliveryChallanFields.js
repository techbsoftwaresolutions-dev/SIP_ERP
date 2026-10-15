import { useEffect, useState } from "react";
import api from "../../api/client";

export const WAREHOUSES = ["Main Warehouse", "Packing Store", "Chennai Depot"];
export const STATUS_OPTIONS = ["Pending", "Dispatched", "In Transit", "Delivered"];

// Loads the live Customer/Sales Order lists the Delivery Challan form's
// dropdowns draw from.
export function useDeliveryChallanLookups() {
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api.swr("/api/sales/orders?page=1&pageSize=200", (r) => setSalesOrders(r.data || []));
    api.swr("/api/customers?page=1&pageSize=200", (r) => setCustomers(r.data || []));
  }, []);

  return { salesOrders, customers };
}

// Shared field definitions for the Delivery Challan form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
export function buildDeliveryChallanFields({ customers, salesOrders }) {
  return [
    {
      key: "customer",
      label: "Customer",
      type: "select",
      required: true,
      options: customers.length ? customers.map((c) => c.name) : [],
    },
    {
      key: "salesOrder",
      label: "Sales Order No",
      type: "select",
      options: salesOrders.length ? salesOrders.map((s) => s.orderNo) : [],
    },
    { key: "product", label: "Products", required: true, placeholder: "Enter your products" },
    { key: "dispatchedQty", label: "Dispatched Qty", type: "number", required: true, min: 1, placeholder: "Enter your dispatched quantity" },
    { key: "unit", label: "Unit", type: "select", required: true, options: ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"] },
    { key: "warehouse", label: "Warehouse", type: "select", options: WAREHOUSES },
    { key: "transporter", label: "Transporter", placeholder: "Enter your transporter" },
    { key: "vehicleNo", label: "Vehicle No.", placeholder: "Enter your vehicle number" },
    { key: "items", label: "Items", type: "number", placeholder: "Enter your items count" },
    { key: "status", label: "Delivery Status", type: "select", required: true, options: STATUS_OPTIONS },
  ];
}
