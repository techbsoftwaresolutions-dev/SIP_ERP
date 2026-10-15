import Icon from "../ui/Icon";

export default function Pagination({ page, pageSize, total, totalPages, onPageChange, noun = "entries" }) {
  if (total === 0) {
    return (
      <div className="table-footer">
        <span>No {noun}</span>
      </div>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = [];
  const maxButtons = 5;
  let from = Math.max(1, page - Math.floor(maxButtons / 2));
  const to = Math.min(totalPages, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  for (let p = from; p <= to; p++) pages.push(p);

  return (
    <div className="table-footer">
      <span>
        Showing {start} - {end} of {total.toLocaleString("en-IN")} {noun}
      </span>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <Icon name="chevronLeft" size={15} />
        </button>
        {from > 1 && (
          <>
            <button onClick={() => onPageChange(1)}>1</button>
            {from > 2 && <span className="pagination-gap">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            className={p === page ? "active" : ""}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {to < totalPages && (
          <>
            {to < totalPages - 1 && <span className="pagination-gap">…</span>}
            <button onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}
