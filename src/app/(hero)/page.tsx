import Image from "next/image";
import Link from "next/link";
import Aurora from "@/app/components/Aurora";
import ScrollReveal from "@/app/components/ScrollReveal";

type ProductImageProps = {
  src: string;
  alt: string;
  portrait?: boolean;
  widescreen?: boolean;
  priority?: boolean;
};

function ProductImage({ src, alt, portrait = false, widescreen = false, priority = false }: ProductImageProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-[#101015] shadow-[0_30px_100px_rgba(0,0,0,0.48)] ${portrait ? "mx-auto w-full max-w-[390px]" : "w-full"}`}>

      <div className={`relative w-full ${portrait ? "aspect-[9/16] bg-[#0c0c10]" : widescreen ? "aspect-[2.24/1]" : "aspect-[5/3]"}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={portrait ? "(max-width: 768px) 88vw, 390px" : "(max-width: 768px) 94vw, 58vw"}
          className="object-contain"
        />
      </div>
    </div>
  );
}

type FeatureSectionProps = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  href: string;
  linkLabel: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  portrait?: boolean;
  widescreen?: boolean;
};

function FeatureSection({
  id,
  number,
  eyebrow,
  title,
  description,
  details,
  href,
  linkLabel,
  image,
  imageAlt,
  reverse = false,
  portrait = false,
  widescreen = false,
}: FeatureSectionProps) {
  return (
    <section id={id} className="relative scroll-mt-24 py-16 sm:py-24 lg:py-28">
      <ScrollReveal className="mx-auto grid max-w-[1360px] items-center gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:gap-16 xl:px-12">
        <div className={reverse ? "lg:order-2" : ""}>
          <p className="page-eyebrow flex items-center gap-3"><span className="text-white/30">{number}</span>{eyebrow}</p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-4xl lg:text-[3.25rem]">{title}</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8">{description}</p>
          <ul className="mt-6 space-y-3">
            {details.map((detail) => (
              <li key={detail} className="flex items-start gap-3 text-sm leading-6 text-white/65 sm:text-[15px]">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.8)]" />
                {detail}
              </li>
            ))}
          </ul>
          <Link href={href} className="mt-8 inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/85 transition hover:border-violet-300/35 hover:bg-violet-300/[0.08] hover:text-white">
            {linkLabel}<span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className={`relative ${reverse ? "lg:order-1" : ""} ${portrait ? "mx-auto w-full max-w-[440px]" : ""}`}>
          <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-violet-500/[0.09] blur-3xl" />
          <div className="relative">
            <ProductImage src={image} alt={imageAlt} portrait={portrait} widescreen={widescreen} />
            <div aria-hidden="true" className="absolute -bottom-3 -right-3 -z-10 h-24 w-24 rounded-full border border-violet-300/15 sm:-bottom-5 sm:-right-5 sm:h-36 sm:w-36" />
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

const sections: FeatureSectionProps[] = [
  {
    id: "workspace",
    number: "01",
    eyebrow: "Write · Run · Refine",
    title: "A workspace that keeps you in the flow.",
    description: "Move from problem statement to working solution without leaving the page. The editor, examples, run results, and submissions stay together as you iterate.",
    details: [
      "Write C++ and Python solutions in Function/Class Mode, or use C, C++, and Python in the standalone stdin/stdout workspace.",
      "Run against examples, submit for full judging, and inspect verdicts and execution metrics.",
      "Use custom input cases in the workspace to try your own edge cases.",
    ],
    href: "/workspace",
    linkLabel: "Open the workspace",
    image: "/Screenshots/WorkshopPage.png",
    imageAlt: "YexCode standalone coding workspace with a C++ editor and custom test case panel",
    widescreen: true,
  },
  {
    id: "playlists",
    number: "02",
    eyebrow: "Practice with a plan",
    title: "Turn a long list of problems into a clear path.",
    description: "Collect the questions you want to revisit, follow curated interview roadmaps, and keep track of your own progress across each list.",
    details: [
      "Use curated sets such as Blind 75 and Top 30 Interview Problems.",
      "Create personal playlists around the topics or goals you care about.",
      "Track completion independently for each playlist.",
    ],
    href: "/playlists",
    linkLabel: "Explore playlists",
    image: "/Screenshots/PlaylistPage.png",
    imageAlt: "YexCode playlists page showing curated roadmaps and a personal playlist",
    reverse: true,
  },
  {
    id: "companies",
    number: "03",
    eyebrow: "Interview preparation",
    title: "Practice with company-focused question sets.",
    description: "Explore questions associated with specific companies and work through each interview set at your own pace.",
    details: [
      "Browse company collections and search the available list.",
      "See question counts and completion progress at a glance.",
      "Open questions directly in YexCode or follow their external source where available.",
    ],
    href: "/playlists",
    linkLabel: "Browse company playlists",
    image: "/Screenshots/CompanyPlaylist.png",
    imageAlt: "YexCode company interview playlists with searchable company question collections",
  },
  {
    id: "assistant",
    number: "04",
    eyebrow: "Code-aware help",
    title: "Get another perspective on your code.",
    description: "Ask the Groq-powered assistant to explain an approach, look for likely bugs, or suggest practical improvements while you work.",
    details: [
      "Choose a quick prompt or ask a question in your own words.",
      "Bring your own Groq API key; it is encrypted before storage.",
      "Your code and prompt are sent only when you ask, and the conversation is not stored by YexCode.",
    ],
    href: "/workspace",
    linkLabel: "Try the assistant in Workspace",
    image: "/Screenshots/AiAssisstant.png",
    imageAlt: "YexCode Groq AI assistant explaining code in the workspace",
    reverse: true,
    portrait: true,
  },
];

export default function HomePage() {
  return (
    <main className="relative isolate overflow-hidden bg-[#09090c] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden opacity-55">
        <Aurora colorStops={["#8939eb", "#260347", "#4f4cf8"]} blend={0.8} amplitude={1} speed={0.7} />
      </div>
      <div aria-hidden="true" className="showcase-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[38rem] h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-violet-800/[0.08] blur-[120px]" />

      <section className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1480px] items-center gap-12 px-4 pb-16 pt-32 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:px-12 lg:pb-24 lg:pt-28">
        <ScrollReveal className="relative z-10 max-w-2xl">
          <p className="page-eyebrow inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-1.5 tracking-[0.16em]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.9)]" />
            Practice with purpose
          </p>
          <h1 className="mt-6 text-[2.8rem] font-semibold leading-[0.99] tracking-[-0.065em] text-white sm:text-6xl lg:text-[4.6rem] xl:text-[5.2rem]">
            Solve better.<br /><span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-transparent">Think deeper.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
            A focused coding practice space for exploring problems, building solutions, and preparing for interviews—one test at a time.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/problems-list" className="group inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(124,58,237,0.28)] transition hover:-translate-y-0.5 hover:bg-violet-400">
              Explore problems<span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="/workspace" className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-black/20 px-5 py-3 text-sm font-medium text-white/75 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white">
              Open workspace
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/40 sm:text-sm">
            <span>C · C++ · Python</span><span aria-hidden="true" className="text-violet-300/50">/</span>
            <span>Company sets</span><span aria-hidden="true" className="text-violet-300/50">/</span>
            <span>Code-aware AI</span>
          </div>
        </ScrollReveal>

        <ScrollReveal className="relative mx-auto w-full max-w-[850px] lg:ml-auto" delay={120}>
          <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-fuchsia-500/[0.08] to-sky-500/10 blur-3xl" />
          <div className="relative rotate-[0.6deg] rounded-2xl border border-white/15 bg-[#15141d]/90 p-2 shadow-[0_36px_120px_rgba(0,0,0,0.62)] backdrop-blur-xl transition-transform duration-700 hover:rotate-0 sm:p-3">
            <div className="mb-2 flex items-center justify-between px-1.5 py-1 sm:px-2">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/45 sm:text-xs"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Problem library</div>
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] text-emerald-200/80 sm:text-xs">Ready to solve</span>
            </div>
            <ProductImage src="/Screenshots/ProblemList.png" alt="YexCode problem list with search, difficulty filters, and progress" priority />
            <div className="mt-2 flex items-center justify-between px-1.5 py-1 text-[10px] text-white/35 sm:px-2 sm:text-xs">
              <span>Browse the catalog. Pick a challenge. Start coding.</span><span className="hidden sm:inline">Your practice, in one place.</span>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-2 hidden rounded-xl border border-white/10 bg-[#17151f]/95 px-4 py-3 shadow-xl backdrop-blur-lg sm:block lg:-left-10">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/35">Practice loop</p>
            <p className="mt-1 text-sm font-medium text-white/80">Read <span className="text-violet-300">→</span> Code <span className="text-violet-300">→</span> Improve</p>
          </div>
        </ScrollReveal>
      </section>

      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-8 xl:px-12">
        <div className="h-px bg-gradient-to-r from-transparent via-violet-200/20 to-transparent" />
        <div className="grid grid-cols-2 gap-4 py-6 text-center sm:grid-cols-4 sm:py-8">
          {[
            ["01", "Problem library"],
            ["02", "Coding workspace"],
            ["03", "Interview playlists"],
            ["04", "Groq AI assistant"],
          ].map(([number, label]) => <div key={number} className="flex items-center justify-center gap-2 text-xs text-white/45 sm:text-sm"><span className="font-mono text-[10px] text-violet-200/50">{number}</span>{label}</div>)}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-violet-200/20 to-transparent" />
      </div>

      <div className="relative">
        <div aria-hidden="true" className="showcase-grid-bg pointer-events-none absolute inset-0 opacity-20" />
        {sections.map((section) => <FeatureSection key={section.id} {...section} />)}
      </div>

      <section className="relative px-4 py-20 sm:px-8 sm:py-28">
        <ScrollReveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-950/55 via-[#17131f] to-[#11141c] px-6 py-12 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 h-80 w-80 rounded-full bg-violet-500/20 blur-[90px]" />
          <p className="page-eyebrow relative">Your next session starts here</p>
          <h2 className="relative mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">Make your practice count.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-white/55 sm:text-base">Pick a problem, open the workspace, and keep building momentum.</p>
          <Link href="/problems-list" className="relative mt-8 inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-400">Find a problem<span aria-hidden="true">→</span></Link>
        </ScrollReveal>
      </section>

      <footer className="relative border-t border-white/[0.07] px-4 py-7 text-center text-xs text-white/35 sm:px-8">
        <p>YexCode · A quieter place to get better at coding.</p>
      </footer>
    </main>
  );
}
