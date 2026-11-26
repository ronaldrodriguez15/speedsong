import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { api } from "./api";

export interface ReceivablesReport {
  point: { id: string; name: string };
  customer: { id: string; name: string };
  credits: { id: string; reference: string; sale_date: string; age_days: number; amount: number; comment: string }[];
  over_60: number; over_90: number; over_120: number; paid: number | null;
  amount: number; total: number; as_of: string; updated_at: string; generated_at: string;
}
type LogoImage = { data: string; width: number; height: number };
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 }).format(value).replace(/\u00a0/g, " ");
const date = (value: string) => value.split("-").reverse().join("/");
const dateTime = (value: string) => new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function buildReceivablesPdf(report: ReceivablesReport, logo?: LogoImage) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `Cartera - ${report.customer.name}`, subject: `Créditos pendientes · ${report.point.name}`, author: "SpeedSong", creator: "SpeedSong" });
  const finalY = () => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const header = () => {
    doc.setFillColor(35, 136, 232); doc.rect(0, 0, 210, 32, "F");
    doc.setFillColor(18, 107, 199); doc.rect(0, 31, 210, 1, "F");
    if (logo) {
      const scale = Math.min(48 / logo.width, 14 / logo.height);
      doc.addImage(logo.data, "PNG", 16, 9, logo.width * scale, logo.height * scale);
    } else { doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text("SpeedSong", 16, 20); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text("REPORTE DE CARTERA", 194, 13, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(report.point.name, 194, 21, { align: "right" });
  };
  autoTable(doc, {
    startY: 43, margin: { left: 16, right: 16, top: 43, bottom: 25 }, theme: "plain", showHead: false,
    body: [
      [{ content: "ESTADO DE CRÉDITOS PENDIENTES", styles: { fontSize: 9, textColor: [35, 136, 232], fontStyle: "bold" } }],
      [{ content: report.customer.name, styles: { fontSize: 20, fontStyle: "bold", textColor: [24, 50, 75], cellPadding: { top: 2, bottom: 5, left: 0, right: 0 } } }],
      [{ content: `Cliente #${report.customer.id}  ·  Corte al ${date(report.as_of)}`, styles: { textColor: [100, 116, 139], fontSize: 9 } }],
    ], styles: { font: "helvetica", cellPadding: 0, overflow: "linebreak" }, willDrawPage: header,
  });
  autoTable(doc, {
    startY: finalY() + 7, margin: { left: 16, right: 16, top: 43, bottom: 25 }, theme: "plain",
    body: [[{ content: "SALDO PENDIENTE POR COBRAR", styles: { fontSize: 8, textColor: [18, 107, 199] } }, { content: `${report.total} créditos`, styles: { halign: "right", fontSize: 10 } }],
      [{ content: money(report.amount), styles: { fontSize: 24, fontStyle: "bold", textColor: [18, 86, 162] } }, { content: "Pesos colombianos (COP)", styles: { halign: "right", valign: "middle", fontSize: 9 } }]],
    styles: { fillColor: [239, 248, 255], textColor: [71, 85, 105], cellPadding: 5, font: "helvetica", overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 116 }, 1: { cellWidth: 62 } }, willDrawPage: header,
  });
  autoTable(doc, {
    startY: finalY() + 7, margin: { left: 16, right: 16, top: 43, bottom: 25 }, theme: "plain",
    body: [["Incluye todos los créditos pendientes, sin límite de antigüedad. Los importes reflejan el saldo por cobrar, con los abonos aplicados por el punto de venta."]],
    styles: { font: "helvetica", fontSize: 9, textColor: [100, 116, 139], cellPadding: 0, overflow: "linebreak" }, willDrawPage: header,
  });
  autoTable(doc, {
    startY: finalY() + 7, margin: { left: 16, right: 16, top: 43, bottom: 25 }, theme: "striped", showHead: "everyPage", showFoot: "lastPage", rowPageBreak: "avoid",
    head: [["Venta / Observaciones", "Fecha de venta", "Antigüedad", "Saldo pendiente"]],
    body: report.credits.map(credit => [credit.reference + (credit.comment ? `\n${credit.comment}` : ""), date(credit.sale_date), `${credit.age_days} días`, money(credit.amount)]),
    foot: [[{ content: `TOTAL · ${report.total} CRÉDITOS`, colSpan: 3 }, money(report.amount)]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak", textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: [24, 63, 109], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [239, 248, 255], textColor: [18, 86, 162], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 71 }, 1: { cellWidth: 32 }, 2: { cellWidth: 28, halign: "center" }, 3: { cellWidth: 47, halign: "right", fontStyle: "bold" } },
    willDrawPage: header,
  });
  autoTable(doc, {
    startY: finalY() + 7, margin: { left: 16, right: 16, top: 43, bottom: 25 }, theme: "striped",
    body: [['Saldo mayor a 60 días', money(report.over_60)], ['Saldo mayor a 90 días', money(report.over_90)], ['Saldo mayor a 120 días', money(report.over_120)], ['Pagado en las ventas con crédito pendiente', report.paid === null ? 'No disponible' : money(report.paid)], ['Antigüedad', 'Saldos acumulativos desde la fecha de venta.']],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 }, willDrawPage: header,
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(226, 232, 240); doc.line(16, 277, 194, 277);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(`Datos consultados: ${dateTime(report.updated_at)} · Colombia`, 16, 282);
    doc.text(`Generado: ${dateTime(report.generated_at)} · Reporte informativo de cartera`, 16, 287);
    doc.text(`Página ${page} de ${pages}`, 194, 282, { align: "right" });
  }
  return doc;
}

async function loadLogo(): Promise<LogoImage | undefined> {
  return new Promise(resolve => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(undefined), 5000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) { resolve(undefined); return; }
        context.drawImage(image, 0, 0);
        resolve({ data: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      } catch { resolve(undefined); }
    };
    image.onerror = () => { clearTimeout(timer); resolve(undefined); };
    image.src = `${import.meta.env.BASE_URL}logo.avif`;
  });
}

export async function downloadReceivablesPdf(point: string, customer: string, snapshot: string, signal: AbortSignal) {
  const { data } = await api.get<{ data: ReceivablesReport }>(`/points-of-sale/${point}/receivables/${customer}/report`, { params: { snapshot }, signal, feedback: false, timeout: 90000 });
  const logo = await loadLogo();
  if (signal.aborted) return;
  const report = data.data;
  const doc = buildReceivablesPdf(report, logo);
  const filename = `cartera-${point}-cliente-${customer}-${report.as_of}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");
  doc.save(filename);
}
