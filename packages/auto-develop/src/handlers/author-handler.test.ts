import { attemptAsync } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createAuthorHandler, type AuthorHandlerConfig } from "./author-handler.ts";

import type { HandlerGithubClient, PrSnapshot } from "./github-client.ts";

describe("createAuthorHandler が最後まで走り切ったとき", () => {
  const it = test
    .extend("cleanRunCommitStatus", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: () => Promise.resolve(openPr),
          createCommitStatus,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      await takenHandler({ prNumber: 7, reason: "request_changes" });
      return createCommitStatus;
    })
    .extend("cleanRunReviewerRequest", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const requestReviewers = vi.fn<HandlerGithubClient["requestReviewers"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: () => Promise.resolve(openPr),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers,
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      await takenHandler({ prNumber: 7, reason: "request_changes" });
      return requestReviewers;
    });

  it("最初のコミットステータスは実行前の head への pending である", ({ cleanRunCommitStatus }) => {
    expect(cleanRunCommitStatus).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/author",
      description: "addressing feedback",
    });
  });

  it("二番目のコミットステータスは実行後の head への success である", ({
    cleanRunCommitStatus,
  }) => {
    expect(cleanRunCommitStatus).toHaveBeenNthCalledWith(2, {
      sha: "sha-1",
      state: "success",
      context: "auto-develop/author",
      description: "the author response completed",
    });
  });

  it("コミットステータスは 2 回だけ書かれる", ({ cleanRunCommitStatus }) => {
    expect(cleanRunCommitStatus).toHaveBeenCalledTimes(2);
  });

  it("レビュー担当への再依頼はちょうど 1 回である", ({ cleanRunReviewerRequest }) => {
    expect(cleanRunReviewerRequest).toHaveBeenCalledExactlyOnceWith({
      prNumber: 7,
      logins: ["review-bot"],
    });
  });
});

describe("createAuthorHandler の実行中に head が進んだとき", () => {
  const it = test.extend("headAdvancedCommitStatus", async () => {
    const openPr: PrSnapshot = {
      prNumber: 7,
      title: "title",
      body: "body",
      state: "OPEN",
      headRefName: "topic/x",
      headRefOid: "sha-1",
      baseRefName: "main",
      draft: false,
      requestedReviewerLogins: [],
    };
    const advancedPr: PrSnapshot = {
      prNumber: 7,
      title: "title",
      body: "body",
      state: "OPEN",
      headRefName: "topic/x",
      headRefOid: "sha-2",
      baseRefName: "main",
      draft: false,
      requestedReviewerLogins: [],
    };
    const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
      Promise.resolve(),
    );
    const takenHandler = createAuthorHandler({
      github: {
        prSnapshot: vi
          .fn<HandlerGithubClient["prSnapshot"]>()
          .mockResolvedValueOnce(openPr)
          .mockResolvedValueOnce(advancedPr),
        createCommitStatus,
        listReviews: () => Promise.resolve([]),
        requestReviewers: () => Promise.resolve(),
      },
      runSession: () => Promise.resolve(),
      reviewerLogin: "review-bot",
      dryRun: false,
      log: silentLogger,
    });
    await takenHandler({ prNumber: 7, reason: "request_changes" });
    return createCommitStatus;
  });

  it("pending は実行前の head に付く", ({ headAdvancedCommitStatus }) => {
    expect(headAdvancedCommitStatus).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/author",
      description: "addressing feedback",
    });
  });

  it("success は実行後の head に付く", ({ headAdvancedCommitStatus }) => {
    expect(headAdvancedCommitStatus).toHaveBeenNthCalledWith(2, {
      sha: "sha-2",
      state: "success",
      context: "auto-develop/author",
      description: "the author response completed",
    });
  });

  it("head が進んでもコミットステータスは 2 回だけ書かれる", ({ headAdvancedCommitStatus }) => {
    expect(headAdvancedCommitStatus).toHaveBeenCalledTimes(2);
  });
});

describe("createAuthorHandler が受け取ったイベント種別", () => {
  const it = test.extend("ciFailureSession", async () => {
    const openPr: PrSnapshot = {
      prNumber: 7,
      title: "title",
      body: "body",
      state: "OPEN",
      headRefName: "topic/x",
      headRefOid: "sha-1",
      baseRefName: "main",
      draft: false,
      requestedReviewerLogins: [],
    };
    const runSession = vi.fn<AuthorHandlerConfig["runSession"]>(() => Promise.resolve());
    const takenHandler = createAuthorHandler({
      github: {
        prSnapshot: () => Promise.resolve(openPr),
        createCommitStatus: () => Promise.resolve(),
        listReviews: () => Promise.resolve([]),
        requestReviewers: () => Promise.resolve(),
      },
      runSession,
      reviewerLogin: "review-bot",
      dryRun: false,
      log: silentLogger,
    });
    await takenHandler({ prNumber: 7, reason: "ci_failure" });
    return runSession;
  });

  it("イベント種別は理由としてセッションへちょうど 1 回渡る", ({ ciFailureSession }) => {
    expect(ciFailureSession).toHaveBeenCalledExactlyOnceWith({
      prNumber: 7,
      headBranch: "topic/x",
      reason: "ci_failure",
    });
  });
});

describe("createAuthorHandler の dry run", () => {
  const it = test
    .extend("dryRunCommitStatus", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: () => Promise.resolve(openPr),
          createCommitStatus,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: true,
        log: silentLogger,
      });
      await takenHandler({ prNumber: 7, reason: "request_changes" });
      return createCommitStatus;
    })
    .extend("dryRunReviewerRequest", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const requestReviewers = vi.fn<HandlerGithubClient["requestReviewers"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: () => Promise.resolve(openPr),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers,
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: true,
        log: silentLogger,
      });
      await takenHandler({ prNumber: 7, reason: "request_changes" });
      return requestReviewers;
    });

  it("dry run はコミットステータスを書かない", ({ dryRunCommitStatus }) => {
    expect(dryRunCommitStatus).not.toHaveBeenCalled();
  });

  it("dry run はレビュー担当へ再依頼しない", ({ dryRunReviewerRequest }) => {
    expect(dryRunReviewerRequest).not.toHaveBeenCalled();
  });
});

describe("createAuthorHandler のセッションが失敗したとき", () => {
  const it = test
    .extend("sessionFailedCommitStatus", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const advancedPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-2",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce(openPr)
            .mockResolvedValueOnce(advancedPr),
          createCommitStatus,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        runSession: () => Promise.reject(new Error("engine broke")),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      const [sessionFailure] = await attemptAsync(() =>
        takenHandler({ prNumber: 7, reason: "request_changes" }),
      );
      if (sessionFailure === null) throw new Error("the author handler settled without rejecting");
      return createCommitStatus;
    })
    .extend("sessionFailedReviewerRequest", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const advancedPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-2",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const requestReviewers = vi.fn<HandlerGithubClient["requestReviewers"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce(openPr)
            .mockResolvedValueOnce(advancedPr),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers,
        },
        runSession: () => Promise.reject(new Error("engine broke")),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      const [sessionFailure] = await attemptAsync(() =>
        takenHandler({ prNumber: 7, reason: "request_changes" }),
      );
      if (sessionFailure === null) throw new Error("the author handler settled without rejecting");
      return requestReviewers;
    })
    .extend("sessionFailureSurfaced", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const advancedPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-2",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce(openPr)
            .mockResolvedValueOnce(advancedPr),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.resolve(),
        },
        runSession: () => Promise.reject(new Error("engine broke")),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      const [sessionFailure] = await attemptAsync(() =>
        takenHandler({ prNumber: 7, reason: "request_changes" }),
      );
      return sessionFailure;
    });

  it("セッション失敗でも pending は実行前の head に付く", ({ sessionFailedCommitStatus }) => {
    expect(sessionFailedCommitStatus).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/author",
      description: "addressing feedback",
    });
  });

  it("セッション失敗は実行後の head へ failure を書く", ({ sessionFailedCommitStatus }) => {
    expect(sessionFailedCommitStatus).toHaveBeenNthCalledWith(2, {
      sha: "sha-2",
      state: "failure",
      context: "auto-develop/author",
      description: "the author response failed",
    });
  });

  it("セッション失敗ではコミットステータスは 2 回だけ書かれる", ({ sessionFailedCommitStatus }) => {
    expect(sessionFailedCommitStatus).toHaveBeenCalledTimes(2);
  });

  it("セッション失敗ではレビュー担当へ再依頼しない", ({ sessionFailedReviewerRequest }) => {
    expect(sessionFailedReviewerRequest).not.toHaveBeenCalled();
  });

  it("セッション失敗の例外は呼び出し元へ伝播する", ({ sessionFailureSurfaced }) => {
    expect(sessionFailureSurfaced).toStrictEqual(new Error("engine broke"));
  });
});

describe("createAuthorHandler の再依頼が失敗したとき", () => {
  const it = test
    .extend("rerequestFailedCommitStatus", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const advancedPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-2",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const createCommitStatus = vi.fn<HandlerGithubClient["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce(openPr)
            .mockResolvedValueOnce(advancedPr),
          createCommitStatus,
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.reject(new Error("GitHub refused")),
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      const [rerequestFailure] = await attemptAsync(() =>
        takenHandler({ prNumber: 7, reason: "request_changes" }),
      );
      if (rerequestFailure === null)
        throw new Error("the author handler settled without rejecting");
      return createCommitStatus;
    })
    .extend("rerequestFailureSurfaced", async () => {
      const openPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-1",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const advancedPr: PrSnapshot = {
        prNumber: 7,
        title: "title",
        body: "body",
        state: "OPEN",
        headRefName: "topic/x",
        headRefOid: "sha-2",
        baseRefName: "main",
        draft: false,
        requestedReviewerLogins: [],
      };
      const takenHandler = createAuthorHandler({
        github: {
          prSnapshot: vi
            .fn<HandlerGithubClient["prSnapshot"]>()
            .mockResolvedValueOnce(openPr)
            .mockResolvedValueOnce(advancedPr),
          createCommitStatus: () => Promise.resolve(),
          listReviews: () => Promise.resolve([]),
          requestReviewers: () => Promise.reject(new Error("GitHub refused")),
        },
        runSession: () => Promise.resolve(),
        reviewerLogin: "review-bot",
        dryRun: false,
        log: silentLogger,
      });
      const [rerequestFailure] = await attemptAsync(() =>
        takenHandler({ prNumber: 7, reason: "request_changes" }),
      );
      return rerequestFailure;
    });

  it("再依頼失敗でも pending は実行前の head に付く", ({ rerequestFailedCommitStatus }) => {
    expect(rerequestFailedCommitStatus).toHaveBeenNthCalledWith(1, {
      sha: "sha-1",
      state: "pending",
      context: "auto-develop/author",
      description: "addressing feedback",
    });
  });

  it("再依頼失敗でも success は実行後の head に付く", ({ rerequestFailedCommitStatus }) => {
    expect(rerequestFailedCommitStatus).toHaveBeenNthCalledWith(2, {
      sha: "sha-2",
      state: "success",
      context: "auto-develop/author",
      description: "the author response completed",
    });
  });

  it("再依頼失敗は実行後の head へ failure を追記する", ({ rerequestFailedCommitStatus }) => {
    expect(rerequestFailedCommitStatus).toHaveBeenNthCalledWith(3, {
      sha: "sha-2",
      state: "failure",
      context: "auto-develop/author",
      description: "re-requesting the reviewer failed",
    });
  });

  it("再依頼失敗ではコミットステータスは 3 回書かれる", ({ rerequestFailedCommitStatus }) => {
    expect(rerequestFailedCommitStatus).toHaveBeenCalledTimes(3);
  });

  it("再依頼失敗の例外は呼び出し元へ伝播する", ({ rerequestFailureSurfaced }) => {
    expect(rerequestFailureSurfaced).toStrictEqual(new Error("GitHub refused"));
  });
});
