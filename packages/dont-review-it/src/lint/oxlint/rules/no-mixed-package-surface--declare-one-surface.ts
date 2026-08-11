import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  governingSurfacesOf,
  type PackageSurfaces,
} from "../lib/package-surface/declared-surfaces.ts";
import {
  exemptPackagesFrom,
  importablePackagesFrom,
  PACKAGE_SURFACE_SCHEMA,
  runnablePackagesFrom,
} from "../lib/package-surface/surface-registrations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../lib/rule-message.ts";

const spelledFields = (fields: readonly string[]): string =>
  fields.map((field) => `\`${field}\``).join(", ");

const surfaceViolationOf = (subject: {
  readonly surfaces: PackageSurfaces;
  readonly runnablePackages: ReadonlySet<string>;
  readonly importablePackages: ReadonlySet<string>;
}): RuleMessage | null => {
  const { packageName, manifestPath, runnableFields, importableFields } = subject.surfaces;
  const declaredBy = { packageName, manifestPath };

  if (subject.runnablePackages.has(packageName)) {
    return importableFields.length === 0
      ? null
      : {
          messageId: "importSurfaceOnRunnablePackage",
          data: { ...declaredBy, importableFields: spelledFields(importableFields) },
        };
  }
  if (subject.importablePackages.has(packageName)) {
    return runnableFields.length === 0
      ? null
      : {
          messageId: "runnableEntryOnImportablePackage",
          data: { ...declaredBy, runnableFields: spelledFields(runnableFields) },
        };
  }
  return runnableFields.length === 0 || importableFields.length === 0
    ? null
    : {
        messageId: "mixedPackageSurface",
        data: {
          ...declaredBy,
          runnableFields: spelledFields(runnableFields),
          importableFields: spelledFields(importableFields),
        },
      };
};

export const noMixedPackageSurface = createDontReviewItRule({
  name: "no-mixed-package-surface--declare-one-surface",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a package to declare either the surface it is run through or the surface it is imported through, so which discipline owns the package is decided by its manifest instead of by whoever reaches into it next",
      relatedGuidelines: [],
    },
    messages: {
      mixedPackageSurface:
        "A package must not declare both the surface it is run through and the surface it is imported through. `{{packageName}}` declares a runnable entry at {{runnableFields}} and an import surface at {{importableFields}} in `{{manifestPath}}`. Split the two surfaces into two packages, keep the runnable entry in the package that is only run, keep the import entries in the package that is only imported, and declare a dependency from the first on the second.",
      importSurfaceOnRunnablePackage:
        "A package registered as run-only must not declare an import surface. `{{packageName}}` is registered as a package that is only run, and `{{manifestPath}}` declares an import surface at {{importableFields}}. Move the shared implementation into a package that declares only import entries, declare a dependency on that package from here, and leave this manifest holding its runnable entry alone.",
      runnableEntryOnImportablePackage:
        "A package registered as importable must not declare a runnable entry. `{{packageName}}` is registered as a package that is only imported, and `{{manifestPath}}` declares a runnable entry at {{runnableFields}}. Move that entry into a package that declares only a runnable entry, and declare a dependency from that package on this one.",
    },
    schema: PACKAGE_SURFACE_SCHEMA,
  },
  create(context) {
    const runnablePackages = runnablePackagesFrom(context.options);
    const importablePackages = importablePackagesFrom(context.options);
    const exemptPackages = exemptPackagesFrom(context.options);

    return {
      Program(node: ESTree.Program) {
        const surfaces = governingSurfacesOf(context);
        if (surfaces === null) return;
        if (exemptPackages.has(surfaces.packageName)) return;

        const violation = surfaceViolationOf({ surfaces, runnablePackages, importablePackages });
        if (violation === null) return;

        context.report({ node, ...violation });
      },
    };
  },
});
