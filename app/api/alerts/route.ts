import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const operators = new Set([">", ">=", "<", "<=", "="]);
const severities = new Set(["low", "medium", "high"]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    indicatorId?: number;
    operator?: string;
    threshold?: number;
    message?: string;
    severity?: string;
  };

  if (!body.indicatorId || !body.operator || !operators.has(body.operator)) {
    return NextResponse.json({ error: "警報指標或運算符不正確" }, { status: 400 });
  }
  if (typeof body.threshold !== "number" || !Number.isFinite(body.threshold)) {
    return NextResponse.json({ error: "threshold 必須是數字" }, { status: 400 });
  }
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message 不能為空" }, { status: 400 });
  }
  if (!body.severity || !severities.has(body.severity)) {
    return NextResponse.json({ error: "severity 不正確" }, { status: 400 });
  }

  await prisma.alert.create({
    data: {
      indicatorId: body.indicatorId,
      operator: body.operator,
      threshold: body.threshold,
      message: body.message.trim(),
      severity: body.severity,
    },
  });

  return NextResponse.json({ ok: true });
}
