// components/ui/number-pad.tsx
'use client';

interface NumberPadProps {
  onInput: (num: string) => void;   // 숫자 클릭 시
  onDelete: () => void;             // 지우기 클릭 시
  onEnter: () => void;              // 확인 클릭 시
}

export default function NumberPad({ onInput, onDelete, onEnter }: NumberPadProps) {
  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-md mt-6">
      <div className="grid grid-cols-3 gap-4">
        {/* 1~9 버튼 */}
        {buttons.map((num) => (
          <button
            key={num}
            onClick={() => onInput(num)}
            className="bg-white text-orange-600 text-4xl font-bold py-6 rounded-2xl shadow-md active:bg-orange-100 active:scale-95 transition-transform"
          >
            {num}
          </button>
        ))}

        {/* 지우기 버튼 */}
        <button
          onClick={onDelete}
          className="bg-red-100 text-red-500 text-3xl font-bold py-6 rounded-2xl shadow-md active:scale-95 transition-transform"
        >
          지우기
        </button>

        {/* 0번 버튼 */}
        <button
          onClick={() => onInput('0')}
          className="bg-white text-orange-600 text-4xl font-bold py-6 rounded-2xl shadow-md active:bg-orange-100 active:scale-95 transition-transform"
        >
          0
        </button>

        {/* 확인 버튼 */}
        <button
          onClick={onEnter}
          className="bg-green-500 text-white text-3xl font-bold py-6 rounded-2xl shadow-md active:bg-green-600 active:scale-95 transition-transform"
        >
          확인
        </button>
      </div>
    </div>
  );
}