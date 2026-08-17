import { analyticsConnections, connectedSocialPlatforms, getTopSocialAccount } from "./platforms";

describe("analyticsConnections", () => {
  const user = {
    analytics_last_synced: "2026-08-17T12:00:00Z",
    platform_metrics: {
      instagram: { handle: "@realcreator", followers: 12500, engagement: 4.2, views: 88000, posts: 41 },
      youtube: { handle: "", followers: 0, engagement: 0, views: 0, posts: 0 },
      facebook: { handle: "fb.page", followers: 3200, engagement: 1.1, views: 9000, posts: 12 },
      twitter: { handle: "", followers: 0, engagement: 0, views: 0, posts: 0 },
    },
    oauth_connections: [
      {
        platform: "instagram",
        account_name: "IG OAuth",
        analytics: { followers: 99999, er: 9.9, views: 1, posts: 1 },
      },
    ],
  };

  it("prefers platform_metrics handle and numbers over oauth", () => {
    const rows = analyticsConnections(user);
    const ig = rows.find((r) => r.platform === "instagram");
    const fb = rows.find((r) => r.platform === "facebook");
    expect(ig.handle).toBe("@realcreator");
    expect(ig.account_name).toBe("@realcreator");
    expect(ig.analytics.followers).toBe(12500);
    expect(ig.analytics.er).toBe(4.2);
    expect(ig.analytics.views).toBe(88000);
    expect(fb.analytics.followers).toBe(3200);
    expect(rows.some((r) => r.platform === "youtube")).toBe(false);
  });

  it("keeps zero engagement from metrics instead of blending oauth ER", () => {
    const rows = analyticsConnections({
      platform_metrics: {
        instagram: { handle: "bc.janardhan_reddy_official", followers: 49000, engagement: 0, views: 0, posts: 10 },
      },
      oauth_connections: [
        { platform: "instagram", account_name: "@creator_ig", analytics: { followers: 48960, er: 5.82, views: 0, posts: 5394 } },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].handle).toBe("bc.janardhan_reddy_official");
    expect(rows[0].account_name).toBe("bc.janardhan_reddy_official");
    expect(rows[0].analytics.followers).toBe(49000);
    expect(rows[0].analytics.er).toBe(0);
  });

  it("maps engagement to er for dashboard cards", () => {
    const rows = analyticsConnections({
      platform_metrics: {
        instagram: { handle: "onlymetrics", followers: 99, engagement: 7.5, views: 1, posts: 2 },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].analytics.er).toBe(7.5);
    expect(rows[0].handle).toBe("onlymetrics");
  });
});

describe("connectedSocialPlatforms", () => {
  it("hides platforms that already have metrics handles even without oauth", () => {
    const plats = connectedSocialPlatforms({
      platform_metrics: {
        twitter: { handle: "@creator_demo", followers: 1 },
        youtube: { handle: "@creatordemoYT", followers: 1 },
        facebook: { handle: "", followers: 0 },
        instagram: { handle: "ig", followers: 1 },
      },
      oauth_connections: [{ platform: "Facebook", account_name: "Creator FB Page" }],
    });
    expect(plats.sort()).toEqual(["facebook", "instagram", "twitter", "youtube"].sort());
  });

  it("treats oauth-only links as connected", () => {
    const plats = connectedSocialPlatforms({
      oauth_connections: [{ platform: "twitter", account_name: "@x_only" }],
    });
    expect(plats).toEqual(["twitter"]);
  });
});

describe("getTopSocialAccount", () => {
  it("uses platform_metrics followers", () => {
    const top = getTopSocialAccount({
      platform_metrics: {
        instagram: { handle: "ig", followers: 10 },
        youtube: { handle: "yt", followers: 50 },
      },
    });
    expect(top.followers).toBe(50);
    expect(top.platform).toBe("youtube");
  });
});
