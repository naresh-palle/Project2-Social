import {
  formatCompactNumber,
  formatEngagementRate,
  displayMetric,
  creatorOverviewFromSources,
} from "./socialAnalytics";

describe("formatCompactNumber", () => {
  it("formats K/M professionally", () => {
    expect(formatCompactNumber(1250)).toBe("1.25K");
    expect(formatCompactNumber(12500)).toBe("12.5K");
    expect(formatCompactNumber(125000)).toBe("125K");
    expect(formatCompactNumber(1250000)).toBe("1.25M");
  });
});

describe("formatEngagementRate", () => {
  it("shows percent not fraction", () => {
    expect(formatEngagementRate(7.65)).toBe("7.65%");
    expect(formatEngagementRate(null)).toBe("N/A");
  });
});

describe("displayMetric", () => {
  it("uses N/A for missing", () => {
    expect(displayMetric(null)).toBe("N/A");
    expect(displayMetric(undefined)).toBe("N/A");
  });
});

describe("creatorOverviewFromSources", () => {
  it("prefers server social payload and does not treat missing reach as views", () => {
    const overview = creatorOverviewFromSources({
      stats: {
        social: {
          followers: 1000,
          views: 50000,
          reach: null,
          engagementRate: 4.2,
          engagementRateBasis: "followers",
        },
      },
    });
    expect(overview.views).toBe(50000);
    expect(overview.reach).toBeNull();
    expect(overview.engagementRate).toBe(4.2);
  });

  it("ignores zero IG/FB views as totals when building client fallback", () => {
    const overview = creatorOverviewFromSources({
      user: {
        platform_metrics: {
          instagram: { handle: "a", followers: 100, views: 0, engagement: 3.1, posts: 5 },
          youtube: { handle: "b", followers: 200, views: 9000, engagement: 2, posts: 10 },
        },
      },
    });
    expect(overview.views).toBe(9000);
    expect(overview.followers).toBe(300);
  });
});
