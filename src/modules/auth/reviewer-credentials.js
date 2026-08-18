import bcrypt from "bcrypt";

// Kept independent of request handling so both comparisons deliberately have
// identical results and can be tested without a database connection.
export const hasValidReviewerCredentials = async ({ email, password, config }) => {
  const submittedEmail = String(email || "").trim().toLowerCase();
  if (!config.email || !config.passwordHash || !submittedEmail || !password)
    return false;
  // Always perform the bcrypt comparison when a configured hash exists. This
  // avoids making the configured email a timing oracle.
  const passwordMatches = await bcrypt.compare(String(password), config.passwordHash);
  return submittedEmail === config.email && passwordMatches;
};
