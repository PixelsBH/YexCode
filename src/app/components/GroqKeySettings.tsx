"use client";

import { useEffect, useState } from "react";

type SettingsResponse = { configured?: boolean; error?: string };

export default function GroqKeySettings() {
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile/groq-key", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as SettingsResponse;
        if (!response.ok) throw new Error(body.error || "Could not load Groq key settings.");
        if (!controller.signal.aborted) setConfigured(body.configured === true);
      })
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Could not load Groq key settings."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function saveKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/groq-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
        cache: "no-store",
      });
      const body = await response.json() as SettingsResponse;
      if (!response.ok) throw new Error(body.error || "Could not save Groq API key.");
      setConfigured(true);
      setApiKey("");
      setMessage("Groq key saved encrypted. It will not be shown again.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save Groq API key.");
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    if (!window.confirm("Remove your saved Groq API key?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/groq-key", { method: "DELETE", cache: "no-store" });
      const body = await response.json() as SettingsResponse;
      if (!response.ok) throw new Error(body.error || "Could not remove Groq API key.");
      setConfigured(false);
      setMessage("Groq key removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove Groq API key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="groq-api-key" className="surface-panel-raised mt-6 overflow-hidden rounded-2xl">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <p className="page-eyebrow mb-1">Optional · Bring your own key</p>
        <h2 className="text-lg font-semibold text-white">Groq AI assistant</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">Connect a Groq API key to ask questions about code in the workspace. Groq usage is subject to the limits and terms for your account.</p>
      </div>
      <div className="p-5 sm:p-6">
        {loading ? <p className="text-sm text-white/45">Loading key settings…</p> : <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${configured ? "bg-emerald-300" : "bg-white/25"}`} />
            <span className="text-sm text-white/70">{configured ? "Groq key connected" : "No Groq key connected"}</span>
          </div>
          <form onSubmit={saveKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-white/55">{configured ? "Replace API key" : "Groq API key"}
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" maxLength={512} required className="control-field mt-1.5 w-full px-3 py-2.5 text-sm text-white placeholder:text-white/35" placeholder="Paste your Groq API key" />
            </label>
            <button type="submit" disabled={saving || !apiKey.trim()} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45">{saving ? "Saving…" : configured ? "Replace key" : "Save key"}</button>
            {configured && <button type="button" onClick={() => void removeKey()} disabled={saving} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/65 transition hover:border-rose-300/20 hover:bg-rose-300/[0.05] hover:text-rose-100 disabled:opacity-40">Remove</button>}
          </form>
          <p className="mt-3 text-xs leading-5 text-white/40">Your key is encrypted before it is stored in MongoDB and is only decrypted on the server to make Groq requests. Code and prompts are sent to Groq only when you use the assistant.</p>
        </>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-emerald-200">{message}</p>}
      </div>
    </section>
  );
}
