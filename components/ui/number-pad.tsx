// components/ui/number-pad.tsx
'use client';

interface NumberPadProps {
  onInput: (num: string) => void;
  onDelete: () => void;
  onEnter: () => void;
}

export default function NumberPad({ onInput, onDelete, onEnter }: NumberPadProps) {
  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-md mt-4">
      <div className="grid grid-cols-3 gap-3 md:gap-4 p-2">
        {buttons.map((num) => (
          <button
            key={num}
            onClick={() => onInput(num)}
            className="bg-white text-gray-800 text-4xl font-black py-5 rounded-2xl shadow-[0_5px_0_rgba(209,213,219,1)] active:translate-y-1 active:shadow-none border border-gray-100 transition-all select-none"
          >
            {num}
          </button>
        ))}

        {/* 지우기 버튼 */}
        <button
          onClick={onDelete}
          className="bg-red-50 text-red-500 text-2xl font-black py-5 rounded-2xl shadow-[0_5px_0_rgba(252,165,165,1)] active:translate-y-1 active:shadow-none border border-red-100 transition-all select-none"
        >
          지우기
        </button>

        {/* 0번 버튼 */}
        <button
          onClick={() => onInput('0')}
          className="bg-white text-gray-800 text-4xl font-black py-5 rounded-2xl shadow-[0_5px_0_rgba(209,213,219,1)] active:translate-y-1 active:shadow-none border border-gray-100 transition-all select-none"
        >
          0
        </button>

        {/* 확인 버튼 */}
        <button
          onClick={onEnter}
          className="bg-green-500 text-white text-3xl font-black py-5 rounded-2xl shadow-[0_5px_0_rgba(21,128,61,1)] active:translate-y-1 active:shadow-none border border-green-600 transition-all select-none"
        >
          확인!
        </button>
      </div>
    </div>
  );
}