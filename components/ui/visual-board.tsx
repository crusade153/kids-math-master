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

  // 🍎 6살용 사과 튜터
  const renderVisualApples = (count: number) => {
    return (
      <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-[150px]">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="text-3xl drop-shadow-md animate-bounce">🍎</span>
        ))}
      </div>
    );
  };

  // ✖️ 8살용 구구단 튜터
  const renderMultiplicationHint = (a: number, b: number) => {
    return (
      <div className="text-sm text-yellow-100 mt-6 font-bold bg-black/20 p-4 rounded-2xl text-center w-full">
        💡 튜터 힌트: {a}를 {b}번 더해보자! <br/>
        <div className="mt-2 text-xl tracking-widest break-all">
          {Array.from({ length: b }).fill(a).join(' + ')}
        </div>
      </div>
    );
  };

  // 공통 튜터 말풍선 컴포넌트
  const TutorBubble = ({ text }: { text: string }) => (
    <div className="flex items-end gap-2 mb-4 ml-4">
      <div className="text-4xl filter drop-shadow-md animate-bounce-slow">🦉</div>
      <div className="bg-white px-5 py-3 rounded-3xl rounded-bl-none shadow-md font-black text-gray-700 border-2 border-gray-100 text-sm md:text-base relative">
        {text}
        <div className="absolute w-3 h-3 bg-white border-b-2 border-l-2 border-gray-100 -bottom-[1.5px] -left-1.5 transform rotate-45"></div>
      </div>
    </div>
  );

  // ⭐️ 1단계: 가로셈 (3 + 4 = ?)
  if (!problem.isVertical) {
    return (
      <div className="w-full max-w-md mx-auto relative mt-6">
        <TutorBubble text="천천히 사과 개수를 세어볼까?" />
        <div className="bg-[#1E5631] p-8 rounded-[2rem] shadow-inner border-[10px] border-[#654321] flex flex-col items-center justify-center gap-4">
          <div className="flex items-center justify-center gap-4 w-full">
            <div className="flex flex-col items-center">
              <span className="text-6xl font-black text-white font-mono drop-shadow-md">{problem.operandA}</span>
              {problem.difficulty === 'LEVEL_1' && problem.type !== 'MUL' && renderVisualApples(problem.operandA)}
            </div>
            
            <span className="text-6xl font-black text-yellow-400 self-start mt-2 drop-shadow-md">{operator}</span>
            
            <div className="flex flex-col items-center">
              <span className="text-6xl font-black text-white font-mono drop-shadow-md">{problem.operandB}</span>
              {problem.difficulty === 'LEVEL_1' && problem.type !== 'MUL' && renderVisualApples(problem.operandB)}
            </div>

            <span className="text-6xl font-black text-white self-start mt-2 drop-shadow-md">=</span>
            
            <div className="bg-black/30 min-w-[80px] h-20 rounded-2xl flex items-center justify-center px-4 self-start shadow-inner border-b-4 border-black/20">
              <span className="text-6xl font-black text-yellow-300 font-mono animate-pulse">
                {input || '?'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ⭐️ 2, 3단계: 세로셈
  const aTens = Math.floor(problem.operandA / 10) || '';
  const aOnes = problem.operandA % 10;
  const bTens = Math.floor(problem.operandB / 10) || '';
  const bOnes = problem.operandB % 10;

  const inputStr = input.padStart(3, ' ');
  const inputHundreds = inputStr[inputStr.length - 3] || '';
  const inputTens = inputStr[inputStr.length - 2] || '';
  const inputOnes = inputStr[inputStr.length - 1] || '';

  return (
    <div className="w-full max-w-md mx-auto relative mt-6">
      <TutorBubble text={problem.type === 'MUL' ? '구구단은 덧셈의 반복이야!' : '침착하게 세로로 풀어보자!'} />
      <div className="bg-[#1E5631] p-6 rounded-[2rem] shadow-inner border-[10px] border-[#654321] flex flex-col items-center">
        
        <div className="grid grid-cols-3 gap-x-2 text-center font-mono text-[5rem] text-white font-bold tracking-widest leading-none w-4/5 mx-auto drop-shadow-md">
          <div></div>
          <div className="h-16 flex items-end justify-center pb-2">
            {problem.hasCarry && problem.type === 'ADD' && (
              <span className="text-pink-300 text-4xl animate-bounce">1</span>
            )}
            {problem.hasCarry && problem.type === 'SUB' && (
              <span className="text-yellow-300 text-3xl animate-pulse">.</span>
            )}
          </div>
          <div></div>

          <div></div>
          <div>{aTens}</div>
          <div>{aOnes}</div>

          <div className="relative h-20">
              <span className="absolute left-0 bottom-4 text-5xl text-yellow-400">{operator}</span>
          </div>
          <div className="border-b-[6px] border-white pb-3">{bTens}</div>
          <div className="border-b-[6px] border-white pb-3">{bOnes}</div>

          <div className="text-yellow-300 pt-4 h-24">{inputHundreds}</div>
          <div className="text-yellow-300 pt-4 h-24">{inputTens}</div>
          <div className="text-yellow-300 pt-4 h-24">{inputOnes}</div>
        </div>

        {problem.type === 'MUL' && renderMultiplicationHint(problem.operandA, problem.operandB)}
      </div>
    </div>
  );
}