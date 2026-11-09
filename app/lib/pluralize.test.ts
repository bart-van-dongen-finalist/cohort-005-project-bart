import { describe, it, expect } from "vitest";
import { pluralize } from "./pluralize";

describe("pluralize", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, "lesson")).toBe("1 lesson");
  });

  it("uses the plural for zero", () => {
    expect(pluralize(0, "lesson")).toBe("0 lessons");
  });

  it("uses the plural for more than one", () => {
    expect(pluralize(12, "lesson")).toBe("12 lessons");
  });

  it("uses an irregular plural when given one", () => {
    expect(pluralize(1, "quiz", "quizzes")).toBe("1 quiz");
    expect(pluralize(3, "quiz", "quizzes")).toBe("3 quizzes");
    expect(pluralize(2, "category", "categories")).toBe("2 categories");
  });

  it("formats large counts with thousands separators", () => {
    expect(pluralize(1250, "student")).toBe("1,250 students");
  });
});
