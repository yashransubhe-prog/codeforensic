import type { Project, User } from "../types";

const API = "https://codeforensic.onrender.com";

export const storage = {
  token: () => localStorage.getItem("cf_token"),

  user: (): User | null => {
    const raw = localStorage.getItem("cf_user");
    return raw ? JSON.parse(raw) : null;
  },

  save(token: string, user: User) {
    localStorage.setItem("cf_token", token);
    localStorage.setItem("cf_user", JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_user");
  },
};

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = storage.token();

  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
) {
  return request<{
    success: boolean;
    token: string;
    user: User;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(email: string, password: string) {
  return request<{
    success: boolean;
    token: string;
    user: User;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function listProjects() {
  return request<{ success: boolean; projects: any[] }>("/projects");
}

export async function getProject(id: string) {
  return request<{ success: boolean; project: Project }>(
    `/projects/${id}`
  );
}

export async function importProject(file: File, name?: string) {
  const form = new FormData();

  form.append("project", file);

  if (name) {
    form.append("name", name);
  }

  return request<{ success: boolean; project: Project }>(
    "/projects/import",
    {
      method: "POST",
      body: form,
    }
  );
}

export async function importGithubProject(url: string) {
  return request<{ success: boolean; project: Project }>(
    "/github/import",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    },
  );
}

export async function askAI(
  message: string,
  projectId?: string
) {
  return request<any>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      projectId,
    }),
  });
}
