import type { AuthorWorkConclusion, AuthorWorkReviewState } from "./vocabulary.ts";

export type FilteredEvent =
  | {
      readonly kind: "review-requested";
      readonly pullNumber: number;
      readonly deliveryId?: string;
      readonly reviewerLogin?: string;
      readonly title?: string;
      readonly draft?: boolean;
    }
  | {
      readonly kind: "review-input-changed";
      readonly pullNumber: number;
      readonly deliveryId?: string;
      readonly changedInput: "base" | "head";
    }
  | {
      readonly kind: "source-review-submitted";
      readonly pullNumber: number;
      readonly deliveryId?: string;
      readonly state: AuthorWorkReviewState;
      readonly body: string;
    }
  | {
      readonly kind: "ci-completed";
      readonly pullNumber: number;
      readonly deliveryId?: string;
      readonly conclusion: AuthorWorkConclusion;
      readonly headSha: string;
    }
  | { readonly kind: "merge-conflict"; readonly pullNumber: number; readonly deliveryId?: string }
  | { readonly kind: "base-update"; readonly pullNumber: number; readonly deliveryId?: string }
  | { readonly kind: "pr-closed"; readonly pullNumber: number; readonly deliveryId?: string }
  | { readonly kind: "pr-excluded"; readonly pullNumber: number; readonly deliveryId?: string };
