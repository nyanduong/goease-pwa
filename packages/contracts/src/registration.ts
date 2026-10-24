import { z } from 'zod';
import type { UserDto } from './product.js';

export const registrationOtpSchema = z.strictObject({
  challenge: z
    .string()
    .length(43)
    .regex(/^[a-zA-Z0-9_-]+$/),
  code: z
    .string()
    .length(6)
    .regex(/^[0-9]+$/),
});
export type RegistrationOtpInput = z.infer<typeof registrationOtpSchema>;
export type RegistrationPending = {
  verificationRequired: true;
  challenge: string;
  expiresAt: string;
  retryAfterSeconds: number;
};
export type RegistrationResponse = { user: UserDto } | RegistrationPending;
