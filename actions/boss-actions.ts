// actions/boss-actions.ts
'use server';

import { loadSheet } from '@/lib/google-sheets';

// Vercel 서버리스 환경 및 로컬에서 상태를 유지하기 위한 글로벌 객체 사용
const globalForBoss = globalThis as unknown as { bossHp: number, bossMaxHp: number };

// 보스 초기 체력 세팅 (100만)
if (!globalForBoss.bossMaxHp) {
  globalForBoss.bossMaxHp = 1000000;
  globalForBoss.bossHp = 1000000;
}

export async function getBossStatus() {
  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
  };
}

export async function attackBoss(damage: number) {
  globalForBoss.bossHp = Math.max(0, globalForBoss.bossHp - damage);
  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
  };
}

// 보스가 쓰러졌을 때 다시 부활시키는 함수
export async function resetBoss() {
  globalForBoss.bossMaxHp = Math.floor(globalForBoss.bossMaxHp * 1.2); // 부활할 때마다 20%씩 강해짐
  globalForBoss.bossHp = globalForBoss.bossMaxHp;
  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
  };
}

// 🎁 보스를 잡았을 때 전 서버 유저에게 300코인 일괄 지급
export async function distributeBossKillReward(killerId: string) {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['User_DB'];
    if (!sheet) return;
    
    const rows = await sheet.getRows();
    
    // 다중 저장을 위해 Promise.all 사용 (속도 최적화)
    const savePromises = rows.map(async (row) => {
      const id = row.get('사용자 ID');
      // 막타를 친 유저(killerId)는 브라우저 화면에서 직접 +310 코인을 추가하므로 DB 저장에서 제외
      if (id !== killerId) {
        const currentCoins = parseInt(row.get('현재 코인') || '0', 10);
        row.set('현재 코인', currentCoins + 300);
        return row.save();
      }
    }).filter(Boolean);

    await Promise.all(savePromises);
    console.log('--- 전 서버 유저 300코인 지급 완료 ---');
  } catch (error) {
    console.error('레이드 보상 지급 실패:', error);
  }
}