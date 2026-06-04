import { NextResponse } from "next/server";
import { getApiKeyNames, type ApiKeyName, writeLocalApiKeys } from "@/lib/envFile";

export async function POST(request: Request) {
  if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER) {
    return NextResponse.json({ error: "部署環境不能寫入 .env.local，請使用平台環境變量。" }, { status: 400 });
  }

  const body = (await request.json()) as Partial<Record<ApiKeyName, string>>;
  const names = getApiKeyNames();
  const values = Object.fromEntries(
    names.map((name) => [name, typeof body[name] === "string" ? body[name]!.trim() : ""]),
  ) as Record<ApiKeyName, string>;

  writeLocalApiKeys(values);
  return NextResponse.json({ message: "已保存。重啟 dev server 後新環境變量會生效。" });
}
