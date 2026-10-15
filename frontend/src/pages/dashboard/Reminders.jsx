import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";

const TYPES = [
  { key: "all", label: "All" },
  { key: "receivable", label: "Payments In", icon: "banknote" },
  { key: "payable", label: "Payments Out", icon: "wallet" },
  { key: "low-stock", label: "Low Stock", icon: "package" },
  { key: "delivery", label: "Deliveries", icon: "truck" },
  { key: "purchase-order", label: "Purchase Orders", icon: "cart" },
];

const ICON_FOR = {
  receivable: "banknote",
  payable: "wallet",
  "low-stock": "package",
  delivery: "truck",
  "purchase-order": "cart",
};

function whenLabel(item) {
  if (item.days === null || item.days === undefined) return item.dueDate || "";
  if (item.days < 0) return `${Math.abs(item.days)} day${Math.abs(item.days) === 1 ? "" : "s"} overdue`;
  if (item.days === 0) return "Due today";
  if (item.days === 1) return "Due tomorrow";
  return `Due in ${item.days} days`;
}

export default function Reminders() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api
      .get("/api/reminders")
      .then(setData)
      .catch((err) => setError(err.message || "Could not load reminders."));
  }, []);

  if (error) {
    return (
      <div>
        <PageHeader title="Reminders" crumbs={["Dashboard", "Reminders"]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Reminders" crumbs={["Dashboard", "Reminders"]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const items = filter === "all" ? data.items : data.items.filter((i) => i.type === filter);

  return (
    <div>
      <PageHeader
        title="Reminders"
        crumbs={["Dashboard", "Reminders"]}
        actions={
          <div className="sales-filter-pill">
            <Icon name="bell" size={15} /> {data.counts.overdue} overdue · {data.counts.dueSoon} due soon
          </div>
        }
      />

      <div className="rem-tabs">
        {TYPES.map((t) => {
          const count = t.key === "all" ? data.counts.total : data.byType[t.key] || 0;
          return (
            <button
              key={t.key}
              type="button"
              className={`rem-tab${filter === t.key ? " active" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label} <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="list-card">
        {items.length === 0 ? (
          <div className="rem-empty">
            <Icon name="checkCircle" size={26} />
            <div>Nothing needs attention here.</div>
          </div>
        ) : (
          items.map((item, i) => (
            <Link className="rem-row" to={item.link} key={`${item.type}-${i}`}>
              <span className={`rem-icon ${item.severity}`}>
                <Icon name={ICON_FOR[item.type] || "bell"} size={16} />
              </span>
              <div className="rem-body">
                <div className="rem-title">{item.title}</div>
                <div className="rem-sub">{item.subtitle}</div>
              </div>
              <span className={`rem-when ${item.severity}`}>{whenLabel(item)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
