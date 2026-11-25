type Row = { point: string; name: string; data: any };

export function consolidatePanel(metric: 'sales' | 'receivables' | 'top-products', rows: Row[]) {
  // The oldest source timestamp reflects the freshness of the entire summary.
  const updated_at = rows.map(row => row.data.updated_at).filter(Boolean)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const sum = (value: (data: any) => number) => rows.reduce((total, row) => total + value(row.data), 0);
  if (metric === 'sales') return {
    updated_at, total: sum(data => data.total), sale_count: sum(data => data.sale_count),
    payments: Object.fromEntries(['cash', 'transfer', 'nequi', 'credit', 'other'].map(key => [key, sum(data => data.payments[key] ?? 0)])),
  };
  if (metric === 'receivables') return {
    updated_at, summary: {
      amount: sum(data => data.summary.amount), customer_count: sum(data => data.summary.customer_count),
    },
  };
  // POS product IDs are local, and each API returns only its top ten.
  // Rank product/sede pairs, rather than imply a complete global SKU ranking.
  return { updated_at, products: rows.flatMap(row => row.data.products.map((product: any) => ({
    ...product, id: `${row.point}:${product.id}`, point_name: row.name,
  }))).sort((a, b) => b.units - a.units || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).slice(0, 5) };
}
