// lib/smart-engine.ts
import { MathProblem, MathOperation } from "@/types/math";
import { LearningData, MasteryRecord } from "@/types/learning";
import { generateProblem } from "./generator";

const STORAGE_KEY = 'kids-math-mastery-v1';

// 1. 문제의 고유 키를 생성하는 함수 (예: "MUL-7-8")
const getProblemKey = (p: MathProblem): string => {
  // 덧셈/뺄셈/곱셈 모두 작은 수가 뒤로 오거나 순서가 중요할 수 있음
  // 여기서는 단순히 "TYPE-OperandA-OperandB" 형식으로 저장
  return `${p.type}-${p.operandA}-${p.operandB}`;
};

// 2. 로컬 스토리지에서 학습 데이터 불러오기
const loadLearningData = (): LearningData => {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
};

// 3. 학습 결과 저장하기 (DB 역할)
export const saveResult = (problem: MathProblem, isCorrect: boolean) => {
  const data = loadLearningData();
  const key = getProblemKey(problem);

  // 데이터가 없으면 초기화
  if (!data[key]) {
    data[key] = {
      totalAttempts: 0,
      correctCount: 0,
      consecutiveCorrect: 0,
      lastSolvedAt: 0,
    };
  }

  const record = data[key];
  record.totalAttempts += 1;
  record.lastSolvedAt = Date.now();

  if (isCorrect) {
    record.correctCount += 1;
    record.consecutiveCorrect += 1;
  } else {
    // 틀리면 연속 정답 기록 초기화 (가중치를 높이기 위함)
    record.consecutiveCorrect = 0;
  }

  // 저장
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// 4. 스마트하게 문제 출제하기 (가중치 알고리즘)
export const getSmartProblem = (mode: MathOperation): MathProblem => {
  const data = loadLearningData();
  
  // 후보 문제 5개를 생성 (이 중에서 가장 필요한 걸 고름)
  const candidates = Array.from({ length: 5 }, () => generateProblem(mode));

  // 각 후보 문제에 "출제 가중치(Weight)" 부여
  const weightedCandidates = candidates.map((problem) => {
    const key = getProblemKey(problem);
    const record = data[key];
    let weight = 50; // 기본 가중치

    if (!record) {
      // 1. 처음 보는 문제: 적당한 우선순위
      weight = 50;
    } else {
      if (record.consecutiveCorrect >= 3) {
        // 2. 마스터한 문제 (3번 연속 정답): 낮은 확률 (복습용)
        weight = 10;
      } else if (record.consecutiveCorrect === 0) {
        // 3. 방금 틀렸거나 잘 모르는 문제: 매우 높은 확률 🔥
        weight = 150;
      } else {
        // 4. 풀고 있는 중: 높은 확률
        weight = 80;
      }

      // (선택) 오랫동안 안 풀었으면 가중치 증가 (에빙하우스 망각 곡선 흉내)
      const hoursSinceLastSolved = (Date.now() - record.lastSolvedAt) / (1000 * 60 * 60);
      if (hoursSinceLastSolved > 24) {
        weight += 20;
      }
    }

    return { problem, weight };
  });

  // 룰렛 휠 선택 (가중치 기반 랜덤 뽑기)
  const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (const item of weightedCandidates) {
    randomValue -= item.weight;
    if (randomValue <= 0) {
      return item.problem;
    }
  }

  // 안전장치: 혹시라도 선택 안 되면 첫 번째 반환
  return candidates[0];
};