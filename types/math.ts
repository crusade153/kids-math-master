// types/math.ts
export type MathOperation = 'ADD' | 'SUB' | 'MUL' | 'DIV';

export interface MathProblem {
  id: string;          // 문제 고유 번호
  type: MathOperation; // 문제 유형
  operandA: number;    // 첫 번째 숫자 (예: 93)
  operandB: number;    // 두 번째 숫자 (예: 8)
  answer: number;      // 정답 (예: 101)
  isVertical: boolean; // 세로셈 모드 여부
  hasCarry: boolean;   // 받아올림 존재 여부
}