// components/ui/visual-board.tsx
'use client';
import { MathProblem } from '@/types/math';

interface VisualBoardProps {
  problem: MathProblem | null;
  input: string;
}

export default function VisualBoard({ problem, input }: VisualBoardProps) {
  if (!problem) return null;

  let operator = '+';
  if (problem.type === 'SUB') operator = '-';
  if (problem.type === 'MUL') operator = 'x';

  // 🍎 6살용 사과 튜터 렌더링 함수
  const renderVisualApples = (count: number) => {
    return (
      <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-[150px]">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="text-3xl drop-shadow-md animate-bounce">🍎</span>
        ))}
      </div>
    );
  };

  // ✖️ 8살용 구구단 튜터 렌더링 함수
  const renderMultiplicationHint = (a: number, b: number) => {
    return (
      <div className="text-sm text-yellow-200 mt-6 font-bold bg-black/30 p-4 rounded-xl text-center shadow-inner w-full">
        💡 튜터 힌트: {a}를 {b}번 더해보자! <br/>
        <div className="mt-2 text-xl tracking-widest break-all">
          {Array.from({ length: b }).fill(a).join(' + ')}
        </div>
      </div>
    );
  };

  // ⭐️ 1단계: 가로셈 (3 + 4 = ?) + 학습 튜터 포함
  if (!problem.isVertical) {
    return (
      <div className="relative bg-green-600 p-8 rounded-3xl shadow-inner border-8 border-yellow-800 w-full max-w-md mx-auto mb-6 flex flex-col items-center justify-center gap-4">
        
        {/* 귀여운 튜터 캐릭터 말풍선 */}
        <div className="absolute -top-12 left-4 bg-white px-5 py-2 rounded-2xl rounded-bl-none shadow-xl font-black text-green-700 animate-pulse border-2 border-green-200 z-10">
          👩‍🏫 천천히 사과를 세어볼까?
        </div>

        <div className="flex items-center justify-center gap-4 w-full">
          <div className="flex flex-col items-center">
            <span className="text-6xl font-black text-white font-mono">{problem.operandA}</span>
            {problem.difficulty === 'LEVEL_1' && problem.type !== 'MUL' && renderVisualApples(problem.operandA)}
          </div>
          
          <span className="text-6xl font-black text-yellow-300 self-start mt-2">{operator}</span>
          
          <div className="flex flex-col items-center">
            <span className="text-6xl font-black text-white font-mono">{problem.operandB}</span>
            {problem.difficulty === 'LEVEL_1' && problem.type !== 'MUL' && renderVisualApples(problem.operandB)}
          </div>

          <span className="text-6xl font-black text-white self-start mt-2">=</span>
          
          <div className="bg-black/20 min-w-[80px] h-20 rounded-xl flex items-center justify-center px-4 self-start">
            <span className="text-6xl font-black text-yellow-300 font-mono animate-pulse">
              {input || '?'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ⭐️ 2, 3단계: 세로셈 (기존 유지) + 구구단 튜터 포함
  const aTens = Math.floor(problem.operandA / 10) || '';
  const aOnes = problem.operandA % 10;
  const bTens = Math.floor(problem.operandB / 10) || '';
  const bOnes = problem.operandB % 10;

  const inputStr = input.padStart(3, ' ');
  const inputHundreds = inputStr[inputStr.length - 3] || '';
  const inputTens = inputStr[inputStr.length - 2] || '';
  const inputOnes = inputStr[inputStr.length - 1] || '';

  return (
    <div className="relative bg-green-700 p-6 rounded-3xl shadow-inner border-8 border-yellow-800 w-full max-w-md mx-auto mb-6 flex flex-col items-center">
      
      {/* 귀여운 튜터 캐릭터 말풍선 */}
      <div className="absolute -top-12 left-4 bg-white px-5 py-2 rounded-2xl rounded-bl-none shadow-xl font-black text-green-700 animate-pulse border-2 border-green-200 z-10">
        👩‍🏫 {problem.type === 'MUL' ? '구구단은 덧셈의 반복이야!' : '침착하게 세로로 풀어보자!'}
      </div>

      <div className="grid grid-cols-3 gap-x-2 text-center font-mono text-6xl text-white font-bold tracking-widest leading-none w-3/4 mx-auto">
        <div></div>
        <div className="h-12 flex items-end justify-center">
          {problem.hasCarry && problem.type === 'ADD' && (
            <span className="text-red-300 text-4xl animate-bounce">1</span>
          )}
          {problem.hasCarry && problem.type === 'SUB' && (
            <span className="text-yellow-300 text-2xl animate-pulse">.</span>
          )}
        </div>
        <div></div>

        <div></div>
        <div>{aTens}</div>
        <div>{aOnes}</div>

        <div className="relative h-16">
            <span className="absolute left-0 bottom-2 text-4xl">{operator}</span>
        </div>
        <div className="border-b-4 border-white pb-2">{bTens}</div>
        <div className="border-b-4 border-white pb-2">{bOnes}</div>

        <div className="text-yellow-300 pt-2 h-20">{inputHundreds}</div>
        <div className="text-yellow-300 pt-2 h-20">{inputTens}</div>
        <div className="text-yellow-300 pt-2 h-20">{inputOnes}</div>
      </div>

      {/* 곱셈일 때 하단에 힌트 노출 */}
      {problem.type === 'MUL' && renderMultiplicationHint(problem.operandA, problem.operandB)}
    </div>
  );
}