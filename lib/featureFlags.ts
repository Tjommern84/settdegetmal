const parseFlag = (value: string | undefined, fallback = false) => {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
};

export const ENABLE_REVIEWS = parseFlag(process.env.NEXT_PUBLIC_ENABLE_REVIEWS, true);
export const ENABLE_PAYMENTS = parseFlag(process.env.NEXT_PUBLIC_ENABLE_PAYMENTS, true);
export const ENABLE_ADMIN = parseFlag(process.env.NEXT_PUBLIC_ENABLE_ADMIN, true);
export const ENABLE_EMAILS = parseFlag(process.env.NEXT_PUBLIC_ENABLE_EMAILS, true);
export const ENABLE_PILOT_MODE = parseFlag(process.env.NEXT_PUBLIC_ENABLE_PILOT_MODE, false);
export const ENABLE_PARTNER_API = parseFlag(process.env.NEXT_PUBLIC_ENABLE_PARTNER_API, false);

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

