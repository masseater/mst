import {
  mentionedPullNumbers,
  pullRequestAuthorLogin,
  requestedReviewerLogin,
  requestedReviewerLogins,
} from "../contract/extract.ts";
import { asRecord } from "../contract/unknown-record.ts";

import type { GithubReader } from "./github-reader.ts";
import type { EventStore, StoredEvent } from "./store.ts";

export type OwnerFilter = {
  readonly remember: (stored: StoredEvent) => void;
  readonly discardIfClosed: (stored: StoredEvent) => void;
  readonly owns: (ownership: {
    readonly stored: StoredEvent;
    readonly subscriberLogin: string;
  }) => Promise<boolean>;
};

type Upstream = {
  readonly events: EventStore;
  readonly github: GithubReader;
};

const eventPullNumber = (stored: StoredEvent): number | undefined => {
  const pullNumber = asRecord(stored.payload.pull_request)?.number;
  return typeof pullNumber === "number" ? pullNumber : undefined;
};

const isReviewInputChange = (stored: StoredEvent): boolean => {
  if (stored.eventType !== "pull_request") return false;
  if (stored.payload.action === "synchronize") return true;
  const changes = asRecord(stored.payload.changes);
  return (
    stored.payload.action === "edited" && changes !== undefined && Object.hasOwn(changes, "base")
  );
};

class PullAuthorOwnerFilter implements OwnerFilter {
  readonly #upstream: Upstream;

  #authorByPullNumber: ReadonlyMap<number, string> = new Map();

  constructor(upstream: Upstream) {
    this.#upstream = upstream;
  }

  readonly #resolveAuthor = async (prNumber: number): Promise<string | undefined> => {
    const cachedLogin = this.#authorByPullNumber.get(prNumber);
    if (cachedLogin !== undefined) return cachedLogin;
    const authorEvent = await this.#upstream.events.findAuthorEvent(prNumber);
    const storedLogin =
      authorEvent === null ? undefined : pullRequestAuthorLogin(authorEvent.payload);
    const login =
      storedLogin ?? (await this.#upstream.github.resolvePullAuthor(prNumber)) ?? undefined;
    if (login !== undefined) {
      this.#authorByPullNumber = new Map<number, string>([
        ...this.#authorByPullNumber,
        [prNumber, login],
      ]);
    }
    return login;
  };

  readonly #ownsByAuthor = async (ownership: {
    readonly stored: StoredEvent;
    readonly subscriberLogin: string;
  }): Promise<boolean> => {
    const payloadAuthor = pullRequestAuthorLogin(ownership.stored.payload);
    if (payloadAuthor !== undefined) return payloadAuthor === ownership.subscriberLogin;
    for (const prNumber of mentionedPullNumbers(ownership.stored.payload)) {
      const resolvedAuthor = await this.#resolveAuthor(prNumber);
      if (resolvedAuthor !== undefined) return resolvedAuthor === ownership.subscriberLogin;
    }
    return false;
  };

  readonly remember = (stored: StoredEvent): void => {
    const prNumber = eventPullNumber(stored);
    const authorLogin = pullRequestAuthorLogin(stored.payload);
    if (prNumber !== undefined && authorLogin !== undefined) {
      this.#authorByPullNumber = new Map<number, string>([
        ...this.#authorByPullNumber,
        [prNumber, authorLogin],
      ]);
    }
  };

  readonly discardIfClosed = (stored: StoredEvent): void => {
    const prNumber = eventPullNumber(stored);
    if (
      stored.eventType === "pull_request" &&
      stored.payload.action === "closed" &&
      prNumber !== undefined
    ) {
      this.#authorByPullNumber = new Map<number, string>(
        [...this.#authorByPullNumber].filter(([rememberedNumber]) => rememberedNumber !== prNumber),
      );
    }
  };

  readonly owns = async ({
    stored,
    subscriberLogin,
  }: {
    readonly stored: StoredEvent;
    readonly subscriberLogin: string;
  }): Promise<boolean> => {
    if (stored.eventType === "pull_request" && stored.payload.action === "review_requested") {
      return requestedReviewerLogin(stored.payload) === subscriberLogin;
    }
    if (
      isReviewInputChange(stored) &&
      requestedReviewerLogins(stored.payload).includes(subscriberLogin)
    ) {
      return true;
    }
    return this.#ownsByAuthor({ stored: stored, subscriberLogin });
  };
}

export const createOwnerFilter = (upstream: Upstream): OwnerFilter =>
  new PullAuthorOwnerFilter(upstream);
