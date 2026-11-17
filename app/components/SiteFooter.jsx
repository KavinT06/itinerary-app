// One quiet row: the wordmark and what the product is. No links we cannot fill. The AI caveat lives
// in "How it works" (step 03) and on every result, so it is not repeated here.

import { PRODUCT_NAME } from './brand.js';

export default function SiteFooter() {
    return (
        <footer className="border-t border-hairline bg-paper">
            <div className="mx-auto flex max-w-content flex-col gap-1 px-4 py-8 text-small text-muted sm:flex-row sm:items-center sm:gap-4 sm:px-6 lg:px-8">
                <span className="font-semibold text-ink">{PRODUCT_NAME}</span>
                <span>Day-by-day travel plans.</span>
            </div>
        </footer>
    );
}
