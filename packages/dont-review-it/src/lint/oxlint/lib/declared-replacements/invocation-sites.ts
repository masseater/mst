import {
  astFieldsOf,
  listedFieldsOf,
  nodeTypeOf,
  requestedSpecifierOf,
  staticSpecifierOf,
} from "../setup-modules/coupling-edges.ts";
import { importRoutesIn, type ImportRoutes } from "../value-declarations/import-routes.ts";
import { spawnFormMatching, SPAWN_TARGET_LINE, type SpawnForm } from "./spawn-forms.ts";

import type { AstFields } from "../ast-node.ts";

const ROUTE_MARK = "#";

const WHOLE_MODULE_MARKS: ReadonlySet<string> = new Set(["default", "*"]);

const NAMESPACE_ROUTE_EXPORT = "default";

export type SpawnSite = {
  readonly form: SpawnForm;
  readonly target: AstFields | null;
  readonly handed: readonly AstFields[];
};

const routePartsOf = (route: string): { readonly specifier: string; readonly exported: string } => {
  const mark = route.lastIndexOf(ROUTE_MARK);
  return { specifier: route.slice(0, mark), exported: route.slice(mark + 1) };
};

const declaredStatementOf = (statement: AstFields): AstFields =>
  nodeTypeOf(statement) === "ExportNamedDeclaration"
    ? (astFieldsOf(statement.declaration) ?? statement)
    : statement;

const requiredSpecifierOf = (bound: AstFields): string | null => {
  const requested = requestedSpecifierOf(bound);
  return requested === null ? null : staticSpecifierOf(requested, new Map());
};

const takenRoutesOf = ({
  named,
  specifier,
}: {
  readonly named: AstFields;
  readonly specifier: string;
}): readonly (readonly [string, string])[] => {
  const nodeType = nodeTypeOf(named);
  if (nodeType === "Identifier") {
    return [[String(named.name), `${specifier}${ROUTE_MARK}${NAMESPACE_ROUTE_EXPORT}`] as const];
  }
  if (nodeType !== "ObjectPattern") return [];

  return listedFieldsOf(named.properties).flatMap((property) => {
    const named = astFieldsOf(property.key);
    const taken = astFieldsOf(property.value);
    if (named === null || taken === null || property.computed === true) return [];
    if (nodeTypeOf(named) !== "Identifier" || nodeTypeOf(taken) !== "Identifier") return [];
    return [[String(taken.name), `${specifier}${ROUTE_MARK}${String(named.name)}`] as const];
  });
};

const wrappedRouteOf = ({
  bound,
  routes,
}: {
  readonly bound: AstFields;
  readonly routes: ImportRoutes;
}): string | null => {
  if (nodeTypeOf(bound) !== "CallExpression") return null;

  return (
    listedFieldsOf(bound.arguments)
      .map((handed) =>
        nodeTypeOf(handed) === "Identifier" ? (routes.get(String(handed.name)) ?? null) : null,
      )
      .find((route) => route !== null) ?? null
  );
};

const boundRoutesIn = (
  statement: AstFields,
  routes: ImportRoutes,
): readonly (readonly [string, string])[] => {
  const declared = declaredStatementOf(statement);
  if (nodeTypeOf(declared) !== "VariableDeclaration" || declared.kind !== "const") return [];

  return listedFieldsOf(declared.declarations).flatMap((declarator) => {
    const named = astFieldsOf(declarator.id);
    const bound = astFieldsOf(declarator.init);
    if (named === null || bound === null) return [];

    const specifier = requiredSpecifierOf(bound);
    if (specifier !== null) return takenRoutesOf({ named, specifier });

    const wrapped = wrappedRouteOf({ bound, routes });
    if (wrapped === null || nodeTypeOf(named) !== "Identifier") return [];
    return [[String(named.name), wrapped] as const];
  });
};

export const spawnRoutesIn = ({
  body,
  filename,
}: {
  readonly body: unknown;
  readonly filename: string;
}): ImportRoutes => {
  const statements = listedFieldsOf(body);
  return statements.reduce<ImportRoutes>(
    (known, statement) => new Map([...known, ...boundRoutesIn(statement, known)]),
    importRoutesIn({ body: statements, relativePath: filename }),
  );
};

const memberRouteOf = ({
  callee,
  routes,
}: {
  readonly callee: AstFields;
  readonly routes: ImportRoutes;
}): string | null => {
  const carrier = astFieldsOf(callee.object);
  const member = astFieldsOf(callee.property);
  if (carrier === null || member === null) return null;
  if (nodeTypeOf(carrier) !== "Identifier" || nodeTypeOf(member) !== "Identifier") return null;

  const route = routes.get(String(carrier.name));
  if (route === undefined) return null;

  const { specifier, exported } = routePartsOf(route);
  return WHOLE_MODULE_MARKS.has(exported)
    ? `${specifier}${ROUTE_MARK}${String(member.name)}`
    : null;
};

const calleeRouteOf = ({
  callee,
  routes,
}: {
  readonly callee: AstFields;
  readonly routes: ImportRoutes;
}): string | null => {
  const nodeType = nodeTypeOf(callee);
  if (nodeType === "Identifier") return routes.get(String(callee.name)) ?? null;
  if (nodeType !== "MemberExpression" || callee.computed === true) return null;
  return memberRouteOf({ callee, routes });
};

const calledFieldOf = (node: AstFields): AstFields | null => {
  const nodeType = nodeTypeOf(node);
  if (nodeType === "TaggedTemplateExpression") return astFieldsOf(node.tag);
  return nodeType === "CallExpression" ? astFieldsOf(node.callee) : null;
};

export const handedTextsOf = ({
  handed,
  constants,
}: {
  readonly handed: readonly AstFields[];
  readonly constants: ReadonlyMap<string, string>;
}): readonly string[] | null => {
  const [listed] = handed;
  if (listed === undefined || nodeTypeOf(listed) !== "ArrayExpression") return null;

  const heldElements = listedFieldsOf(listed.elements);
  const spelled = heldElements
    .map((held) => staticSpecifierOf(held, constants))
    .filter((writtenText) => writtenText !== null);
  return spelled.length === heldElements.length ? spelled : null;
};

const spawnFormAt = ({
  written,
  routes,
  forms,
}: {
  readonly written: AstFields;
  readonly routes: ImportRoutes;
  readonly forms: readonly SpawnForm[];
}): SpawnForm | null => {
  const callee = calledFieldOf(written);
  if (callee === null) return null;

  const route = calleeRouteOf({ callee, routes });
  return route === null ? null : spawnFormMatching({ forms, ...routePartsOf(route) });
};

const siteUnder = (written: AstFields, form: SpawnForm): SpawnSite => {
  if (nodeTypeOf(written) === "TaggedTemplateExpression") {
    return {
      form: { ...form, carries: SPAWN_TARGET_LINE },
      target: astFieldsOf(written.quasi),
      handed: [],
    };
  }

  const handed = listedFieldsOf(written.arguments);
  return {
    form,
    target: handed.at(form.position) ?? null,
    handed: handed.slice(form.position + 1),
  };
};

export const spawnSiteAt = ({
  node,
  routes,
  forms,
}: {
  readonly node: unknown;
  readonly routes: ImportRoutes;
  readonly forms: readonly SpawnForm[];
}): SpawnSite | null => {
  const written = astFieldsOf(node);
  if (written === null) return null;

  const form = spawnFormAt({ written, routes, forms });
  return form === null ? null : siteUnder(written, form);
};
