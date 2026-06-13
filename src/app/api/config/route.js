import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    fromNumber: process.env.SOLAPI_FROM_NUMBER || '미등록'
  });
}
