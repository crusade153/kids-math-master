// types/learning.ts

// 한 문제에 대한 학습 기록 (숙련도)
export interface MasteryRecord {
  totalAttempts: number;       // 총 시도 횟수
  correctCount: number;        // 맞춘 횟수
  consecutiveCorrect: number;  // 연속 정답 횟수 (스트릭)
  lastSolvedAt: number;        // 마지막으로 푼 시간 (Timestamp)
}

// 전체 학습 데이터 구조 (Key-Value)
// Key 예시: "MUL-7-8" (7x8 문제)
export interface LearningData {
  [problemKey: string]: MasteryRecord;
}