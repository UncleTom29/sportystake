import { nanoid, customAlphabet } from "nanoid";

export { nanoid };
export const shortId = customAlphabet("0123456789abcdefghjkmnpqrstvwxyz", 12);
export const referralCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
export const hexId = customAlphabet("0123456789abcdef", 64);
