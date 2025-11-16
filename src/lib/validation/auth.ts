/**
 * Authentication validation schemas using Zod
 * Provides type-safe input validation for auth endpoints
 */

import { z } from 'zod';

// Base email validation
const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters')
  .transform(email => email.toLowerCase().trim());

// Base password validation with security requirements
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Username validation
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters long')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
  .transform(username => username.trim());

/**
 * User signup validation schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  userName: usernameSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * User login validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

/**
 * Token refresh validation schema
 */
export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

/**
 * Password reset request validation schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema
});

/**
 * Password reset validation schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Update user profile validation schema
 */
export const updateProfileSchema = z.object({
  userName: usernameSchema.optional(),
  email: emailSchema.optional()
}).refine((data) => data.userName || data.email, {
  message: "At least one field must be provided",
  path: ["userName", "email"],
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Validation helper functions
 */

/**
 * Validate request body against a schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Format Zod validation errors for API response
 */
export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });
  
  return errors;
}

/**
 * Create a validation middleware for Next.js API routes
 */
export function withValidation<T>(schema: z.ZodSchema<T>) {
  return async (request: Request): Promise<{ success: true; data: T } | { success: false; response: Response }> => {
    const result = await validateRequestBody(request, schema);
    
    if (!result.success) {
      const errors = formatValidationErrors(result.errors);
      return {
        success: false,
        response: new Response(
          JSON.stringify({
            success: false,
            message: 'Validation failed',
            error: {
              message: 'One or more fields contain invalid values',
              code: 'VALIDATION_ERROR',
              details: errors
            },
            timestamp: new Date().toISOString()
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      };
    }
    
    return result;
  };
}

// Export types
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TokenRefreshInput = z.infer<typeof tokenRefreshSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default {
  signupSchema,
  loginSchema,
  tokenRefreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  updateProfileSchema,
  changePasswordSchema,
  validateRequestBody,
  formatValidationErrors,
  withValidation
};