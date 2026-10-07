'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/shared/ui/Button';
import { ExportIcon } from '@/shared/ui/Icon';
import { Modal, useModalClose } from '@/shared/ui/Modal';
import { useExportSelection } from '../model/useExportSelection';

export interface ExportColumn<T> {
  label: string;
  getValue: (row: T) => string | number | null | undefined;
}

interface Props<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  fileName: string;
  storageKey: string;
}

export function ExcelExportButton<T>({ rows, columns, fileName, storageKey }: Props<T>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-1.5">
          <ExportIcon size={14} />
          Excelエクスポート
        </span>
      </Button>

      {open && (
        <Modal title="エクスポート項目の選択" onClose={() => setOpen(false)}>
          <ExportModalContent rows={rows} columns={columns} fileName={fileName} storageKey={storageKey} />
        </Modal>
      )}
    </>
  );
}

function ExportModalContent<T>({ rows, columns, fileName, storageKey }: Props<T>) {
  const modalClose = useModalClose();
  const { selected, toggle, reset } = useExportSelection(columns.length, storageKey);

  const handleExport = () => {
    const cols = columns.filter((_, i) => selected.has(i));
    const header = cols.map(c => c.label);
    const body = rows.map(row => cols.map(c => c.getValue(row) ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${fileName}_${date}.xlsx`);
    modalClose();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {columns.map((c, i) => (
          <label key={i} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              className="accent-[#0090B9]"
            />
            {c.label}
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          全項目選択
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={modalClose}>キャンセル</Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>エクスポート実行</Button>
        </div>
      </div>
    </>
  );
}
