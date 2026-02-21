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
export type BombCardType = 'PLUS' | 'MINUS' | 'PASS' | 'REVERSE' | 'JOKER';

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

export interface RpsRoundResult {
  id: string;
  name: string;
  isBot: boolean;
  choice: 'ROCK' | 'PAPER' | 'SCISSORS';
  status: 'WIN' | 'LOSE' | 'DRAW';
}

export interface BombGameState {
  step: 'LOBBY' | 'RPS' | 'RPS_SHOW' | 'RPS_RESULT' | 'PLAYING' | 'RESULT';
  maxPlayers: number;
  players: BombPlayer[];
  turnIndex: number;
  direction: 1 | -1;
  gauge: number;
  boss: Monster | null;
  winnerName: string | null;
  
  // 가위바위보 랭킹 시스템
  rpsQueue: string[][]; // 승패를 가려야 할 그룹 큐
  rankedPlayers: string[]; // 최종 순위가 결정된 플레이어 ID
  rpsRoundResults: RpsRoundResult[]; // 현재 라운드 결과 보여주기 용도
  rpsMsg: string; 
  
  // 게임 내 연출
  lastActionMsg: string; // "가랏! 피카츄! (+5)"
}