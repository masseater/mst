import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { ReviewInputChangedError } from "../lifecycle/review-input-changed-error.ts";
import { silentLogger } from "../logging/logger.ts";
import { createReviewerHandler, type ReviewerHandlerConfig } from "./reviewer-handler.ts";

import type { HandlerGithubClient } from "./github-client.ts";

describe("createReviewerHandler の正常系", () => {
  const it = test
    .extend("cleanRunStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("changesRequestedStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () =>
            Promise.resolve([
              {
                state: "CHANGES_REQUESTED",
                body: "",
                submittedAt: "2026-08-11T00:00:00.000Z",
                commitSha: "sha-1",
                authorLogin: "review-bot",
              },
            ]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("noEffectiveReviewStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("missingProxyLoginStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("missingProxyLoginReviewLookups", async () => {
      const reviewLookups = vi.fn<HandlerGithubClient["listReviews"]>(() => Promise.resolve([]));
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: reviewLookups,
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        log: silentLogger,
      })(7);
      return reviewLookups;
    });

  it("正常完了はステータスを 2 つだけ残す", ({ cleanRunStatusWrites }) => {
    expect(cleanRunStatusWrites).toHaveBeenCalledTimes(2);
  });

  it("正常完了は最初に pending を書く", ({ cleanRunStatusWrites }) => {
    expect(cleanRunStatusWrites).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("正常完了は最後に success を書く", ({ cleanRunStatusWrites }) => {
    expect(cleanRunStatusWrites).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "success",
      context: "auto-develop/reviewer",
      description: "review completed",
    });
  });

  it("変更要求のレビューがあってもステータスは 2 つだけ残る", ({
    changesRequestedStatusWrites,
  }) => {
    expect(changesRequestedStatusWrites).toHaveBeenCalledTimes(2);
  });

  it("変更要求のレビューがあっても最初は pending を書く", ({ changesRequestedStatusWrites }) => {
    expect(changesRequestedStatusWrites).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("変更要求のレビューがあれば最終ステータスは error になる", ({
    changesRequestedStatusWrites,
  }) => {
    expect(changesRequestedStatusWrites).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "error",
      context: "auto-develop/reviewer",
      description: "review completed with changes requested",
    });
  });

  it("実効レビューが無くてもステータスは 2 つだけ残る", ({ noEffectiveReviewStatusWrites }) => {
    expect(noEffectiveReviewStatusWrites).toHaveBeenCalledTimes(2);
  });

  it("実効レビューが無くても最初は pending を書く", ({ noEffectiveReviewStatusWrites }) => {
    expect(noEffectiveReviewStatusWrites).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("実効レビューが無くても最終ステータスは success になる", ({
    noEffectiveReviewStatusWrites,
  }) => {
    expect(noEffectiveReviewStatusWrites).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "success",
      context: "auto-develop/reviewer",
      description: "review completed",
    });
  });

  it("代理ログイン未設定でもステータスは 2 つだけ残る", ({ missingProxyLoginStatusWrites }) => {
    expect(missingProxyLoginStatusWrites).toHaveBeenCalledTimes(2);
  });

  it("代理ログイン未設定でも最初は pending を書く", ({ missingProxyLoginStatusWrites }) => {
    expect(missingProxyLoginStatusWrites).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("代理ログイン未設定なら最終ステータスは failure になる", ({
    missingProxyLoginStatusWrites,
  }) => {
    expect(missingProxyLoginStatusWrites).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "failure",
      context: "auto-develop/reviewer",
      description: "review failed; the reviewer login is unknown",
    });
  });

  it("代理ログイン未設定ならレビュー判定を取りに行かない", ({ missingProxyLoginReviewLookups }) => {
    expect(missingProxyLoginReviewLookups).toHaveBeenCalledTimes(0);
  });
});

describe("createReviewerHandler の dry run", () => {
  const it = test
    .extend("dryRunStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: true,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("dryRunSessions", async () => {
      const sessionRuns = vi.fn<ReviewerHandlerConfig["runSession"]>(() => Promise.resolve());
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: sessionRuns,
        requestFollowUpReview: () => undefined,
        dryRun: true,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return sessionRuns;
    });

  it("dry run はステータスを 1 つも書かない", ({ dryRunStatusWrites }) => {
    expect(dryRunStatusWrites).toHaveBeenCalledTimes(0);
  });

  it("dry run はセッションを起動しない", ({ dryRunSessions }) => {
    expect(dryRunSessions).toHaveBeenCalledTimes(0);
  });
});

describe("createReviewerHandler の入力変更", () => {
  const it = test
    .extend("baseChangedFollowUpRequests", async () => {
      const followUpRequests = vi.fn<ReviewerHandlerConfig["requestFollowUpReview"]>();
      await createReviewerHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            })
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "develop",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: followUpRequests,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return followUpRequests;
    })
    .extend("baseChangedStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            })
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "develop",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("headChangedFollowUpRequests", async () => {
      const followUpRequests = vi.fn<ReviewerHandlerConfig["requestFollowUpReview"]>();
      await createReviewerHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            })
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-2",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.resolve(),
        requestFollowUpReview: followUpRequests,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return followUpRequests;
    })
    .extend("staleBeforeStartStatusWrites", async () => {
      const reviewGate = createLifecycleGate();
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () => {
            reviewGate.interruptForInputChange(7);
            return Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            });
          },
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: reviewGate,
        runSession: () => Promise.resolve(),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("staleBeforeStartSessions", async () => {
      const reviewGate = createLifecycleGate();
      const sessionRuns = vi.fn<ReviewerHandlerConfig["runSession"]>(() => Promise.resolve());
      await createReviewerHandler({
        github: {
          prSnapshot: () => {
            reviewGate.interruptForInputChange(7);
            return Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            });
          },
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: reviewGate,
        runSession: sessionRuns,
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return sessionRuns;
    });

  it("base が変われば後続レビューを base 側で 1 回だけ要求する", ({
    baseChangedFollowUpRequests,
  }) => {
    expect(baseChangedFollowUpRequests).toHaveBeenCalledExactlyOnceWith({
      prNumber: 7,
      endpoint: "base",
    });
  });

  it("base が変われば pending の 1 つだけを残し最終ステータスを書かない", ({
    baseChangedStatusWrites,
  }) => {
    expect(baseChangedStatusWrites).toHaveBeenCalledExactlyOnceWith({
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("head が変われば後続レビューを head 側で 1 回だけ要求する", ({
    headChangedFollowUpRequests,
  }) => {
    expect(headChangedFollowUpRequests).toHaveBeenCalledExactlyOnceWith({
      prNumber: 7,
      endpoint: "head",
    });
  });

  it("スナップショット取得中に世代が変わればステータスを 1 つも書かない", ({
    staleBeforeStartStatusWrites,
  }) => {
    expect(staleBeforeStartStatusWrites).toHaveBeenCalledTimes(0);
  });

  it("スナップショット取得中に世代が変わればエンジンを起動しない", ({
    staleBeforeStartSessions,
  }) => {
    expect(staleBeforeStartSessions).toHaveBeenCalledTimes(0);
  });
});

describe("createReviewerHandler の失敗", () => {
  const it = test
    .extend("sessionFailedStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      try {
        await createReviewerHandler({
          github: {
            prSnapshot: () =>
              Promise.resolve({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "main",
                draft: false,
                requestedReviewerLogins: [],
              }),
            createCommitStatus: statusWrites,
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          gate: createLifecycleGate(),
          runSession: () => Promise.reject(new Error("engine broke")),
          requestFollowUpReview: () => undefined,
          dryRun: false,
          proxyLogin: "review-bot",
          log: silentLogger,
        })(7);
      } catch (reviewRejection) {
        if (!(reviewRejection instanceof Error)) throw reviewRejection;
        return statusWrites;
      }
      throw new Error("the reviewer handler swallowed the session failure");
    })
    .extend("sessionFailedRejection", async () => {
      try {
        await createReviewerHandler({
          github: {
            prSnapshot: () =>
              Promise.resolve({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "main",
                draft: false,
                requestedReviewerLogins: [],
              }),
            createCommitStatus: () => Promise.resolve(),
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          gate: createLifecycleGate(),
          runSession: () => Promise.reject(new Error("engine broke")),
          requestFollowUpReview: () => undefined,
          dryRun: false,
          proxyLogin: "review-bot",
          log: silentLogger,
        })(7);
      } catch (reviewRejection) {
        return reviewRejection;
      }
      throw new Error("the reviewer handler swallowed the session failure");
    })
    .extend("interruptedStatusWrites", async () => {
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.reject(new ReviewInputChangedError(7)),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("interruptedFollowUpRequests", async () => {
      const followUpRequests = vi.fn<ReviewerHandlerConfig["requestFollowUpReview"]>();
      await createReviewerHandler({
        github: {
          prSnapshot: () =>
            Promise.resolve({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.reject(new ReviewInputChangedError(7)),
        requestFollowUpReview: followUpRequests,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return followUpRequests;
    })
    .extend("generationMovedStatusWrites", async () => {
      const reviewGate = createLifecycleGate();
      const statusWrites = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      await createReviewerHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            })
            .mockImplementationOnce(() => {
              reviewGate.interruptForInputChange(7);
              return Promise.resolve({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "main",
                draft: false,
                requestedReviewerLogins: [],
              });
            }),
          createCommitStatus: statusWrites,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: reviewGate,
        runSession: () => Promise.reject(new Error("engine broke")),
        requestFollowUpReview: () => undefined,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return statusWrites;
    })
    .extend("generationMovedReviewRuns", async () => {
      const reviewGate = createLifecycleGate();
      const reviewRuns = vi.fn<(prNumber: number) => Promise<void>>(
        createReviewerHandler({
          github: {
            prSnapshot: vi
              .fn<HandlerGithubClient["prSnapshot"]>()
              .mockResolvedValueOnce({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "main",
                draft: false,
                requestedReviewerLogins: [],
              })
              .mockImplementationOnce(() => {
                reviewGate.interruptForInputChange(7);
                return Promise.resolve({
                  prNumber: 7,
                  title: "title",
                  body: "body",
                  state: "OPEN",
                  headRefName: "topic/x",
                  headRefOid: "sha-1",
                  baseRefName: "main",
                  draft: false,
                  requestedReviewerLogins: [],
                });
              }),
            createCommitStatus: () => Promise.resolve(),
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          gate: reviewGate,
          runSession: () => Promise.reject(new Error("engine broke")),
          requestFollowUpReview: () => undefined,
          dryRun: false,
          proxyLogin: "review-bot",
          log: silentLogger,
        }),
      );
      await reviewRuns(7);
      return reviewRuns;
    })
    .extend("failedAndBaseChangedFollowUpRequests", async () => {
      const followUpRequests = vi.fn<ReviewerHandlerConfig["requestFollowUpReview"]>();
      await createReviewerHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "main",
              draft: false,
              requestedReviewerLogins: [],
            })
            .mockResolvedValueOnce({
              prNumber: 7,
              title: "title",
              body: "body",
              state: "OPEN",
              headRefName: "topic/x",
              headRefOid: "sha-1",
              baseRefName: "develop",
              draft: false,
              requestedReviewerLogins: [],
            }),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        runSession: () => Promise.reject(new Error("engine broke")),
        requestFollowUpReview: followUpRequests,
        dryRun: false,
        proxyLogin: "review-bot",
        log: silentLogger,
      })(7);
      return followUpRequests;
    })
    .extend("failedAndBaseChangedReviewRuns", async () => {
      const reviewRuns = vi.fn<(prNumber: number) => Promise<void>>(
        createReviewerHandler({
          github: {
            prSnapshot: vi
              .fn<HandlerGithubClient["prSnapshot"]>()
              .mockResolvedValueOnce({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "main",
                draft: false,
                requestedReviewerLogins: [],
              })
              .mockResolvedValueOnce({
                prNumber: 7,
                title: "title",
                body: "body",
                state: "OPEN",
                headRefName: "topic/x",
                headRefOid: "sha-1",
                baseRefName: "develop",
                draft: false,
                requestedReviewerLogins: [],
              }),
            createCommitStatus: () => Promise.resolve(),
            listReviews: () => Promise.resolve([]),
            requestReviewers: () => Promise.resolve(),
          },
          gate: createLifecycleGate(),
          runSession: () => Promise.reject(new Error("engine broke")),
          requestFollowUpReview: () => undefined,
          dryRun: false,
          proxyLogin: "review-bot",
          log: silentLogger,
        }),
      );
      await reviewRuns(7);
      return reviewRuns;
    });

  it("セッション失敗はステータスを 2 つ残す", ({ sessionFailedStatusWrites }) => {
    expect(sessionFailedStatusWrites).toHaveBeenCalledTimes(2);
  });

  it("セッション失敗でも最初は pending を書く", ({ sessionFailedStatusWrites }) => {
    expect(sessionFailedStatusWrites).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("セッション失敗は最後に failure を書く", ({ sessionFailedStatusWrites }) => {
    expect(sessionFailedStatusWrites).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "failure",
      context: "auto-develop/reviewer",
      description: "review failed",
    });
  });

  it("セッション失敗の例外はそのまま伝播する", ({ sessionFailedRejection }) => {
    expect(sessionFailedRejection).toStrictEqual(new Error("engine broke"));
  });

  it("入力変更による中断は pending の 1 つを残したまま静かに終わる", ({
    interruptedStatusWrites,
  }) => {
    expect(interruptedStatusWrites).toHaveBeenCalledExactlyOnceWith({
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("入力変更による中断は後続要求もしない", ({ interruptedFollowUpRequests }) => {
    expect(interruptedFollowUpRequests).toHaveBeenCalledTimes(0);
  });

  it("失敗の直後に世代が進んでいたら pending の 1 つだけを残す", ({
    generationMovedStatusWrites,
  }) => {
    expect(generationMovedStatusWrites).toHaveBeenCalledExactlyOnceWith({
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("失敗の直後に世代が進んでいたら例外も伝播しない", ({ generationMovedReviewRuns }) => {
    expect(generationMovedReviewRuns).toHaveResolvedTimes(1);
  });

  it("失敗しつつ base も変わっていたら後続要求だけを 1 回行う", ({
    failedAndBaseChangedFollowUpRequests,
  }) => {
    expect(failedAndBaseChangedFollowUpRequests).toHaveBeenCalledExactlyOnceWith({
      prNumber: 7,
      endpoint: "base",
    });
  });

  it("失敗しつつ base も変わっていたら例外を伝播しない", ({ failedAndBaseChangedReviewRuns }) => {
    expect(failedAndBaseChangedReviewRuns).toHaveResolvedTimes(1);
  });
});
