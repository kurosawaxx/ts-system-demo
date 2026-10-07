import { vi, describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnSettingsModal } from '@/features/project/ui/ColumnSettingsModal';
import { COL_LABELS } from '@/features/project/config/columns';

const defaultProps = {
  visibleCols: new Set([0, 1, 2]),
  onToggle: vi.fn(),
  onReset: vi.fn(),
  onClose: vi.fn(),
};

describe('ColumnSettingsModal', () => {
  it('すべての列ラベルがチェックボックスとして表示される', () => {
    render(<ColumnSettingsModal {...defaultProps} />);
    COL_LABELS.forEach(label => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
  });

  it('visibleCols に含まれる列はチェック済み', () => {
    render(<ColumnSettingsModal {...defaultProps} />);
    expect(screen.getByLabelText(COL_LABELS[0])).toBeChecked();
    expect(screen.getByLabelText(COL_LABELS[1])).toBeChecked();
    expect(screen.getByLabelText(COL_LABELS[3])).not.toBeChecked();
  });

  it('チェックボックスを切り替えると onToggle が呼ばれる', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ColumnSettingsModal {...defaultProps} onToggle={onToggle} />);
    await user.click(screen.getByLabelText(COL_LABELS[0]));
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('「設定をリセット」ボタンで onReset が呼ばれる', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ColumnSettingsModal {...defaultProps} onReset={onReset} />);
    await user.click(screen.getByText('設定をリセット'));
    expect(onReset).toHaveBeenCalled();
  });

  it('「設定を保存」ボタンで onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ColumnSettingsModal {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '設定を保存' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 500 });
  });

});
