export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  const data = await res
    .json()
    .catch(() => ({ error: "服务暂时没有响应，请重试。" }));
  if (!res.ok)
    throw new ApiError(
      res.status,
      data.error?.message || data.error || data.message || "操作失败，请重试。",
    );
  return data;
}
