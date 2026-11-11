function formatDate(isoDate) {
    // Trip dates are calendar days; format in UTC so the weekday never shifts.
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
}

function formatBudget({ currency, estimated }) {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(estimated);
    } catch {
        return `${currency} ${estimated.toLocaleString()}`;
    }
}

function SummaryCard({ icon, label, children, tone }) {
    return (
        <div className={`bg-linear-to-br ${tone.bg} rounded-2xl p-6 motion-safe:hover:scale-105 transition-transform`}>
            <div aria-hidden="true" className="text-3xl mb-3">{icon}</div>
            <p className={`text-sm font-semibold ${tone.label} mb-1`}>{label}</p>
            <p className={`text-lg font-bold ${tone.value} wrap-anywhere`}>{children}</p>
        </div>
    );
}

function Activity({ activity }) {
    return (
        <li className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-purple-50 transition-colors">
            <div className="shrink-0 w-16 h-16 bg-linear-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg text-center leading-tight px-1">
                {activity.time || '—'}
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="font-bold text-lg text-gray-800 mb-1">{activity.title}</h5>
                {activity.description && <p className="text-gray-600 text-sm mb-2">{activity.description}</p>}
                {activity.location && (
                    <p className="flex items-start text-sm text-purple-700">
                        <span aria-hidden="true" className="mr-1">📍</span>
                        <span className="font-medium min-w-0 wrap-anywhere">{activity.location}</span>
                    </p>
                )}
                {activity.notes && (
                    <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                        <p className="text-sm text-gray-700">
                            <span className="font-bold"><span aria-hidden="true">💡 </span>Tip: </span>
                            {activity.notes}
                        </p>
                    </div>
                )}
            </div>
        </li>
    );
}

export default function ItineraryView({ trip, onReset }) {
    const lastIndex = trip.days.length - 1;

    return (
        <article className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12 mb-8" aria-labelledby="trip-title">
            <header className="text-center mb-10 pb-8 border-b-2 border-purple-100">
                <span aria-hidden="true" className="text-6xl mb-4 inline-block">🎉</span>
                <h2 id="trip-title" className="text-3xl sm:text-4xl font-black bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                    {trip.title}
                </h2>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <SummaryCard icon="📍" label="Destination" tone={{ bg: 'from-purple-50 to-purple-100', label: 'text-purple-700', value: 'text-purple-900' }}>
                    {trip.destination}
                </SummaryCard>
                <SummaryCard icon="📅" label={`Dates · ${trip.days.length} day${trip.days.length === 1 ? '' : 's'}`} tone={{ bg: 'from-pink-50 to-pink-100', label: 'text-pink-700', value: 'text-pink-900' }}>
                    {trip.startDate} → {trip.endDate}
                </SummaryCard>
                <SummaryCard icon="👤" label="Traveller" tone={{ bg: 'from-blue-50 to-blue-100', label: 'text-blue-700', value: 'text-blue-900' }}>
                    {trip.createdBy}
                </SummaryCard>
                {trip.budget && (
                    <SummaryCard icon="💰" label="Est. budget (excl. flights)" tone={{ bg: 'from-green-50 to-green-100', label: 'text-green-700', value: 'text-green-900' }}>
                        {formatBudget(trip.budget)}
                    </SummaryCard>
                )}
            </div>

            {trip.notes && (
                <section className="bg-linear-to-br from-amber-50 to-orange-50 rounded-2xl p-6 sm:p-8 mb-10 border-2 border-amber-200">
                    <div className="flex items-start gap-4">
                        <span aria-hidden="true" className="text-4xl">ℹ️</span>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">About Your Destination</h3>
                            <p className="text-gray-700 leading-relaxed text-lg">{trip.notes}</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="space-y-6" aria-labelledby="daily-heading">
                <h3 id="daily-heading" className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                    <span aria-hidden="true" className="mr-3">📋</span>
                    Your Daily Adventure
                </h3>

                {trip.days.map((day, index) => (
                    <div key={day.date} className="bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-xl overflow-hidden">
                        <div className="bg-white/10 backdrop-blur-sm text-white p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <h4 className="text-3xl font-black mb-1">Day {day.day}</h4>
                                    <p className="text-lg opacity-90 wrap-anywhere">
                                        {formatDate(day.date)}{day.location ? ` • ${day.location}` : ''}
                                    </p>
                                </div>
                                <div aria-hidden="true" className="text-5xl opacity-80 shrink-0">
                                    {index === 0 ? '🌅' : index === lastIndex ? '🌃' : '☀️'}
                                </div>
                            </div>
                        </div>
                        <ol className="bg-white p-4 sm:p-6 space-y-4">
                            {day.activities.map((activity, i) => (
                                <Activity key={i} activity={activity} />
                            ))}
                        </ol>
                    </div>
                ))}
            </section>

            <p className="mt-8 text-sm text-gray-500 text-center">
                AI-generated suggestions. Check opening hours, prices and bookings before you travel.
            </p>

            <div className="mt-8 text-center">
                <button
                    type="button"
                    onClick={onReset}
                    className="px-8 py-4 bg-linear-to-r from-gray-600 to-gray-800 text-white rounded-xl font-bold motion-safe:hover:scale-105 transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
                >
                    ← Plan Another Trip
                </button>
            </div>
        </article>
    );
}
