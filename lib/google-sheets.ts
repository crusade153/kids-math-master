// lib/google-sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// 싱글톤 패턴으로 인증 객체 관리
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // 개행 문자 처리
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEET_ID as string,
  serviceAccountAuth
);

export async function loadSheet() {
  await doc.loadInfo();
  return doc;
}