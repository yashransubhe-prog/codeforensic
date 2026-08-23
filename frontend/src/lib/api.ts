import type { Dependency, Project, User } from "../types";

const API = "https://codeforensic.onrender.com/api";

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

function ensureAllFilesAppearInGraph(project: Project): Project {
  const represented = new Set<string>();

  project.dependencies.forEach((edge) => {
    represented.add(edge.sourceFile);
    represented.add(edge.targetFile);
  });

  const fileMarkers: Dependency[] = project.files
    .filter((file) => !represented.has(file.path))
    .map((file) => ({
      id: `file-index:${file.id}`,
      sourceFile: file.path,
      targetFile: file.path,
      type: "FILE_INDEX",
    }));

  return {
    ...project,
    dependencies: [...project.dependencies, ...fileMarkers],
  };
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
  const result = await request<{ success: boolean; project: Project }>(
    `/projects/${id}`
  );

  return {
    ...result,
    project: ensureAllFilesAppearInGraph(result.project),
  };
}

export async function importProject(file: File, name?: string) {
  const form = new FormData();
  form.append("project", file);

  if (name) {
    form.append("name", name);
  }

  const result = await request<{ success: boolean; project: Project }>(
    "/projects/import",
    {
      method: "POST",
      body: form,
    }
  );

  return {
    ...result,
    project: ensureAllFilesAppearInGraph(result.project),
  };
}

export async function importGithubProject(url: string) {
  const result = await request<{ success: boolean; project: Project }>(
    "/github/import",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    },
  );

  return {
    ...result,
    project: ensureAllFilesAppearInGraph(result.project),
  };
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
