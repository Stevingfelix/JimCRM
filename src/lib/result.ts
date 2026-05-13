export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function err(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export function fromException(e: unknown): ActionResult<never> {
  if (e instanceof Error) {
    return { ok: false, error: { code: "internal", message: e.message } };
  }
  return { ok: false, error: { code: "internal", message: "Unknown error" } };
}
