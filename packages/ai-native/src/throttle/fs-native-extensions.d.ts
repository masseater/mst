declare module "fs-native-extensions" {
  export const tryLock: (descriptor: number) => boolean;
  export const unlock: (descriptor: number) => void;
}
