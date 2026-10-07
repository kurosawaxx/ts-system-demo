'use client';

import { useImportExcel } from '@/features/project/model/useProjects';
import { Button } from '@/shared/ui/Button';
import { ImportIcon } from '@/shared/ui/Icon';
import { Modal, useModalClose } from '@/shared/ui/Modal';
import type { ImportResult } from '@/shared/types';
import { useRef, useState } from 'react';

function CloseButton({ label = '閉じる' }: { label?: string }) {
  const modalClose = useModalClose();
  return <Button variant="secondary" onClick={modalClose}>{label}</Button>;
}

export function ExcelImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useImportExcel();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!inputRef.current) return;
    inputRef.current.value = '';
    if (!file) return;

    setErrorMsg(null);
    try {
      const res = await mutateAsync(file);
      setResult(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'インポートに失敗しました。';
      setErrorMsg(msg);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="primary"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            インポート中…
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <ImportIcon size={14} />
            Excelインポート
          </span>
        )}
      </Button>

      {errorMsg && (
        <Modal title="インポートエラー" onClose={() => setErrorMsg(null)}>
          <p className="text-sm text-red-600">{errorMsg}</p>
          <div className="mt-4 flex justify-end">
            <CloseButton />
          </div>
        </Modal>
      )}

      {result && (
        <Modal title="インポート完了" onClose={() => setResult(null)}>
          <p className="text-sm text-gray-700">{result.message}</p>
          <div className="mt-3 flex gap-6 text-sm">
            <span className="text-green-600">新規: {result.created}件</span>
            <span className="text-[#0090B9]">更新: {result.updated}件</span>
            <span className="text-gray-500">スキップ: {result.skipped}件</span>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">エラー ({result.errors.length}件):</p>
              <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <CloseButton />
          </div>
        </Modal>
      )}
    </>
  );
}
