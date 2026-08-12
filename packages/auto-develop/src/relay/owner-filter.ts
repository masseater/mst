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
  readonly remember: (event: StoredEvent) => void;
  readonly discardIfClosed: (event: StoredEvent) => void;
  readonly owns: (ownership: {
    readonly event: StoredEvent;
    readonly subscriberLogin: string;
  }) => Promise<boolean>;
};

const eventPullNumber = (event: StoredEvent): number | undefined => {
  const pullNumber = asRecord(event.payload.pull_request)?.number;
  return typeof pullNumber === "number" ? pullNumber : undefined;
};

const isReviewInputChange = (event: StoredEvent): boolean => {
  if (event.eventType !== "pull_request") return false;
  if (event.payload.action === "synchronize") return true;
  const changes = asRecord(event.payload.changes);
  return (
    event.payload.action === "edited" && changes !== undefined && Object.hasOwn(changes, "base")
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
    readonly event: StoredEvent;
    readonly subscriberLogin: string;
  }): Promise<boolean> => {
    const payloadAuthor = pullRequestAuthorLogin(ownership.event.payload);
    if (payloadAuthor !== undefined) return payloadAuthor === ownership.subscriberLogin;
    for (const prNumber of mentionedPullNumbers(ownership.event.payload)) {
      const resolvedAuthor = await resolveAuthor(prNumber);
      if (resolvedAuthor !== undefined) return resolvedAuthor === ownership.subscriberLogin;
    }
    return false;
  };

  return {
    remember: (event) => {
      const prNumber = eventPullNumber(event);
      const authorLogin = pullRequestAuthorLogin(event.payload);
      if (prNumber !== undefined && authorLogin !== undefined) {
        authorByPullNumber.set(prNumber, authorLogin);
      }
    },
    discardIfClosed: (event) => {
      const prNumber = eventPullNumber(event);
      if (
        event.eventType === "pull_request" &&
        event.payload.action === "closed" &&
        prNumber !== undefined
      ) {
        authorByPullNumber.delete(prNumber);
      }
    },
    owns: async ({ event, subscriberLogin }) => {
      if (event.eventType === "pull_request" && event.payload.action === "review_requested") {
        return requestedReviewerLogin(event.payload) === subscriberLogin;
      }
      if (
        isReviewInputChange(event) &&
        requestedReviewerLogins(event.payload).includes(subscriberLogin)
      ) {
        return true;
      }
      return ownsByAuthor({ event, subscriberLogin });
    },
  };
};
