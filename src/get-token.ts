
import "dotenv/config";

interface FirebaseSignInResponse {
  idToken?: string;
  email?: string;
  localId?: string;
  expiresIn?: string;
  error?: {
    message?: string;
  };
}

async function main(): Promise<void> {
  console.log("Starting Firebase token generation...");

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!apiKey || !email || !password) {
    throw new Error(
      [
        "Missing Firebase configuration.",
        `FIREBASE_WEB_API_KEY: ${Boolean(apiKey)}`,
        `TEST_USER_EMAIL: ${Boolean(email)}`,
        `TEST_USER_PASSWORD: ${Boolean(password)}`,
      ].join("\n"),
    );
  }

  console.log("Environment variables loaded.");
  console.log("Signing in test user...");

  const url = new URL(
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
  );

  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const result =
    (await response.json()) as FirebaseSignInResponse;

  if (!response.ok || !result.idToken) {
    throw new Error(
      `Firebase sign-in failed (${response.status}): ${
        result.error?.message ?? "No ID token returned"
      }`,
    );
  }

  console.log("\nFirebase sign-in successful.");
  console.log("User email:", result.email ?? email);
  console.log("Firebase UID:", result.localId);
  console.log("Token expires in:", `${result.expiresIn ?? "unknown"} seconds`);
  console.log("\nFirebase ID token:\n");
  console.log(result.idToken);
  console.log("\nCopy this token into your API client's Authorization header.");
}

main().catch((error: unknown) => {
  console.error(
    "\nToken generation failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
