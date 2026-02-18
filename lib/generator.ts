// lib/generator.ts
import { MathProblem, MathOperation, Difficulty } from "@/types/math";

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateProblem = (mode: MathOperation, difficulty: Difficulty): MathProblem => {
  let a = 0, b = 0;
  let answer = 0;
  let isVertical = true; // 기본은 세로셈
  let hasCarry = false;
  let points = 10;
  let coins = 1;

  // 1. 곱셈 (구구단) 로직 ✖️
  if (mode === 'MUL') {
    isVertical = true; // 구구단은 세로셈 양식
    b = getRandomInt(1, 9); // 뒤에 곱해지는 수는 1~9

    if (difficulty === 'LEVEL_1') {
      // 1단계: 2단 ~ 5단 (비교적 쉬움)
      a = getRandomInt(2, 5);
      points = 15; 
      coins = 2;
    } else if (difficulty === 'LEVEL_2') {
      // 2단계: 6단 ~ 9단 (조금 어려움)
      a = getRandomInt(6, 9);
      points = 25;
      coins = 3;
    } else {
      // 3단계: 2단 ~ 9단 전체 랜덤 (마스터)
      a = getRandomInt(2, 9);
      points = 35;
      coins = 4;
    }
    answer = a * b;
  } 
  
  // 2. 덧셈/뺄셈 로직 ➕➖
  else {
    // 난이도별 숫자 범위 설정
    if (difficulty === 'LEVEL_1') {
      // 1단계: 한 자리 수 (가로셈)
      a = getRandomInt(1, 9);
      b = getRandomInt(1, 9);
      isVertical = false; // ⭐️ 가로셈
      points = 10;
      coins = 1;
    } else if (difficulty === 'LEVEL_2') {
      // 2단계: 두 자리 + 한 자리
      a = getRandomInt(10, 90);
      b = getRandomInt(1, 9);
      points = 20;
      coins = 2;
    } else {
      // 3단계: 두 자리 + 두 자리
      a = getRandomInt(10, 99);
      b = getRandomInt(10, 99);
      points = 30;
      coins = 3;
    }

    if (mode === 'ADD') {
      answer = a + b;
      hasCarry = (a % 10) + (b % 10) >= 10;
    } else { // SUB
      if (a < b) [a, b] = [b, a]; // 큰 수에서 작은 수 빼기
      answer = a - b;
      hasCarry = (a % 10) < (b % 10); // 받아내림
    }
  }

  return {
    id: crypto.randomUUID(),
    type: mode,
    operandA: a,
    operandB: b,
    answer,
    isVertical,
    hasCarry,
    difficulty,
    rewardPoints: points,
    rewardCoins: coins,
  };
};