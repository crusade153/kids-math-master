// store/game-store.ts
import { create } from 'zustand';
import { UserProfile } from '@/types/game';
import { syncUserProgress } from '@/actions/user-actions';

interface GameState {
  currentUser: UserProfile | null; // 현재 사용자
  score: number;
  combo: number;
  maxCombo: number;
  feverMode: boolean;

  // 액션
  login: (user: UserProfile) => void;
  logout: () => void;
  addScore: (points: number) => void;
  resetGame: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  unlockMonster: (monsterId: string) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentUser: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  feverMode: false,

  login: (user) => set({ 
    currentUser: user, 
    score: user.score || 0 // 누적 점수 불러오기
  }),
  
  logout: () => set({ currentUser: null, score: 0 }),

  addScore: (points) => {
    set((state) => {
      const newScore = state.score + points;
      // 서버 동기화 (비동기)
      if (state.currentUser) {
        syncUserProgress(state.currentUser.id, { score: newScore });
      }
      return { score: newScore };
    });
  },

  incrementCombo: () => set((state) => {
    const newCombo = state.combo + 1;
    return {
      combo: newCombo,
      maxCombo: Math.max(state.maxCombo, newCombo),
      feverMode: newCombo >= 5,
    };
  }),

  resetCombo: () => set({ combo: 0, feverMode: false }),
  resetGame: () => set({ combo: 0, feverMode: false }),

  addCoins: (amount) => {
    const state = get();
    if (!state.currentUser) return;
    const newCoins = state.currentUser.coins + amount;
    
    // 로컬 업데이트
    set({ currentUser: { ...state.currentUser, coins: newCoins } });
    // 서버 동기화
    syncUserProgress(state.currentUser.id, { coins: newCoins });
  },

  spendCoins: (amount) => {
    const state = get();
    if (!state.currentUser || state.currentUser.coins < amount) return false;
    
    const newCoins = state.currentUser.coins - amount;
    set({ currentUser: { ...state.currentUser, coins: newCoins } });
    syncUserProgress(state.currentUser.id, { coins: newCoins });
    return true;
  },

  unlockMonster: (monsterId) => {
    const state = get();
    if (!state.currentUser) return;
    if (state.currentUser.inventory.includes(monsterId)) return;

    const newInventory = [...state.currentUser.inventory, monsterId];
    set({ currentUser: { ...state.currentUser, inventory: newInventory } });
    syncUserProgress(state.currentUser.id, { inventory: newInventory });
  },
}));