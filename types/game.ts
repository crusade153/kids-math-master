// types/game.ts
export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export interface Monster {
  id: string;
  name: string;
  generation: string; // 세대 (1세대, 2세대...)
  rarity: Rarity;
  type: string;       // 이모지 (🔥, 💧 등)
  skills: string;     // 주요 스킬
  description: string;
  history: string;    // 히스토리/특이사항
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  coins: number;
  inventory: string[]; // 획득한 몬스터 ID 목록 ("r1,c1,c5" 형태의 문자열로 저장됨)
}