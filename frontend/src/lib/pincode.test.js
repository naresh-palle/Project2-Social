import { resolveFromPostOffices, PINCODE_OVERRIDES } from "./pincode";

const SAMPLE_502103 = [
  {
    Name: "Ambedkarnagar",
    BranchType: "Branch Office directly a/w Head Office",
    District: "Medak",
    Block: "Siddipet",
    State: "Telangana",
    Pincode: "502103",
  },
  {
    Name: "Siddipet",
    BranchType: "Head Post Office",
    District: "Medak",
    Block: "Siddipet",
    State: "Telangana",
    Pincode: "502103",
  },
];

describe("pincode resolution", () => {
  it("maps 502103 to Siddipet, not Medak", () => {
    const resolved = resolveFromPostOffices(SAMPLE_502103, "502103");
    expect(resolved.city).toBe("Siddipet");
    expect(resolved.state).toBe("Telangana");
    expect(resolved.city.toLowerCase()).not.toBe("medak");
  });

  it("keeps an override entry for 502103", () => {
    expect(PINCODE_OVERRIDES["502103"].city).toBe("Siddipet");
  });

  it("prefers Block when District is outdated", () => {
    const resolved = resolveFromPostOffices(
      [
        {
          Name: "Some Colony",
          BranchType: "Sub Post Office",
          District: "Medak",
          Block: "Siddipet",
          State: "Telangana",
          Pincode: "502103",
        },
      ],
      "502103"
    );
    expect(resolved.city).toBe("Siddipet");
  });
});
