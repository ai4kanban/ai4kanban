import "./globals.css";
import { FiChevronDown } from "react-icons/fi";

export default function Settings() {
  return (
    <div className="min-h-[800px] bg-gray-100 p-10">
      <div className="mx-auto max-w-xl rounded-lg bg-white p-8 shadow">
        <h1 className="text-lg font-semibold text-gray-900">Commit message</h1>
        {[["模型", "claude-sonnet-5-5"], ["语言", "跟随系统"]].map(([k, v]) => (
          <label key={k} className="mt-4 flex items-center gap-3 text-sm text-gray-700">
            <span className="w-24">{k}</span>
            <span className="flex h-9 flex-1 items-center justify-between rounded border border-gray-300 px-3">
              {v}
              <FiChevronDown />
            </span>
          </label>
        ))}
        <div className="mt-6 flex justify-end">
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white">保存</button>
        </div>
      </div>
    </div>
  );
}
