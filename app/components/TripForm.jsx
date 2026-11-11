const inputBase =
    'w-full py-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-800 outline-none focus:bg-white transition-all';

function Field({ id, label, icon, focus, value, onChange, ...inputProps }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-2">
                {label}
            </label>
            <div className="relative">
                {icon && (
                    <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                        {icon}
                    </span>
                )}
                <input
                    id={id}
                    name={id}
                    value={value}
                    onChange={onChange}
                    className={`${inputBase} ${icon ? 'pl-12 pr-4' : 'px-4'} ${focus}`}
                    {...inputProps}
                />
            </div>
        </div>
    );
}

function SectionHeading({ icon, border, children }) {
    return (
        <div className={`flex items-center space-x-3 pb-4 border-b-2 ${border}`}>
            <span aria-hidden="true" className="text-3xl">{icon}</span>
            <h2 className="text-2xl font-bold text-gray-800">{children}</h2>
        </div>
    );
}

export default function TripForm({ form, onChange, onSubmit, loading, cooldown, today, limits }) {
    const disabled = loading || cooldown > 0;

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            <section className="space-y-6">
                <SectionHeading icon="👤" border="border-purple-200">About You</SectionHeading>
                <Field
                    id="name"
                    label="Full Name *"
                    icon="👨‍💼"
                    focus="focus:border-purple-500"
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    maxLength={limits.name}
                    required
                    value={form.name}
                    onChange={onChange}
                />
            </section>

            <section className="space-y-6">
                <SectionHeading icon="📅" border="border-pink-200">Travel Dates</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field
                        id="startDate"
                        label="Departure *"
                        icon="🛫"
                        focus="focus:border-pink-500"
                        type="date"
                        min={today || undefined}
                        required
                        value={form.startDate}
                        onChange={onChange}
                    />
                    <Field
                        id="endDate"
                        label="Return *"
                        icon="🛬"
                        focus="focus:border-pink-500"
                        type="date"
                        min={form.startDate || today || undefined}
                        required
                        value={form.endDate}
                        onChange={onChange}
                    />
                </div>
                <p className="text-sm text-gray-500">Trips can be up to {limits.days} days long.</p>
            </section>

            <section className="space-y-6">
                <SectionHeading icon="📍" border="border-blue-200">Dream Destination</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field id="area" label="Area *" focus="focus:border-blue-500" type="text" placeholder="e.g., Manhattan"
                        maxLength={50} required value={form.area} onChange={onChange} />
                    <Field id="city" label="City *" focus="focus:border-blue-500" type="text" placeholder="e.g., New York"
                        maxLength={50} required value={form.city} onChange={onChange} />
                    <Field id="state" label="State / Country *" focus="focus:border-blue-500" type="text" placeholder="e.g., USA"
                        maxLength={45} required value={form.state} onChange={onChange} />
                </div>
            </section>

            <div className="pt-6">
                <button
                    type="submit"
                    disabled={disabled}
                    className="w-full relative overflow-hidden rounded-2xl bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 py-5 px-8 text-lg font-bold text-white shadow-2xl transform transition-all duration-300 motion-safe:hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
                >
                    <span className="flex items-center justify-center space-x-3">
                        {loading ? (
                            <>
                                <svg aria-hidden="true" className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Generating Itinerary…</span>
                            </>
                        ) : cooldown > 0 ? (
                            <>
                                <span aria-hidden="true">⏳</span>
                                <span>Please wait {cooldown}s</span>
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">✨</span>
                                <span>Generate Itinerary</span>
                                <span aria-hidden="true">🚀</span>
                            </>
                        )}
                    </span>
                </button>
            </div>
        </form>
    );
}
