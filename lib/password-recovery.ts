export const PASSWORD_RESET_SUCCESS =
  "If an account exists for that email, a password reset link has been sent."

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  if (!password.trim()) return "Password cannot be blank or only spaces."
  if (password.length < 12) return "Password must be at least 12 characters."
  if (password.length > 200) return "Password must be 200 characters or fewer."
  if (password !== confirmPassword) return "Passwords do not match."
  return null
}
