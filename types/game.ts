// types/game.ts
export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY' | 'MYTHICAL';

export interface Monster {
  id: string;
  name: string;
  generation: string;
  rarity: Rarity;
  type: string;
  skills: string;
  description: string;
  history: string;
  image: string;
  hp: number;
  attack: number;
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

// 💣 폭탄 게임 전용 타입
export type BombCardType = 'PLUS' | 'MINUS' | 'PASS' | 'REVERSE' | 'RESET' | 'BLIND';

export interface BombCard {
  id: string;
  monsterId: string;
  name: string;
  image: string;
  cardType: BombCardType;
  value: number; 
  element: string; 
}

export interface BombPlayer {
  id: string;
  name: string;
  isBot: boolean;
  hand: BombCard[];
  isEliminated: boolean;
  rpsChoice?: 'ROCK' | 'PAPER' | 'SCISSORS';
}

export interface BombGameState {
  step: 'LOBBY' | 'RPS' | 'RPS_RESULT' | 'PLAYING' | 'RESULT';
  maxPlayers: number;
  players: BombPlayer[];
  turnIndex: number;
  direction: 1 | -1;
  gauge: number;
  isBlind: boolean;
  boss: Monster | null;
  winnerName: string | null;
  
  // 가위바위보 및 연출 상태
  rpsQueue: string[][]; // 승패를 가려야 할 그룹 큐
  rankedPlayers: string[]; // 최종 순위가 결정된 플레이어 ID
  rpsMsg: string; // 가위바위보 안내 메시지
  lastActionMsg: string; // "가랏! 피카츄!" 등 액션 메시지
}