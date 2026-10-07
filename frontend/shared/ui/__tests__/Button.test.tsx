import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/shared/ui/Button';

describe('Button', () => {
  it('テキストが表示される', () => {
    render(<Button>保存</Button>);
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('クリックハンドラーが呼ばれる', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>ボタン</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('disabled 時にクリックハンドラーが呼ばれない', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button disabled onClick={handler}>ボタン</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('disabled 属性が button に付く', () => {
    render(<Button disabled>ボタン</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('variant ごとに異なるクラスが適用される', () => {
    const { rerender } = render(<Button variant="primary">ボタン</Button>);
    const primaryClass = screen.getByRole('button').className;

    rerender(<Button variant="danger">ボタン</Button>);
    const dangerClass = screen.getByRole('button').className;

    rerender(<Button variant="secondary">ボタン</Button>);
    const secondaryClass = screen.getByRole('button').className;

    expect(primaryClass).not.toBe(dangerClass);
    expect(primaryClass).not.toBe(secondaryClass);
    expect(dangerClass).not.toBe(secondaryClass);
  });
});
