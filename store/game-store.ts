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

  login: (user: UserProfile) => void;
  logout: () => void;
  addScore: (points: number) => void;
  resetGame: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  unlockMonster: (monsterId: string) => void;
  mergeMonsters: (invId: string) => void; // ⭐️ 합성 로직 추가
}

export const useGameStore = create<GameState>((set, get) => ({
  currentUser: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  feverMode: false,

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
    
    // 🚨 이전의 중복 획득 방지 로직을 제거했습니다! 이제 합성을 위해 무한히 모을 수 있습니다.
    const newInventory = [...state.currentUser.inventory, monsterId];
    set({ currentUser: { ...state.currentUser, inventory: newInventory } });
    syncUserProgress(state.currentUser.id, { inventory: newInventory });
  },

  mergeMonsters: (invId) => {
    const state = get();
    if (!state.currentUser) return;
    
    const inv = [...state.currentUser.inventory];
    let count = 0;
    
    // 합성할 대상 카드 3장을 인벤토리에서 제거합니다.
    const newInv = inv.filter(id => {
      if (id === invId && count < 3) {
        count++;
        return false; 
      }
      return true;
    });

    // 3장이 정상적으로 제거되었다면 레벨이 1 오른 새 카드를 추가합니다.
    if (count === 3) {
      const [baseId, lvlStr] = invId.split('_');
      const level = parseInt(lvlStr || '0', 10);
      newInv.push(`${baseId}_${level + 1}`);
      
      set({ currentUser: { ...state.currentUser, inventory: newInv } });
      syncUserProgress(state.currentUser.id, { inventory: newInv });
    }
  }
}));