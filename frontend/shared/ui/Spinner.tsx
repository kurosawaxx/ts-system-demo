function SpinnerDots() {
  return (
    <div className="flex gap-2">
      <div className="w-4 h-4 rounded-full bg-[#4a92d7] animate-[bounce-dot_1.4s_infinite_ease-in-out_both] [animation-delay:-0.32s]" />
      <div className="w-4 h-4 rounded-full bg-[#4a92d7] animate-[bounce-dot_1.4s_infinite_ease-in-out_both] [animation-delay:-0.16s]" />
      <div className="w-4 h-4 rounded-full bg-[#4a92d7] animate-[bounce-dot_1.4s_infinite_ease-in-out_both]" />
    </div>
  );
}

export function Spinner({ inline = false }: { inline?: boolean }) {
  if (inline) return <SpinnerDots />;
  return (
    <div className="flex items-center justify-center w-full h-full min-h-screen">
      <SpinnerDots />
    </div>
  );
}
