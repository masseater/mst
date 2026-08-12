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

export const createOwnerFilter = (upstream: {
  readonly events: EventStore;
  readonly github: GithubReader;
}): OwnerFilter => {
  const authorByPullNumber = new Map<number, string>();

  const resolveAuthor = async (prNumber: number): Promise<string | undefined> => {
    const cached = authorByPullNumber.get(prNumber);
    if (cached !== undefined) return cached;
    const authorEvent = await upstream.events.findAuthorEvent(prNumber);
    const storedLogin =
      authorEvent === null ? undefined : pullRequestAuthorLogin(authorEvent.payload);
    const login = storedLogin ?? (await upstream.github.resolvePullAuthor(prNumber)) ?? undefined;
    if (login !== undefined) authorByPullNumber.set(prNumber, login);
    return login;
  };

  const ownsByAuthor = async (ownership: {
    readonly stored: StoredEvent;
    readonly subscriberLogin: string;
  }): Promise<boolean> => {
    const payloadAuthor = pullRequestAuthorLogin(ownership.stored.payload);
    if (payloadAuthor !== undefined) return payloadAuthor === ownership.subscriberLogin;
    for (const prNumber of mentionedPullNumbers(ownership.stored.payload)) {
      const resolvedAuthor = await resolveAuthor(prNumber);
      if (resolvedAuthor !== undefined) return resolvedAuthor === ownership.subscriberLogin;
    }
    return false;
  };

  return {
    remember: (stored) => {
      const prNumber = eventPullNumber(stored);
      const authorLogin = pullRequestAuthorLogin(stored.payload);
      if (prNumber !== undefined && authorLogin !== undefined) {
        authorByPullNumber.set(prNumber, authorLogin);
      }
    },
    discardIfClosed: (stored) => {
      const prNumber = eventPullNumber(stored);
      if (
        stored.eventType === "pull_request" &&
        stored.payload.action === "closed" &&
        prNumber !== undefined
      ) {
        authorByPullNumber.delete(prNumber);
      }
    },
    owns: async ({ stored, subscriberLogin }) => {
      if (stored.eventType === "pull_request" && stored.payload.action === "review_requested") {
        return requestedReviewerLogin(stored.payload) === subscriberLogin;
      }
      if (
        isReviewInputChange(stored) &&
        requestedReviewerLogins(stored.payload).includes(subscriberLogin)
      ) {
        return true;
      }
      return ownsByAuthor({ stored: stored, subscriberLogin });
    },
  };
};
