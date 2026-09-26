/** 过滤对象中值为 undefined 的键，避免 Object.assign 写入 null/undefined */
export function omitUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  ) as Partial<T>;
}
