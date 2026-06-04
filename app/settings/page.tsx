import { SettingsForm } from "@/app/settings/SettingsForm";
import { readLocalApiKeys } from "@/lib/envFile";

export default function SettingsPage() {
  const isHosted = Boolean(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER);
  const values = readLocalApiKeys();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings 設定</h1>
        <p className="mt-2 text-sm text-slate-500">
          API Key 只寫入本地 `.env.local`。部署到 Vercel / Railway / Render 時，請改用平台環境變量。
        </p>
      </div>
      {isHosted ? (
        <div className="panel rounded-lg border-amber-400/30 bg-amber-400/8 p-4 text-sm text-amber-100/80">
          偵測到托管環境，頁面不會寫入 `.env.local`。請在部署平台後台設定環境變量。
        </div>
      ) : null}
      <SettingsForm initialValues={values} disabled={isHosted} />
    </div>
  );
}
