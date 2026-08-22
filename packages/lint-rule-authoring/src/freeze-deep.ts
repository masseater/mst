import type { DeepReadonly } from "es-toolkit/types";

const isObjectLike = (subject: unknown): subject is object =>
  (typeof subject === "object" && subject !== null) || typeof subject === "function";

const freezeRecursively = (subject: unknown, ancestors: readonly object[]): unknown => {
  if (!isObjectLike(subject) || ancestors.includes(subject)) return subject;
  const nextAncestors = [...ancestors, subject];
  for (const propertyName of Reflect.ownKeys(subject)) {
    const descriptor = Object.getOwnPropertyDescriptor(subject, propertyName);
    if (descriptor !== undefined && "value" in descriptor) {
      freezeRecursively(descriptor.value, nextAncestors);
    }
  }
  return Object.freeze(subject);
};

export function freezeDeep<Value>(subject: Value): DeepReadonly<Value>;
export function freezeDeep(subject: unknown): unknown {
  return freezeRecursively(subject, []);
}
