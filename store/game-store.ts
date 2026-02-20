// store/game-store.ts
import { create } from 'zustand';
import { UserProfile } from '@/types/game';
import { syncUserProgress } from '@/actions/user-actions';

interface GameState {
  currentUser: UserProfile | null;
  score: number;
  combo: number;
  maxCombo: number;
  feverMode: boolean;

  // ⭐️ 일일 미션 관련 상태 추가
  dailySolvedCount: number;
  claimedRewards: number[];

  login: (user: UserProfile) => void;
  logout: () => void;
  addScore: (points: number) => void;
  resetGame: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  unlockMonster: (monsterId: string) => void;
  mergeMonsters: (invId: string) => void;

  // ⭐️ 일일 미션 액션 추가
  incrementSolvedCount: () => void;
  claimMissionReward: (step: number, coinReward: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentUser: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  feverMode: false,

  // 일일 미션 초기값
  dailySolvedCount: 0,
  claimedRewards: [],

  login: (user) => set({ currentUser: user, score: user.score || 0 }),
  logout: () => set({ currentUser: null, score: 0 }),

  addScore: (points) => {
    set((state) => {
      const newScore = state.score + points;
      if (state.currentUser) syncUserProgress(state.currentUser.id, { score: newScore });
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
    set({ currentUser: { ...state.currentUser, coins: newCoins } });
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
    
    const newInventory = [...state.currentUser.inventory, monsterId];
    set({ currentUser: { ...state.currentUser, inventory: newInventory } });
    syncUserProgress(state.currentUser.id, { inventory: newInventory });
  },

  mergeMonsters: (invId) => {
    const state = get();
    if (!state.currentUser) return;
    
    const inv = [...state.currentUser.inventory];
    let count = 0;
    
    const newInv = inv.filter(id => {
      if (id === invId && count < 3) {
        count++;
        return false; 
      }
      return true;
    });

    if (count === 3) {
      const [baseId, lvlStr] = invId.split('_');
      const level = parseInt(lvlStr || '0', 10);
      newInv.push(`${baseId}_${level + 1}`);
      
      set({ currentUser: { ...state.currentUser, inventory: newInv } });
      syncUserProgress(state.currentUser.id, { inventory: newInv });
    }
  },

  // ⭐️ 정답을 맞출 때마다 문제 풀이 횟수 1 증가
  incrementSolvedCount: () => set((state) => ({ 
    dailySolvedCount: state.dailySolvedCount + 1 
  })),

  // ⭐️ 미션 보상 수령 로직
  claimMissionReward: (step, coinReward) => {
    const state = get();
    // 목표를 달성했고, 아직 수령하지 않은 보상이라면 지급
    if (state.dailySolvedCount >= step && !state.claimedRewards.includes(step)) {
      state.addCoins(coinReward);
      set({ claimedRewards: [...state.claimedRewards, step] });
    }
  }
}));