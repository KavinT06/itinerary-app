// The loading panel and the error banner. The banner's heading and advice depend on the
// error code, so "try again in 20 seconds" and "come back later" no longer look the same.

const PRESENTATION = {
    VALIDATION_FAILED: { title: 'Please check your details', tone: 'amber' },
    RATE_LIMITED: { title: 'Please slow down', tone: 'amber' },
    AI_BUSY: { title: 'The service is busy', tone: 'amber' },
    AI_QUOTA_EXHAUSTED: { title: "Today's limit has been reached", tone: 'amber' },
    AI_TIMEOUT: { title: 'That took too long', tone: 'red' },
    AI_REFUSED: { title: "We couldn't plan that destination", tone: 'amber' },
    SERVICE_UNAVAILABLE: { title: 'The service is unavailable', tone: 'red' },
    NETWORK: { title: "Can't reach the server", tone: 'red' },
};
const DEFAULT_PRESENTATION = { title: "Couldn't create your itinerary", tone: 'red' };

const TONES = {
    red: { box: 'bg-red-50 border-red-500', title: 'text-red-800', text: 'text-red-700', icon: '❌' },
    amber: { box: 'bg-amber-50 border-amber-500', title: 'text-amber-900', text: 'text-amber-800', icon: '⚠️' },
};

function hint(error, cooldown) {
    if (error.code === 'VALIDATION_FAILED' || error.code === 'AI_REFUSED') return null;
    if (!error.retryable) return null;
    return cooldown > 0 ? `You can try again in ${cooldown} seconds.` : 'You can try again now.';
}

export default function GenerationStatus({ status, error, cooldown, onCancel }) {
    const presentation = error ? PRESENTATION[error.code] ?? DEFAULT_PRESENTATION : null;
    const tone = presentation ? TONES[presentation.tone] : null;
    const retryHint = error ? hint(error, cooldown) : null;

    return (
        <>
            <div aria-live="polite">
                {status === 'submitting' && (
                    <div className="mt-6 p-5 bg-purple-50 border-l-4 border-purple-400 rounded-xl flex items-start justify-between gap-4">
                        <div>
                            <p className="font-bold text-purple-900">Crafting your itinerary…</p>
                            <p className="text-purple-800 text-sm mt-1">
                                This usually takes 5–30 seconds, longer when the service is busy.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="shrink-0 px-4 py-2 rounded-lg border-2 border-purple-300 text-purple-900 font-semibold bg-white hover:bg-purple-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div role="alert" className={`mt-6 p-5 border-l-4 rounded-xl ${tone.box}`}>
                    <div className="flex items-start">
                        <span aria-hidden="true" className="text-2xl mr-3">{tone.icon}</span>
                        <div>
                            <h3 className={`font-bold mb-1 ${tone.title}`}>{presentation.title}</h3>
                            <p className={tone.text}>{error.message}</p>
                            {retryHint && <p className={`text-sm mt-2 ${tone.text}`}>{retryHint}</p>}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
