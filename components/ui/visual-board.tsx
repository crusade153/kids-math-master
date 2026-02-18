// components/ui/visual-board.tsx
'use client';
import { MathProblem } from '@/types/math';

interface VisualBoardProps {
  problem: MathProblem | null;
  input: string;
}

export default function VisualBoard({ problem, input }: VisualBoardProps) {
  if (!problem) return null;

  // 숫자 분해
  const aTens = Math.floor(problem.operandA / 10) || '';
  const aOnes = problem.operandA % 10;
  const bTens = Math.floor(problem.operandB / 10) || '';
  const bOnes = problem.operandB % 10;

  // 입력값 정렬
  const inputStr = input.padStart(3, ' ');
  const inputHundreds = inputStr[inputStr.length - 3] || '';
  const inputTens = inputStr[inputStr.length - 2] || '';
  const inputOnes = inputStr[inputStr.length - 1] || '';

  // 연산 기호 결정
  let operator = '+';
  if (problem.type === 'SUB') operator = '-';
  if (problem.type === 'MUL') operator = 'x';

  return (
    <div className="bg-green-700 p-6 rounded-3xl shadow-inner border-8 border-yellow-800 w-full max-w-md mx-auto mb-6">
      <div className="grid grid-cols-3 gap-x-2 text-center font-mono text-6xl text-white font-bold tracking-widest leading-none">
        
        {/* 1. 힌트 영역 (받아올림/내림) */}
        <div></div>
        <div className="h-12 flex items-end justify-center">
          {problem.hasCarry && problem.type === 'ADD' && (
            <span className="text-red-300 text-4xl animate-bounce">1</span>
          )}
          {problem.hasCarry && problem.type === 'SUB' && (
            <span className="text-yellow-300 text-2xl animate-pulse">빌려옴</span>
          )}
        </div>
        <div></div>

        {/* 2. 첫 번째 숫자 */}
        <div></div>
        <div>{aTens}</div>
        <div>{aOnes}</div>

        {/* 3. 두 번째 숫자 & 기호 */}
        <div className="relative h-16">
            <span className="absolute left-0 bottom-2 text-4xl">{operator}</span>
        </div>
        <div className="border-b-4 border-white pb-2">{bTens}</div>
        <div className="border-b-4 border-white pb-2">{bOnes}</div>

        {/* 4. 정답 입력칸 */}
        <div className="text-yellow-300 pt-2 h-20">{inputHundreds}</div>
        <div className="text-yellow-300 pt-2 h-20">{inputTens}</div>
        <div className="text-yellow-300 pt-2 h-20">{inputOnes}</div>
      </div>
    </div>
  );
}