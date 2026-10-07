import { vi, describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/shared/ui/Modal';

describe('Modal', () => {
  it('title と children が表示される', () => {
    render(<Modal title="設定" onClose={vi.fn()}>内容テキスト</Modal>);
    expect(screen.getByText('設定')).toBeInTheDocument();
    expect(screen.getByText('内容テキスト')).toBeInTheDocument();
  });

  it('✕ ボタンをクリックすると onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { getByRole } = render(<Modal title="設定" onClose={onClose}>内容</Modal>);

    await user.click(getByRole('button'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 500 });
  });

  it('Escape キーで onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal title="設定" onClose={onClose}>内容</Modal>);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 500 });
  });
});
