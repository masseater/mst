import { API } from "typescript/unstable/sync";

export const openTypeScriptApi = (packageDirectory: string): API =>
  new API({ cwd: packageDirectory });
