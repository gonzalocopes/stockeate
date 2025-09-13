import * as Print from "expo-print";

export async function renderRemitoHTML({ numero, items }:{ numero:string, items: {code?:string,name:string,qty:number}[] }) {
  const rows = items.map(i => `
    <tr>
      <td>${i.code ?? ""}</td>
      <td>${i.name}</td>
      <td style="text-align:right">${i.qty}</td>
    </tr>
  `).join("");
  return `
  <html>
    <body style="font-family: Arial; padding: 16px">
      <h2>Remito ${numero}</h2>
      <table width="100%" style="border-collapse: collapse">
        <thead>
          <tr>
            <th style="text-align:left">Código</th>
            <th style="text-align:left">Producto</th>
            <th style="text-align:right">Cant.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top: 16px">Generado por Stockeate</p>
    </body>
  </html>`;
}

export async function makeRemitoPDF(args:{ numero:string, items:any[] }) {
  const html = await renderRemitoHTML(args);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
