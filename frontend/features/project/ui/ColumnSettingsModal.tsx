'use client';

import { Button } from '@/shared/ui/Button';
import { Modal, useModalClose } from '@/shared/ui/Modal';
import { COL_LABELS } from '@/features/project/config/columns';

interface Props {
  visibleCols: Set<number>;
  onToggle: (i: number) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ColumnSettingsModal({ visibleCols, onToggle, onReset, onClose }: Props) {
  return (
    <Modal title="表示項目の設定" onClose={onClose}>
      <ColumnSettingsContent visibleCols={visibleCols} onToggle={onToggle} onReset={onReset} />
    </Modal>
  );
}

function ColumnSettingsContent({ visibleCols, onToggle, onReset }: Omit<Props, 'onClose'>) {
  const modalClose = useModalClose();
  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {COL_LABELS.map((label, i) => (
          <label key={i} className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleCols.has(i)}
              onChange={() => onToggle(i)}
              className="accent-[#0090B9]"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <button
          onClick={onReset}
          className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          設定をリセット
        </button>
        <Button onClick={modalClose}>設定を保存</Button>
      </div>
    </>
  );
}
