import ExcelJS from "exceljs";

const normalizeCell = (value) => {
  if (value === undefined || value === null) return "";
  return value;
};

const buildSheetObject = (records = []) => {
  const source = Array.isArray(records) ? records : [];
  const headers = source.length > 0 && typeof source[0] === "object" ? Object.keys(source[0]) : [];
  const rows = source.map((row) => {
    if (headers.length === 0) {
      return [normalizeCell(row)];
    }
    return headers.map((header) => normalizeCell(row?.[header]));
  });

  return {
    __headers: headers,
    __rows: rows,
    "!cols": [],
    name: "Sheet1",
  };
};

const toPlainRows = (worksheet) => {
  if (!worksheet) return [];
  const rows = worksheet.__rows ?? [];
  if (rows.length === 0 && Array.isArray(worksheet.__data)) return worksheet.__data;
  return rows;
};

const toExcelWorkbook = async (workbookLike) => {
  const workbook = new ExcelJS.Workbook();
  const sheets = workbookLike?.sheets ?? Object.values(workbookLike?.Sheets ?? {});

  for (const sheetLike of sheets) {
    const name = sheetLike?.name || sheetLike?.__name || "Sheet1";
    const rows = Array.isArray(sheetLike?.__rows) ? sheetLike.__rows : [];
    const worksheet = workbook.addWorksheet(name);

    if (Array.isArray(sheetLike?.__headers) && sheetLike.__headers.length > 0) {
      worksheet.addRow(sheetLike.__headers.map((header) => normalizeCell(header)));
      rows.forEach((row) => worksheet.addRow((Array.isArray(row) ? row : []).map((cell) => normalizeCell(cell))));
    } else {
      rows.forEach((row) => worksheet.addRow((Array.isArray(row) ? row : []).map((cell) => normalizeCell(cell))));
    }

    const widthConfig = Array.isArray(sheetLike?.["!cols"]) ? sheetLike["!cols"] : [];
    if (widthConfig.length > 0) {
      worksheet.columns = widthConfig.map((column, index) => ({
        key: `col${index + 1}`,
        width: column?.wch ?? undefined,
      }));
    }
  }

  return workbook;
};

const XLSX = {
  utils: {
    json_to_sheet(records) {
      return buildSheetObject(records);
    },
    sheet_to_json(worksheet, options = {}) {
      const rows = toPlainRows(worksheet);
      const headerOption = options.header ?? 1;

      if (headerOption === 1) {
        const headers = worksheet?.__headers || [];
        if (headers.length > 0) {
          return rows.map((row) => {
            const entry = {};
            headers.forEach((header, index) => {
              entry[header] = Array.isArray(row) ? row[index] ?? "" : row?.[header] ?? "";
            });
            return entry;
          });
        }

        if (rows.length === 0) return [];
        return rows.map((row) => (Array.isArray(row) ? row : [row]));
      }

      if (Array.isArray(headerOption)) {
        return rows.map((row) => {
          const entry = {};
          headerOption.forEach((key, index) => {
            entry[key] = Array.isArray(row) ? row[index] ?? "" : row?.[key] ?? "";
          });
          return entry;
        });
      }

      return [];
    },
    book_new() {
      return {
        SheetNames: [],
        Sheets: {},
        sheets: [],
      };
    },
    book_append_sheet(workbook, worksheet, name) {
      const safeName = name || worksheet?.name || "Sheet1";
      const sheet = { ...(worksheet || {}), name: safeName, __name: safeName };
      workbook.Sheets[safeName] = sheet;
      workbook.SheetNames.push(safeName);
      workbook.sheets.push(sheet);
      return sheet;
    },
  },
  async read(data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const source = data && data.buffer && data.buffer instanceof ArrayBuffer ? data.buffer : data;

    if (!source) {
      throw new Error("Excel data is required.");
    }

    await workbook.xlsx.load(source, { cellDates: !!options.cellDates });

    const compatWorkbook = { SheetNames: [], Sheets: {} };

    workbook.eachSheet((sheet) => {
      const rawRows = sheet.getSheetValues().slice(1);
      const rows = rawRows.map((row) => (Array.isArray(row) ? row.slice(1) : []));
      const headers = rows[0] || [];
      const dataRows = rows.slice(1);

      compatWorkbook.SheetNames.push(sheet.name);
      compatWorkbook.Sheets[sheet.name] = {
        __headers: headers,
        __rows: dataRows,
        name: sheet.name,
        "!cols": [],
      };
    });

    return compatWorkbook;
  },
  async writeFile(workbook, filename) {
    const outputWorkbook = await toExcelWorkbook(workbook);
    const buffer = await outputWorkbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  writeFileXLSX: async (workbook, filename) => {
    await XLSX.writeFile(workbook, filename);
  },
};

export const utils = XLSX.utils;
export const writeFile = XLSX.writeFile;
export const writeFileXLSX = XLSX.writeFileXLSX;
export const read = XLSX.read;

export default XLSX;
