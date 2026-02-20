// actions/boss-actions.ts
'use server';

import { loadSheet } from '@/lib/google-sheets';
import { getMonsters } from './game-actions';

// Vercel 서버리스 환경 및 로컬에서 상태를 유지하기 위한 글로벌 객체 사용
const globalForBoss = globalThis as unknown as { 
  bossHp: number; 
  bossMaxHp: number;
  bossDate: string;
  bossSeed: number;
  bossKillCount: number; // ⭐️ 보스를 잡은 횟수 추가 (새로운 보스 등장을 위함)
};

// ⭐️ 매일 날짜가 바뀌었는지 체크하고 보스를 리셋하는 로직 (에너지 500,000으로 상향)
async function checkAndResetDailyBoss() {
  // 한국 시간 기준 오늘 날짜 문자열 생성
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  
  if (globalForBoss.bossDate !== today || !globalForBoss.bossMaxHp) {
    globalForBoss.bossDate = today;
    globalForBoss.bossMaxHp = 500000; // ⭐️ 요구사항: 에너지 500,000으로 고정
    globalForBoss.bossHp = 500000;
    globalForBoss.bossKillCount = 0;  // ⭐️ 매일 킬 카운트 초기화
    
    // 단순 문자열 해싱으로 오늘의 랜덤 시드값 생성
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = today.charCodeAt(i) + ((hash << 5) - hash);
    }
    globalForBoss.bossSeed = Math.abs(hash);
  }
}

export async function getBossStatus() {
  await checkAndResetDailyBoss();
  
  const allMonsters = await getMonsters();
  // MYTHICAL(환상) 또는 LEGENDARY(전설) 포켓몬만 필터링
  const bossCandidates = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY');
  
  // 만약 시트에 환상/전설이 없다면 전체에서 선택하도록 예외 처리
  const pool = bossCandidates.length > 0 ? bossCandidates : allMonsters;
  
  // ⭐️ 오늘의 시드 + 킬 카운트를 조합하여, 죽일 때마다 새로운 보스가 나오도록 처리
  const actualSeed = globalForBoss.bossSeed + (globalForBoss.bossKillCount || 0);
  const bossIndex = actualSeed % pool.length;
  const currentBoss = pool[bossIndex] || pool[0];

  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
    bossMonster: currentBoss // 클라이언트로 몬스터 정보 전달
  };
}

export async function attackBoss(damage: number) {
  await checkAndResetDailyBoss();
  globalForBoss.bossHp = Math.max(0, globalForBoss.bossHp - damage);
  
  const allMonsters = await getMonsters();
  const bossCandidates = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY');
  const pool = bossCandidates.length > 0 ? bossCandidates : allMonsters;
  
  const actualSeed = globalForBoss.bossSeed + (globalForBoss.bossKillCount || 0);
  const bossIndex = actualSeed % pool.length;
  const currentBoss = pool[bossIndex] || pool[0];

  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
    bossMonster: currentBoss
  };
}

// 보스가 쓰러졌을 때 다시 부활시키는 함수
export async function resetBoss() {
  await checkAndResetDailyBoss();
  
  // ⭐️ 보스를 죽였으므로 킬 카운트 1 증가 -> 다음 보스는 다른 몬스터로 변경됨
  globalForBoss.bossKillCount = (globalForBoss.bossKillCount || 0) + 1;
  
  globalForBoss.bossMaxHp = Math.floor(globalForBoss.bossMaxHp * 1.2); // 부활할 때마다 20%씩 강해짐
  globalForBoss.bossHp = globalForBoss.bossMaxHp;
  
  const allMonsters = await getMonsters();
  const bossCandidates = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY');
  const pool = bossCandidates.length > 0 ? bossCandidates : allMonsters;
  
  // 증가된 킬 카운트가 적용되어 새로운 보스 인덱스 계산
  const actualSeed = globalForBoss.bossSeed + globalForBoss.bossKillCount;
  const bossIndex = actualSeed % pool.length;
  const currentBoss = pool[bossIndex] || pool[0];

  return {
    hp: globalForBoss.bossHp,
    maxHp: globalForBoss.bossMaxHp,
    bossMonster: currentBoss
  };
}

// 🎁 보스를 잡았을 때 전 서버 유저에게 200코인(기존 300->200) 일괄 지급
export async function distributeBossKillReward(killerId: string) {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['User_DB'];
    if (!sheet) return;
    
    const rows = await sheet.getRows();
    
    // 다중 저장을 위해 Promise.all 사용 (속도 최적화)
    const savePromises = rows.map(async (row) => {
      const id = row.get('사용자 ID');
      // 막타를 친 유저(killerId)는 브라우저 화면에서 직접 코인을 추가하므로 DB 저장에서 제외
      if (id !== killerId) {
        const currentCoins = parseInt(row.get('현재 코인') || '0', 10);
        // ⭐️ 보상 200코인으로 변경
        row.set('현재 코인', currentCoins + 200);
        return row.save();
      }
    }).filter(Boolean);

    await Promise.all(savePromises);
    console.log('--- 전 서버 유저 코인 지급 완료 ---');
  } catch (error) {
    console.error('레이드 보상 지급 실패:', error);
  }
}