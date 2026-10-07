'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ModalCloseContext = createContext<() => void>(() => {});

export function useModalClose() {
  return useContext(ModalCloseContext);
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && handleClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <ModalCloseContext.Provider value={handleClose}>
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${isClosing ? 'animate-[fadeOut_0.18s_ease-in_forwards]' : 'animate-[fadeIn_0.15s_ease-out]'}`}>
        <div className={`w-full max-w-lg rounded-lg bg-white shadow-xl border border-[#0090B9] ${isClosing ? 'animate-[slideDown_0.18s_ease-in_forwards]' : 'animate-[slideUp_0.2s_ease-out]'}`}>
          <div className="flex items-center justify-between border-b border-[#0090B9] px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </ModalCloseContext.Provider>
  );
}
