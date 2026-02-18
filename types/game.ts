// types/game.ts
export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export interface Monster {
  id: string;
  name: string;
  generation: string;
  rarity: Rarity;
  type: string;
  skills: string;
  description: string;
  history: string;
  image: string; // ⭐️ 추가됨
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  coins: number;
  inventory: string[];
  lastLogin: string;
  score: number;
}