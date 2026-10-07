'use client';

import { Button } from '@/shared/ui/Button';
import { Modal, useModalClose } from '@/shared/ui/Modal';

interface Director {
  id: number;
  name: string;
}

interface Props {
  showDirectorFilter: boolean;
  directors: Director[];
  directorIds: number[];
  billingFrom: string;
  billingTo: string;
  codeFilter: string;
  clientFilter: string;
  projectNameFilter: string;
  onDirectorIdsChange: (ids: number[]) => void;
  onBillingRangeChange: (from: string, to: string) => void;
  onCodeChange: (v: string) => void;
  onClientChange: (v: string) => void;
  onProjectNameChange: (v: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export function ProjectFilterModal(props: Props) {
  return (
    <Modal title="絞り込み" onClose={props.onClose}>
      <ProjectFilterContent {...props} />
    </Modal>
  );
}

function ProjectFilterContent({
  showDirectorFilter, directors, directorIds, billingFrom, billingTo,
  codeFilter, clientFilter, projectNameFilter,
  onDirectorIdsChange, onBillingRangeChange, onCodeChange, onClientChange, onProjectNameChange, onReset,
}: Omit<Props, 'onClose'>) {
  const modalClose = useModalClose();

  const toggleDirector = (id: number) => {
    onDirectorIdsChange(directorIds.includes(id) ? directorIds.filter(x => x !== id) : [...directorIds, id]);
  };

  const inputCls = 'rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9] w-full';

  return (
    <>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">プロジェクトコード</p>
          <input type="text" value={codeFilter} onChange={e => onCodeChange(e.target.value)} className={inputCls} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">発注元</p>
          <input type="text" value={clientFilter} onChange={e => onClientChange(e.target.value)} className={inputCls} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">プロジェクト名</p>
          <input type="text" value={projectNameFilter} onChange={e => onProjectNameChange(e.target.value)} className={inputCls} />
        </div>
      </div>

      {showDirectorFilter && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-700">アカウントディレクター</p>
          {directors.length === 0 ? (
            <p className="text-sm text-gray-400">登録されているディレクターがいません</p>
          ) : (
            <div className="grid max-h-48 grid-cols-2 gap-x-6 gap-y-2 overflow-y-auto">
              {directors.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={directorIds.includes(d.id)}
                    onChange={() => toggleDirector(d.id)}
                    className="accent-[#0090B9]"
                  />
                  {d.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-5">
        <p className="mb-2 text-sm font-medium text-gray-700">請求月</p>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={billingFrom}
            onChange={e => onBillingRangeChange(e.target.value, billingTo)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="month"
            value={billingTo}
            onChange={e => onBillingRangeChange(billingFrom, e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0090B9]"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <button onClick={onReset} className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          絞り込みをリセット
        </button>
        <Button onClick={modalClose}>閉じる</Button>
      </div>
    </>
  );
}
