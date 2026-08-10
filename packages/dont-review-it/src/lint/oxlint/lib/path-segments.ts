export const segmentsOf = ({
  path,
  separator,
}: {
  readonly path: string;
  readonly separator: string;
}): readonly string[] => path.split(separator).filter((segment) => segment !== "");
