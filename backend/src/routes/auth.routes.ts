import { Router } from "express";
import { z } from "zod";
import { loginOAuthUser, loginUser, registerUser } from "../services/auth.service";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

function frontendUrl() {
  return process.env.FRONTEND_URL || "https://codeforensic.vercel.app";
}

function oauthRedirectUrl(provider: "google" | "github") {
  const explicit =
    provider === "google"
      ? process.env.GOOGLE_REDIRECT_URI
      : process.env.GITHUB_REDIRECT_URI;

  if (explicit) return explicit;

  const base = process.env.BACKEND_PUBLIC_URL || "https://codeforensic.onrender.com";
  return `${base}/api/auth/${provider}/callback`;
}

function successRedirect(token: string, user: unknown) {
  const encodedUser = Buffer.from(JSON.stringify(user), "utf8").toString("base64");
  return `${frontendUrl()}?auth_token=${encodeURIComponent(token)}&auth_user=${encodeURIComponent(encodedUser)}`;
}

router.post("/register", async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerUser(data.name, data.email, data.password);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration data",
        errors: error.flatten(),
      });
    }

    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginUser(data.email, data.password);

    res.json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid login data",
      });
    }

    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
});

router.get("/google", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({
      success: false,
      message: "Google sign-in is not configured yet",
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return res.redirect(`${frontendUrl()}?auth_error=google`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: oauthRedirectUrl("google"),
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileResponse.json()) as { name?: string; email?: string };

    if (!profileResponse.ok || !profile.email) {
      throw new Error("GOOGLE_PROFILE_FAILED");
    }

    const result = await loginOAuthUser(profile.name || "Google User", profile.email);
    return res.redirect(successRedirect(result.token, result.user));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return res.redirect(`${frontendUrl()}?auth_error=google`);
  }
});

router.get("/github", (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({
      success: false,
      message: "GitHub sign-in is not configured yet",
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUrl("github"),
    scope: "read:user user:email",
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

router.get("/github/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return res.redirect(`${frontendUrl()}?auth_error=github`);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CodeForensic",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: oauthRedirectUrl("github"),
      }),
    });

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("GITHUB_TOKEN_EXCHANGE_FAILED");
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeForensic",
    };

    const profileResponse = await fetch("https://api.github.com/user", { headers });
    const profile = (await profileResponse.json()) as { name?: string; login?: string; email?: string | null };

    let email = profile.email || "";

    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", { headers });
      const emails = (await emailResponse.json()) as Array<{ email: string; primary?: boolean; verified?: boolean }>;
      email =
        emails.find((item) => item.primary && item.verified)?.email ||
        emails.find((item) => item.verified)?.email ||
        emails[0]?.email ||
        "";
    }

    if (!email) {
      throw new Error("GITHUB_EMAIL_REQUIRED");
    }

    const result = await loginOAuthUser(profile.name || profile.login || "GitHub User", email);
    return res.redirect(successRedirect(result.token, result.user));
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return res.redirect(`${frontendUrl()}?auth_error=github`);
  }
});

export default router;
