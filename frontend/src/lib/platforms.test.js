import { analyticsConnections, getTopSocialAccount } from "./platforms";

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
        analytics: { followers: 0, er: 0, views: 0, posts: 0 },
      },
    ],
  };

  it("prefers platform_metrics over empty oauth analytics", () => {
    const rows = analyticsConnections(user);
    const ig = rows.find((r) => r.platform === "instagram");
    const fb = rows.find((r) => r.platform === "facebook");
    expect(ig.analytics.followers).toBe(12500);
    expect(ig.analytics.er).toBe(4.2);
    expect(ig.analytics.views).toBe(88000);
    expect(ig.account_name).toBe("IG OAuth");
    expect(fb.analytics.followers).toBe(3200);
    expect(rows.some((r) => r.platform === "youtube")).toBe(false);
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
