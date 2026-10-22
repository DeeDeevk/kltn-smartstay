import React from "react";
import Button from "./Button";

export default function Pagination({
  page,
  totalPages,
  summary,
  onChange,
  prevLabel = "Trước",
  nextLabel = "Sau",
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
      <span className="text-gray-500">{summary}</span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {prevLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
