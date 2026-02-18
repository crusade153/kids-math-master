// actions/user-actions.ts
'use server';

import { loadSheet } from '@/lib/google-sheets';
import { UserProfile } from '@/types/game';

// 1. 모든 사용자 목록 가져오기
export async function getUsers(): Promise<UserProfile[]> {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['User_DB'];
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows.map((row) => ({
      id: row.get('사용자 ID'),
      name: row.get('이름'),
      email: row.get('구글 이메일'),
      coins: parseInt(row.get('현재 코인') || '0', 10),
      inventory: row.get('획득한 몬스터 (ID 목록)') ? row.get('획득한 몬스터 (ID 목록)').split(',').map((s: string) => s.trim()) : [],
      lastLogin: row.get('마지막 접속일'),
      score: parseInt(row.get('누적 학습 점수') || '0', 10),
    }));
  } catch (error) {
    console.error('사용자 로딩 실패:', error);
    return [];
  }
}

// 2. 사용자 데이터 업데이트 (코인, 점수, 인벤토리)
export async function syncUserProgress(userId: string, data: Partial<UserProfile>) {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['User_DB'];
    const rows = await sheet.getRows();
    
    const userRow = rows.find((r) => r.get('사용자 ID') === userId);
    if (!userRow) return;

    if (data.coins !== undefined) userRow.set('현재 코인', data.coins);
    if (data.score !== undefined) userRow.set('누적 학습 점수', data.score);
    if (data.inventory !== undefined) userRow.set('획득한 몬스터 (ID 목록)', data.inventory.join(', '));
    
    // 마지막 접속일 갱신
    const today = new Date().toISOString().split('T')[0];
    userRow.set('마지막 접속일', today);

    await userRow.save();
  } catch (error) {
    console.error('데이터 저장 실패:', error);
  }
}