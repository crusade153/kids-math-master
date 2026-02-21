// actions/user-actions.ts
'use server';

import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/game';

export async function getUsers(): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      coins: row.coins || 0,
      inventory: row.inventory || [],
      lastLogin: row.last_login,
      score: row.score || 0,
      // ⭐️ 일일 미션 데이터 추가
      dailySolvedCount: row.daily_solved_count || 0,
      claimedRewards: row.claimed_rewards || [],
    }));
  } catch (error) {
    console.error('유저 로딩 실패:', error);
    return [];
  }
}

export async function syncUserProgress(userId: string, data: any) {
  try {
    const updateData: any = {};
    
    if (data.coins !== undefined) updateData.coins = data.coins;
    if (data.score !== undefined) updateData.score = data.score;
    if (data.inventory !== undefined) updateData.inventory = data.inventory;
    // ⭐️ 일일 미션 데이터 DB 동기화
    if (data.dailySolvedCount !== undefined) updateData.daily_solved_count = data.dailySolvedCount;
    if (data.claimedRewards !== undefined) updateData.claimed_rewards = data.claimedRewards;
    
    const today = new Date().toISOString().split('T')[0];
    updateData.last_login = today;

    const { error } = await supabase.from('users').update(updateData).eq('id', userId);
    if (error) console.error('Supabase 데이터 업데이트 실패:', error);
  } catch (error) {
    console.error('데이터 저장 실패:', error);
  }
}