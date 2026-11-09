import { SignUp } from "@clerk/nextjs";

const appearance = {
  variables: {
    colorPrimary: "#8b6cff",
    colorBackground: "#111116",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorInputBackground: "#09090b",
    colorInputText: "#fafafa",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "border border-white/10 shadow-2xl shadow-black/30",
    headerTitle: "tracking-tight",
    formButtonPrimary: "font-semibold shadow-lg shadow-violet-950/40",
    footerActionLink: "text-violet-300 hover:text-violet-200",
  },
};

export default function Page() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-5xl flex-col items-center justify-center gap-6 px-2 py-8">
      <div className="text-center"><p className="page-eyebrow mb-2">Start practicing</p><h1 className="page-title text-2xl sm:text-3xl">Create your YexCode account</h1><p className="mt-2 text-sm text-white/50">Build a habit, track progress, and keep your solutions together.</p></div>
      <SignUp appearance={appearance} />
    </div>
  );
}