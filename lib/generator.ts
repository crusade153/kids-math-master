// lib/generator.ts
import { MathProblem, MathOperation } from "@/types/math";

// 랜덤 정수 생성 (min 이상 max 이하)
const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 1. 덧셈 문제 (받아올림 로직 포함)
export const generateAdditionProblem = (): MathProblem => {
  const a = getRandomInt(10, 99);
  const b = getRandomInt(1, 9);
  const unitSum = (a % 10) + b;
  
  return {
    id: crypto.randomUUID(),
    type: 'ADD',
    operandA: a,
    operandB: b,
    answer: a + b,
    isVertical: true,
    hasCarry: unitSum >= 10,
  };
};

// 2. 뺄셈 문제 (받아내림 로직 포함, 음수 방지)
export const generateSubtractionProblem = (): MathProblem => {
  const a = getRandomInt(20, 99);
  const b = getRandomInt(1, 19);
  
  // 받아내림(Borrow) 여부 확인 (일의 자리끼리 비교)
  const unitA = a % 10;
  const unitB = b % 10;
  const hasBorrow = unitA < unitB;

  return {
    id: crypto.randomUUID(),
    type: 'SUB',
    operandA: a,
    operandB: b,
    answer: a - b,
    isVertical: true,
    hasCarry: hasBorrow, // 뺄셈에서는 hasCarry를 '받아내림' 의미로 사용
  };
};

// 3. 구구단 문제 (2단 ~ 9단)
export const generateMultiplicationProblem = (): MathProblem => {
  const a = getRandomInt(2, 9);
  const b = getRandomInt(1, 9);

  return {
    id: crypto.randomUUID(),
    type: 'MUL',
    operandA: a,
    operandB: b,
    answer: a * b,
    isVertical: true,
    hasCarry: false, // 곱셈은 시각적 힌트 없음
  };
};

// 4. 통합 생성기 (모드에 따라 분기)
export const generateProblem = (mode: MathOperation): MathProblem => {
  switch (mode) {
    case 'SUB': return generateSubtractionProblem();
    case 'MUL': return generateMultiplicationProblem();
    case 'ADD':
    default: return generateAdditionProblem();
  }
};