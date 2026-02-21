// actions/boss-actions.ts
'use server';

import { supabase } from '@/lib/supabase';
import { getMonsters } from './game-actions';

async function checkAndGetBossState() {
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  
  // DB에서 보스 상태 불러오기
  const { data: bossState, error } = await supabase.from('boss_state').select('*').eq('id', 1).single();
  if (error || !bossState) throw new Error("보스 데이터를 불러올 수 없습니다.");

  // 날짜가 바뀌었다면 (다음 날이 되었다면) 보스 초기화 (30만)
  if (bossState.boss_date !== today) {
    const { data: newState } = await supabase
      .from('boss_state')
      .update({ hp: 300000, max_hp: 300000, kill_count: 0, boss_date: today })
      .eq('id', 1)
      .select()
      .single();
    return newState;
  }
  
  return bossState;
}

export async function getBossStatus() {
  const state = await checkAndGetBossState();
  
  const allMonsters = await getMonsters();
  const bossCandidates = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY');
  const pool = bossCandidates.length > 0 ? bossCandidates : allMonsters;
  
  // 죽인 횟수에 따라 다른 보스 몬스터 등장
  const bossIndex = (new Date().getDate() + state.kill_count) % pool.length;
  const currentBoss = pool[bossIndex];

  return { hp: state.hp, maxHp: state.max_hp, bossMonster: currentBoss };
}

export async function attackBoss(damage: number) {
  const state = await checkAndGetBossState();
  const newHp = Math.max(0, state.hp - damage);
  
  // DB에 깎인 체력 저장
  await supabase.from('boss_state').update({ hp: newHp }).eq('id', 1);
  
  const allMonsters = await getMonsters();
  const bossCandidates = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY');
  const pool = bossCandidates.length > 0 ? bossCandidates : allMonsters;
  const bossIndex = (new Date().getDate() + state.kill_count) % pool.length;

  return { hp: newHp, maxHp: state.max_hp, bossMonster: pool[bossIndex] };
}

export async function resetBoss() {
  const state = await checkAndGetBossState();
  
  const newKillCount = state.kill_count + 1;
  const newMaxHp = state.max_hp + 50000; // ⭐️ 죽일 때마다 에너지가 5만씩 증가!
  
  // DB에 부활한 보스 상태 업데이트
  await supabase
    .from('boss_state')
    .update({ hp: newMaxHp, max_hp: newMaxHp, kill_count: newKillCount })
    .eq('id', 1);
    
  return getBossStatus();
}

// 레이드 보상 로직 (기존과 동일)
export async function distributeBossKillReward(killerId: string) {
  try {
    const { data: users } = await supabase.from('users').select('id, coins').neq('id', killerId);
    if (!users) return;

    const savePromises = users.map((user) => 
      supabase.from('users').update({ coins: (user.coins || 0) + 200 }).eq('id', user.id)
    );
    await Promise.all(savePromises);
  } catch (error) {
    console.error('보상 지급 실패:', error);
  }
}