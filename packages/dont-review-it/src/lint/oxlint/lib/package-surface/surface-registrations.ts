import type { Context, RuleMeta } from "@oxlint/plugins";

const REGISTERED_PACKAGES = {
  type: "array",
  items: {
    type: "object",
    properties: {
      packageName: { type: "string" },
      reason: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
} as const;

export const PACKAGE_SURFACE_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      runnablePackages: REGISTERED_PACKAGES,
      importablePackages: REGISTERED_PACKAGES,
      exceptions: REGISTERED_PACKAGES,
    },
    additionalProperties: false,
  },
];

type SurfaceRegistration = {
  readonly packageName?: string;
  readonly reason?: string;
};

type PackageSurfaceOptions = {
  readonly runnablePackages?: readonly SurfaceRegistration[];
  readonly importablePackages?: readonly SurfaceRegistration[];
  readonly exceptions?: readonly SurfaceRegistration[];
};

const optionsOf = (options: Context["options"]): PackageSurfaceOptions =>
  (options[0] ?? {}) as PackageSurfaceOptions;

const namesIn = (registrations: readonly SurfaceRegistration[]): ReadonlySet<string> =>
  new Set(
    registrations.flatMap((registration) => {
      const { packageName } = registration;
      return packageName === undefined || packageName === "" ? [] : [packageName];
    }),
  );

export const runnablePackagesFrom = (options: Context["options"]): ReadonlySet<string> =>
  namesIn(optionsOf(options).runnablePackages ?? []);

export const importablePackagesFrom = (options: Context["options"]): ReadonlySet<string> =>
  namesIn(optionsOf(options).importablePackages ?? []);

export const exemptPackagesFrom = (options: Context["options"]): ReadonlySet<string> =>
  namesIn(
    (optionsOf(options).exceptions ?? []).filter(
      (registration) => (registration.reason ?? "").trim() !== "",
    ),
  );
