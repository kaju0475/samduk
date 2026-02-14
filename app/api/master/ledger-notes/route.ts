
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DailyLedgerNote } from '@/lib/types';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 });
    }

    try {
        const note = db.dailyLedgerNotes.find(n => n.date === date);
        return NextResponse.json({ success: true, data: note || null });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body: DailyLedgerNote = await request.json();
        const { date, deposit, expenditure } = body;

        if (!date) {
            return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 });
        }

        const existingIndex = db.dailyLedgerNotes.findIndex(n => n.date === date);

        if (existingIndex > -1) {
            // Update
            db.dailyLedgerNotes[existingIndex] = { date, deposit, expenditure };
        } else {
            // Create
            db.dailyLedgerNotes.push({ date, deposit, expenditure });
        }

        await db.save();

        return NextResponse.json({ success: true, data: { date, deposit, expenditure } });
    } catch {
        return NextResponse.json({ success: false, error: 'Failed to save notes' }, { status: 500 });
    }
}
