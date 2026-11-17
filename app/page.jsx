// A server component: the static hero, "How it works" and the footer cost HTML, not JavaScript.
// The interactive parts are two client islands, <SiteNav /> (the condense observer) and <Planner />
// (the form, the status and the result). DESIGN_SYSTEM 9.3.

import SiteNav from './components/SiteNav.jsx';
import Hero from './components/Hero.jsx';
import Planner from './components/Planner.jsx';
import { HowItWorks } from './components/InfoSections.jsx';
import SiteFooter from './components/SiteFooter.jsx';

export default function Home() {
    return (
        <>
            <SiteNav />
            <main>
                <Hero />
                <Planner />
                <HowItWorks />
            </main>
            <SiteFooter />
        </>
    );
}
