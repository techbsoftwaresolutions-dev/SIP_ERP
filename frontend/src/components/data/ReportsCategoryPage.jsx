import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../layout/PageHeader";
import Loader from "../ui/Loader";

export default function ReportsCategoryPage({ title, crumbs, category }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    api
      .get(`/api/reports${query}`)
      .then(setReports)
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      {loading ? (
        <div className="loading-row"><Loader /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="loading-row">No reports in this category yet.</div>
        </div>
      ) : (
        <div className="report-grid">
          {reports.map((r) => (
            <div className="report-card" key={r.id}>
              <span className="cat">{r.category}</span>
              <h3>{r.name}</h3>
              <p>{r.description}</p>            </div>
          ))}
        </div>
      )}
    </div>
  );
}
