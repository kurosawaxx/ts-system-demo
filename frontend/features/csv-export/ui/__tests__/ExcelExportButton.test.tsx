import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import { ExcelExportButton } from '@/features/csv-export/ui/ExcelExportButton';

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

interface Row {
  name: string;
  amount: number;
}

const rows: Row[] = [
  { name: '案件A', amount: 100 },
  { name: '案件B', amount: 200 },
];

const columns = [
  { label: '名称', getValue: (r: Row) => r.name },
  { label: '金額', getValue: (r: Row) => r.amount },
];

const defaultProps = {
  rows,
  columns,
  fileName: 'テスト',
  storageKey: 'test:excelExportButton',
};

describe('ExcelExportButton', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('ボタンをクリックすると項目選択モーダルが開く', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);

    expect(screen.queryByText('エクスポート項目の選択')).not.toBeInTheDocument();
    await user.click(screen.getByText('Excelエクスポート'));
    expect(screen.getByText('エクスポート項目の選択')).toBeInTheDocument();
  });

  it('すべての項目ラベルがチェックボックスとして表示され、デフォルトで選択済み', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);
    await user.click(screen.getByText('Excelエクスポート'));

    columns.forEach(c => {
      expect(screen.getByLabelText(c.label)).toBeChecked();
    });
  });

  it('チェックを外すと選択が解除される', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);
    await user.click(screen.getByText('Excelエクスポート'));

    await user.click(screen.getByLabelText('金額'));
    expect(screen.getByLabelText('金額')).not.toBeChecked();
  });

  it('「エクスポート実行」で選択済み列のみを対象にxlsxが生成され、モーダルが閉じる', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);
    await user.click(screen.getByText('Excelエクスポート'));

    await user.click(screen.getByLabelText('金額'));
    await user.click(screen.getByText('エクスポート実行'));

    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([
      ['名称'],
      ['案件A'],
      ['案件B'],
    ]);
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [, fileName] = vi.mocked(XLSX.writeFile).mock.calls[0];
    expect(fileName).toMatch(/^テスト_\d{4}-\d{2}-\d{2}\.xlsx$/);

    await waitFor(() => {
      expect(screen.queryByText('エクスポート項目の選択')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('「全項目選択」でリセットされる', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);
    await user.click(screen.getByText('Excelエクスポート'));

    await user.click(screen.getByLabelText('金額'));
    expect(screen.getByLabelText('金額')).not.toBeChecked();

    await user.click(screen.getByText('全項目選択'));
    expect(screen.getByLabelText('金額')).toBeChecked();
  });

  it('「キャンセル」でモーダルが閉じる', async () => {
    const user = userEvent.setup();
    render(<ExcelExportButton {...defaultProps} />);
    await user.click(screen.getByText('Excelエクスポート'));

    await user.click(screen.getByText('キャンセル'));

    await waitFor(() => {
      expect(screen.queryByText('エクスポート項目の選択')).not.toBeInTheDocument();
    }, { timeout: 500 });
    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });
});
