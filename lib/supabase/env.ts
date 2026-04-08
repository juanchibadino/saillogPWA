type SupabaseEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SECRET_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_PROJECT_REF";

export type SupabasePublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
};

export class MissingEnvironmentVariableError extends Error {
  constructor(variableName: string) {
    super(`Missing required environment variable: ${variableName}`);
    this.name = "MissingEnvironmentVariableError";
  }
}

export class InvalidEnvironmentVariableError extends Error {
  constructor(variableName: string, detail: string) {
    super(`Invalid environment variable ${variableName}: ${detail}`);
    this.name = "InvalidEnvironmentVariableError";
  }
}

function getOptionalEnvValue(variableName: SupabaseEnvKey): string | undefined {
  const value = process.env[variableName];
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getRequiredEnvValue(variableName: SupabaseEnvKey): string {
  const value = process.env[variableName];
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new MissingEnvironmentVariableError(variableName);
  }

  return trimmed;
}

function assertValidUrl(variableName: SupabaseEnvKey, value: string): void {
  try {
    // Validate URL early so misconfiguration fails with a clear message.
    new URL(value);
  } catch {
    throw new InvalidEnvironmentVariableError(variableName, "must be a valid URL");
  }
}

function getPublicSupabaseKey(): string {
  const publishableKey = getOptionalEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (publishableKey) {
    return publishableKey;
  }

  const legacyAnonKey = getOptionalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (legacyAnonKey) {
    return legacyAnonKey;
  }

  throw new MissingEnvironmentVariableError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = getRequiredEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  assertValidUrl("NEXT_PUBLIC_SUPABASE_URL", url);

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: getPublicSupabaseKey(),
  };
}

export function getOptionalSupabaseSecretKey(): string | undefined {
  return (
    getOptionalEnvValue("SUPABASE_SECRET_KEY") ??
    getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function getOptionalSupabaseProjectRef(): string | undefined {
  return getOptionalEnvValue("SUPABASE_PROJECT_REF");
}

export function getOptionalAppUrlOrigin(): string | undefined {
  const value = getOptionalEnvValue("NEXT_PUBLIC_APP_URL");

  if (!value) {
    return undefined;
  }

  assertValidUrl("NEXT_PUBLIC_APP_URL", value);
  return new URL(value).origin;
}
