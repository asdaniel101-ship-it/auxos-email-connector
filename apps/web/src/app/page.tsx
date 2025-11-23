import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-tight">
              Focus on Running Your Restaurant.<br />We Handle the Back Office.
            </h1>
            <p className="text-lg sm:text-xl text-slate-200 max-w-3xl mx-auto mb-4">
              Get the right insurance rates and coverage. Access funding when you need it. All without the paperwork headaches.
            </p>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              We help restaurants handle back office tasks so you can focus on what you do best—serving great food and creating memorable experiences.
            </p>
            
            {/* Two Big CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/start?vertical=insurance"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-slate-900 font-semibold shadow-lg shadow-slate-900/40 hover:bg-slate-100 transition-colors text-lg"
              >
                Get Better Insurance Rates
              </Link>
              <Link
                href="/start?vertical=lending"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-white/40 text-white font-semibold hover:bg-white/10 transition-colors text-lg"
              >
                Get Restaurant Funding
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
            Back Office Support for Restaurants
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            We streamline the essential business tasks that take you away from your kitchen and customers.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Right Insurance Coverage",
              description:
                "Get matched with insurance brokers who understand restaurants. Find the right coverage at competitive rates—General Liability, Workers' Comp, Property, and more.",
              icon: "🛡️",
            },
            {
              title: "Easy Access to Funding",
              description:
                "Need capital for expansion, equipment, or cash flow? We connect you with lenders who make the process simple and fast.",
              icon: "💰",
            },
            {
              title: "No Paperwork Headaches",
              description:
                "Answer a few questions in a friendly chat. Upload your documents once. We handle the rest and organize everything for your broker or lender.",
              icon: "📄",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-2">{card.icon}</div>
              <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
              <p className="text-slate-600 leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Simple, fast, and designed for busy restaurant owners.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Answer Questions",
                description:
                  "Have a quick chat with our assistant. No long forms—just natural conversation about your restaurant.",
              },
              {
                step: "2",
                title: "Upload Documents",
                description:
                  "Share your existing documents once. We extract all the information automatically using AI.",
              },
              {
                step: "3",
                title: "Get Matched",
                description:
                  "We connect you with insurance brokers and lenders who receive your complete, organized profile.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 text-white text-2xl font-bold mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">
            Ready to Focus on What Matters?
          </h2>
          <p className="text-lg text-slate-200 mb-8 max-w-2xl mx-auto">
            Let us handle the back office so you can get back to running your restaurant.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/start?vertical=insurance"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors text-lg"
            >
              Start with Insurance
            </Link>
            <Link
              href="/start?vertical=lending"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-white/40 text-white font-semibold hover:bg-white/10 transition-colors text-lg"
            >
              Explore Funding Options
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
