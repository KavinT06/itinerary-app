// Inline SVG icons. Decorative: aria-hidden, colour from currentColor, one stroke width.
//
// Paths for the generic icons are copied from Lucide (https://lucide.dev), ISC licence:
// Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather
// (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
// Permission to use, copy, modify, and/or distribute this software for any purpose with or
// without fee is hereby granted, provided that the above copyright notice and this
// permission notice appear in all copies.

function Icon({ size = 16, className = '', children }) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 ${className}`}
        >
            {children}
        </svg>
    );
}

export const MapPinIcon = (p) => (
    <Icon {...p}>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
    </Icon>
);

export const CalendarIcon = (p) => (
    <Icon {...p}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
    </Icon>
);

export const UserIcon = (p) => (
    <Icon {...p}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </Icon>
);

export const ClockIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
    </Icon>
);

export const ListIcon = (p) => (
    <Icon {...p}>
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
    </Icon>
);

export const CheckIcon = (p) => (
    <Icon {...p}>
        <path d="M20 6 9 17l-5-5" />
    </Icon>
);

export const InfoIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </Icon>
);

export const AlertTriangleIcon = (p) => (
    <Icon {...p}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
    </Icon>
);

export const AlertCircleIcon = (p) => (
    <Icon {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
    </Icon>
);

export const ArrowDownIcon = (p) => (
    <Icon {...p}>
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
    </Icon>
);

export const ArrowLeftIcon = (p) => (
    <Icon {...p}>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </Icon>
);

export const ArrowRightIcon = (p) => (
    <Icon {...p}>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </Icon>
);
