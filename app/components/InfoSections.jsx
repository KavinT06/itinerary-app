// "How it works": static, true statements about the product only. Each fact is stated once on the
// page: the hero carries the limits (14 days, 5 stops, 5-30 s), this section says what the plan
// contains and carries the one AI caveat on the landing page.

const STEPS = [
    {
        title: 'Tell us where and when',
        text: 'Enter the area, city and country, your travel dates and your name.',
    },
    {
        title: 'Get a plan for each day',
        text: 'Every day has the area it focuses on and five timed stops, each with a venue and a practical tip. The plan also includes notes on the destination and the season, and an estimated budget for one traveller, excluding flights.',
    },
    {
        title: 'Check before you book',
        text: 'The plan is written by AI and is not verified. Check opening hours, prices and bookings before you travel.',
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" aria-labelledby="how-title" className="mx-auto max-w-content px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="lg:grid lg:grid-cols-12 lg:gap-6">
                <div className="lg:col-span-4">
                    <h2 id="how-title" className="text-h2-m text-ink lg:text-h2">How it works</h2>
                    <p className="mt-3 max-w-copy text-muted">Six fields in, a plan for every day of your trip out.</p>
                </div>
                <ol className="mt-8 border-t border-hairline lg:col-span-8 lg:mt-0">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="grid gap-2 border-b border-hairline py-6 sm:grid-cols-12 sm:gap-6 lg:py-8">
                            <div className="flex items-baseline gap-4 sm:col-span-5">
                                <span className="text-small font-semibold text-muted tabular-nums">0{i + 1}</span>
                                <h3 className="text-h3-m text-ink">{step.title}</h3>
                            </div>
                            <p className="text-muted sm:col-span-7">{step.text}</p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
