import { formatUserLocation } from "./location";

describe("formatUserLocation", () => {
  it("joins city and state", () => {
    expect(formatUserLocation({ city: "Hyderabad", state: "Telangana" })).toBe("Hyderabad, Telangana");
  });

  it("uses location when city/state missing", () => {
    expect(formatUserLocation({ location: "Mumbai, Maharashtra" })).toBe("Mumbai, Maharashtra");
  });

  it("returns empty string when nothing set", () => {
    expect(formatUserLocation({})).toBe("");
    expect(formatUserLocation(null)).toBe("");
  });

  it("avoids duplicating identical city/state", () => {
    expect(formatUserLocation({ city: "Delhi", state: "Delhi" })).toBe("Delhi");
  });
});
