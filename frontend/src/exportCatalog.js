const headers = ['ID', 'Товар', 'Категория', 'Дата производства'];
const title = 'Фасоль — каталог товаров';

function download(blob, extension) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fasol-products.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function htmlDocument(rows) {
  const report = document.implementation.createHTMLDocument(title);
  const charset = report.createElement('meta');
  charset.setAttribute('charset', 'UTF-8');
  report.head.prepend(charset);
  report.documentElement.lang = 'ru';
  const style = report.createElement('style');
  style.textContent = 'body{font:16px system-ui;margin:2rem}table{border-collapse:collapse}th,td{border:1px solid #555;padding:.5rem;text-align:left}th{background:#eee}';
  report.head.append(style);
  const heading = report.createElement('h1');
  heading.textContent = title;
  const table = report.createElement('table');
  const header = table.createTHead().insertRow();
  for (const value of headers) {
    const cell = report.createElement('th');
    cell.scope = 'col';
    cell.textContent = value;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  report.body.append(heading, table);
  return new Blob(['<!doctype html>\n', report.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
}

export async function exportCatalog(format, products) {
  const rows = products.map(({ id, name, category, date }) => [String(id), name, category, date || '—']);
  if (format === 'html') {
    download(htmlDocument(rows), format);
    return;
  }
  if (format === 'docx') {
    const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import('docx');
    const tableRows = [headers, ...rows].map((values, index) => new TableRow({
      tableHeader: index === 0,
      children: values.map((text) => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: index === 0 })] })],
      })),
    }));
    const report = new Document({ sections: [{ children: [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
    ] }] });
    download(await Packer.toBlob(report), format);
    return;
  }
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  await pdfMake.createPdf({
    info: { title },
    pageSize: 'A4',
    defaultStyle: { fontSize: 10 },
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'right', margin: [0, 8, 40, 0] }),
    content: [
      { text: title, bold: true, fontSize: 17, margin: [0, 0, 0, 14] },
      { table: {
        headerRows: 1,
        widths: [28, '*', '*', 90],
        body: [headers.map((text) => ({ text, bold: true, fillColor: '#eeeeee' })), ...rows],
      } },
    ],
  }).download('fasol-products.pdf');
}
