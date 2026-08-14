const SOURCE_EXTENSION = /(\.[cm]?[jt]sx?)$/u;

export const isVerificationTestFile = (path: string): boolean =>
  /\.test\.[cm]?[jt]sx?$/u.test(path) || /(?:^|\/)specs\/[^/]+\.spec\.tsx?$/u.test(path);

export const isImplementationSourceFile = (path: string): boolean =>
  SOURCE_EXTENSION.test(path) && !/\.d\.[cm]?ts$/u.test(path) && !isVerificationTestFile(path);

export const correspondingTestPathFor = (sourcePath: string): string =>
  sourcePath.replace(SOURCE_EXTENSION, ".test$1");
