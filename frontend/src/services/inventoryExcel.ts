import ExcelJS from 'exceljs';

export interface InventoryResult {
  rows: { category?: string; description?: string; barcode?: string; id: string; reference: string; name: string; quantities: Record<string, number | null>; total: number | null }[];
  points: { id: string; name: string }[];
  total: number | null; page: number; last_page: number | null; has_more?: boolean; per_page?: number;
  updated_at: string;
  search: string;
  field: string;
}

export async function exportInventory(data: InventoryResult) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SpeedSong';
  const sheet = workbook.addWorksheet('Inventario', { views: [{ state: 'frozen', ySplit: 5, xSplit: 2 }] });
  const columns = 3 + data.points.length;
  sheet.mergeCells(1, 1, 1, columns);
  sheet.getCell('A1').value = data.points.length === 1 ? `SpeedSong · Inventario de ${data.points[0].name}` : 'SpeedSong · Inventario consolidado';
  sheet.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2388E8' } };
  sheet.getRow(1).height = 42;
  sheet.mergeCells(2, 1, 2, columns);
  sheet.getCell('A2').value = `Consulta: ${data.search || 'Todos los productos'} · ${data.field === 'product_id' ? 'Referencia' : 'Código de barras'}`;
  sheet.mergeCells(3, 1, 3, columns);
  sheet.getCell('A3').value = `Actualizado: ${new Date(data.updated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · Cantidades en unidades`;
  sheet.getRow(5).values = ['Producto', 'Referencia / código', ...data.points.map(p => p.name), 'Total'];
  sheet.getRow(5).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153D68' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  sheet.getRow(5).height = 26;
  data.rows.forEach((row, index) => {
    const excelRow = sheet.addRow([row.name, row.reference || 'Sin referencia (sin unificar)', ...data.points.map(p => row.quantities[p.id] ?? 'Sin dato'), row.total ?? 'Sin dato']);
    excelRow.height = 32;
    excelRow.eachCell((cell, col) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FD' } };
      if (col >= 3) cell.numFmt = '#,##0.######;[Red]-#,##0.######';
      if (col === columns) cell.font = { bold: true, color: { argb: 'FF126CC1' } };
    });
  });
  sheet.getColumn(1).width = 62;
  sheet.getColumn(2).width = 26;
  for (let col = 3; col <= columns; col++) sheet.getColumn(col).width = 18;
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + data.rows.length, column: columns } };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `inventario-${data.updated_at.slice(0, 10)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
