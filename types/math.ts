// types/math.ts
export type MathOperation = 'ADD' | 'SUB' | 'MUL';
export type Difficulty = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';

export interface MathProblem {
  id: string;
  type: MathOperation;
  operandA: number;
  operandB: number;
  answer: number;
  isVertical: boolean; // 세로셈 여부 (1단계는 false)
  hasCarry: boolean;
  difficulty: Difficulty;
  rewardPoints: number; // 난이도별 점수
  rewardCoins: number;  // 난이도별 코인
}