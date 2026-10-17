"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Row = { value: string; quantity: string };

const DEFAULT_ROWS: Row[] = [
  { value: "0.25", quantity: "100" },
  { value: "0.5", quantity: "100" },
  { value: "1", quantity: "50" },
  { value: "5", quantity: "25" },
];

export default function NewChipSetPage() {
  const router = useRouter();
  const [name, setName] = useState("Standard set");
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { value: "", quantity: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const denominations = rows
      .filter((r) => r.value.trim() !== "" && r.quantity.trim() !== "")
      .map((r) => ({ value: Number(r.value), quantity: Number(r.quantity) }));

    if (denominations.length === 0) {
      setError("Add at least one denomination.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/chip-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, denominations }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/chip-sets");
    router.refresh();
  }

  return (
    <div className="page-narrow">
      <h1 className="page-title">New chip set</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 input"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-sm font-medium">
            <span>Denomination ($)</span>
            <span>Quantity owned</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.25"
                value={row.value}
                onChange={(e) => updateRow(i, "value", e.target.value)}
                className="px-3 py-2 input"
              />
              <input
                type="number"
                min="0"
                placeholder="100"
                value={row.quantity}
                onChange={(e) => updateRow(i, "quantity", e.target.value)}
                className="px-3 py-2 input"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-sm text-muted hover:text-foreground"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="self-start text-sm underline"
          >
            + Add denomination
          </button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="self-start px-4 py-2 text-sm disabled:opacity-50 btn-primary"
        >
          {loading ? "Saving..." : "Save chip set"}
        </button>
      </form>
    </div>
  );
}
