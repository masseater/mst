import { isPlainObject } from "es-toolkit";

import type { ShippablePackagesConfig } from "./config.ts";

export type PublishedEntry = {
  readonly key: string;
  readonly specifier: string;
  readonly runtime: boolean;
};

const conditionEntries = ({
  value,
  key,
  runtime,
  config,
}: {
  readonly value: unknown;
  readonly key: string;
  readonly runtime: boolean;
  readonly config: ShippablePackagesConfig;
}): readonly PublishedEntry[] => {
  if (typeof value === "string") return [{ key, specifier: value, runtime }];

  if (Array.isArray(value))
    return value.flatMap((alternative, position) =>
      conditionEntries({ value: alternative, key: `${key}[${position}]`, runtime, config }),
    );

  if (isPlainObject(value))
    return Object.entries(value).flatMap(([condition, nested]) =>
      conditionEntries({
        value: nested,
        key: `${key}.${condition}`,
        runtime: runtime && condition !== config.typesCondition,
        config,
      }),
    );

  return [];
};

const binEntries = ({
  value,
  config,
}: {
  readonly value: unknown;
  readonly config: ShippablePackagesConfig;
}): readonly PublishedEntry[] => {
  if (typeof value === "string") return [{ key: config.binKey, specifier: value, runtime: true }];

  if (isPlainObject(value))
    return Object.entries(value).flatMap(([command, commandPath]) =>
      typeof commandPath === "string"
        ? [{ key: `${config.binKey}.${command}`, specifier: commandPath, runtime: true }]
        : [],
    );

  return [];
};

export const publishedEntriesOf = ({
  manifestValueOf,
  config,
}: {
  readonly manifestValueOf: (key: string) => unknown;
  readonly config: ShippablePackagesConfig;
}): readonly PublishedEntry[] => {
  const published = manifestValueOf(config.publishConfigKey);
  const overriding = (manifestField: string): unknown =>
    isPlainObject(published) && published[manifestField] !== undefined
      ? published[manifestField]
      : manifestValueOf(manifestField);

  const exported = overriding(config.exportsKey);

  return [
    ...binEntries({ value: overriding(config.binKey), config }),
    ...(isPlainObject(exported)
      ? Object.entries(exported).flatMap(([subpath, declared]) =>
          conditionEntries({
            value: declared,
            key: `${config.exportsKey}["${subpath}"]`,
            runtime: true,
            config,
          }),
        )
      : conditionEntries({ value: exported, key: config.exportsKey, runtime: true, config })),
  ];
};

export const strippedTypeSource = ({
  specifier,
  config,
}: {
  readonly specifier: string;
  readonly config: ShippablePackagesConfig;
}): boolean =>
  !specifier.includes(config.declarationInfix) &&
  config.typeStrippedExtensions.some((extension) => specifier.endsWith(extension));
