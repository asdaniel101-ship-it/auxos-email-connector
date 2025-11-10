import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/images/brokerzero-logo.png"
            alt="BrokerZero watermark"
            fill
            className="object-cover object-center"
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Image src="/images/brokerzero-logo.png" alt="BrokerZero" width={64} height={64} />
              <span className="text-2xl font-semibold tracking-wide uppercase text-slate-200">
                BrokerZero
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-tight">
              The AI-native brokerage built for modern insurance.
            </h1>
            <p className="text-lg sm:text-xl text-slate-200 max-w-2xl">
              BrokerZero combines intake, AI document intelligence, and carrier workflows so brokers, carriers, and
              business owners move from submission to bind with clarity and speed.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/request-demo"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold shadow-lg shadow-slate-900/40 hover:bg-slate-100 transition-colors"
              >
                Request a Demo
              </Link>
              <Link
                href="mailto:hello@brokerzero.com"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-300">
              Already a customer?{" "}
              <Link href="/intake" className="underline hover:text-white">
                Business Portal
              </Link>{" "}
              ·{" "}
              <Link href="/carrier" className="underline hover:text-white">
                Carrier Workspace
              </Link>
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 shadow-xl">
            <h2 className="text-2xl font-semibold mb-4">Why teams choose BrokerZero</h2>
            <ul className="space-y-4 text-slate-100">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span>
                  Business owners get transparent progress, faster quote turnaround, and the best-priced coverage our
                  AI-powered brokerage can negotiate.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span>
                  Insurance carriers receive fully structured, source-of-truth data directly from applicants—ready to
                  underwrite the moment it hits their desk.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400" />
                <span>
                  Temporal-powered automation orchestrates every touchpoint, so no submission stalls and every step is
                  audit-ready.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "AI that does the heavy lifting",
              description:
                "We parse submissions, loss runs, and financials with AI so your producers and underwriters start with structured, source-of-truth data.",
            },
            {
              title: "Broker + carrier collaboration",
              description:
                "Everyone works from the same real-time workspace—no more email chains or missing context when it’s time to quote or bind.",
            },
            {
              title: "Automation you can trust",
              description:
                "Temporal-backed workflows keep every task moving forward with full audit trails and human-in-the-loop controls.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4"
            >
              <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
              <p className="text-slate-600">{card.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-slate-900 text-white rounded-3xl p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 shadow-xl">
          <div>
            <h3 className="text-2xl font-semibold mb-3">Ready to see BrokerZero in action?</h3>
            <p className="text-slate-200 max-w-xl">
              We’ll walk you through how our AI-native workflows cut quoting time, boost submission quality, and give
              carriers the context they need to say yes faster.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/request-demo"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
            >
              Request a Demo
            </Link>
            <Link
              href="mailto:hello@brokerzero.com"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/50 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Email Our Team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}