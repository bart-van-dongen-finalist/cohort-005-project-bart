import { describe, it, expect } from "vitest";
import {
  getRegionalDiscountLevel,
  getDiscountForCountry,
  calculateRegionalPrice,
  getDiscountLevelInfo,
  checkRegionalDiscountAccess,
} from "./regional-discount";

describe("Regional discount", () => {
  // ─── Discount level mapping ───

  describe("getRegionalDiscountLevel", () => {
    it("returns level 1 for US", () => {
      expect(getRegionalDiscountLevel("US")).toBe(1);
    });

    it("returns level 2 for Poland", () => {
      expect(getRegionalDiscountLevel("PL")).toBe(2);
    });

    it("returns level 3 for India", () => {
      expect(getRegionalDiscountLevel("IN")).toBe(3);
    });

    it("returns level 4 for Nigeria", () => {
      expect(getRegionalDiscountLevel("NG")).toBe(4);
    });

    it("returns level 1 for unmapped countries", () => {
      expect(getRegionalDiscountLevel("XX")).toBe(1);
      expect(getRegionalDiscountLevel("ZZ")).toBe(1);
    });

    it("returns level 1 for null", () => {
      expect(getRegionalDiscountLevel(null)).toBe(1);
    });

    it("is case-insensitive", () => {
      expect(getRegionalDiscountLevel("in")).toBe(3);
      expect(getRegionalDiscountLevel("Us")).toBe(1);
    });
  });

  // ─── Discount ───

  describe("getDiscountForCountry", () => {
    it("returns 0 for level 1 countries", () => {
      expect(getDiscountForCountry("US")).toBe(0);
    });

    it("returns 0.3 for level 2 countries", () => {
      expect(getDiscountForCountry("BR")).toBe(0.3);
    });

    it("returns 0.5 for level 3 countries", () => {
      expect(getDiscountForCountry("IN")).toBe(0.5);
    });

    it("returns 0.7 for level 4 countries", () => {
      expect(getDiscountForCountry("NG")).toBe(0.7);
    });

    it("returns 0 for null country", () => {
      expect(getDiscountForCountry(null)).toBe(0);
    });
  });

  // ─── Price Calculation ───

  describe("calculateRegionalPrice", () => {
    it("returns full price for level 1", () => {
      expect(calculateRegionalPrice(4999, "US")).toBe(4999);
    });

    it("applies 30% discount for level 2", () => {
      expect(calculateRegionalPrice(4999, "BR")).toBe(3499);
    });

    it("applies 50% discount for level 3", () => {
      expect(calculateRegionalPrice(4999, "IN")).toBe(2500);
    });

    it("applies 70% discount for level 4", () => {
      expect(calculateRegionalPrice(4999, "NG")).toBe(1500);
    });

    it("returns 0 for free courses", () => {
      expect(calculateRegionalPrice(0, "IN")).toBe(0);
    });

    it("returns full price for null country", () => {
      expect(calculateRegionalPrice(4999, null)).toBe(4999);
    });
  });

  // ─── Discount level info ───

  describe("getDiscountLevelInfo", () => {
    it("returns level, discount, and label", () => {
      const info = getDiscountLevelInfo("IN");
      expect(info).toEqual({ level: 3, discount: 0.5, label: "50% off" });
    });

    it("returns full price info for null", () => {
      const info = getDiscountLevelInfo(null);
      expect(info).toEqual({ level: 1, discount: 0, label: "Full price" });
    });
  });

  // ─── Regional discount access guard ───

  describe("checkRegionalDiscountAccess", () => {
    // --- Free courses are never blocked ---

    it("allows access to free courses regardless of country", () => {
      const result = checkRegionalDiscountAccess(0, true, "IN", "US");
      expect(result.blocked).toBe(false);
    });

    // --- Courses without a Regional discount are never blocked ---

    it("allows access when the course has no Regional discount", () => {
      const result = checkRegionalDiscountAccess(4999, false, "IN", "US");
      expect(result.blocked).toBe(false);
    });

    // --- No purchase country recorded ---

    it("allows access when purchase country is null", () => {
      const result = checkRegionalDiscountAccess(4999, true, null, "US");
      expect(result.blocked).toBe(false);
    });

    // --- Level 1 (full price) purchases are never blocked ---

    it("allows Level 1 purchase from any country", () => {
      const result = checkRegionalDiscountAccess(4999, true, "US", "IN");
      expect(result.blocked).toBe(false);
    });

    it("allows Level 1 purchase when current country is null", () => {
      const result = checkRegionalDiscountAccess(4999, true, "US", null);
      expect(result.blocked).toBe(false);
    });

    // --- Discounted purchase — matching country ---

    it("allows Level 2 purchase when country matches", () => {
      const result = checkRegionalDiscountAccess(4999, true, "PL", "PL");
      expect(result.blocked).toBe(false);
    });

    it("allows Level 3 purchase when country matches", () => {
      const result = checkRegionalDiscountAccess(4999, true, "IN", "IN");
      expect(result.blocked).toBe(false);
    });

    it("allows Level 4 purchase when country matches", () => {
      const result = checkRegionalDiscountAccess(4999, true, "NG", "NG");
      expect(result.blocked).toBe(false);
    });

    // --- Discounted purchase — mismatching country ---

    it("blocks Level 2 purchase when accessed from different country", () => {
      const result = checkRegionalDiscountAccess(4999, true, "PL", "DE");
      expect(result.blocked).toBe(true);
      expect(result.blockedCountry).toBe("DE");
      expect(result.purchaseCountry).toBe("PL");
    });

    it("blocks Level 3 purchase when accessed from different country", () => {
      const result = checkRegionalDiscountAccess(4999, true, "IN", "US");
      expect(result.blocked).toBe(true);
      expect(result.blockedCountry).toBe("US");
      expect(result.purchaseCountry).toBe("IN");
    });

    it("blocks Level 4 purchase when accessed from different country", () => {
      const result = checkRegionalDiscountAccess(4999, true, "NG", "GB");
      expect(result.blocked).toBe(true);
      expect(result.blockedCountry).toBe("GB");
      expect(result.purchaseCountry).toBe("NG");
    });

    // --- Discounted purchase — current country unknown ---

    it("allows discounted purchase when current country is null", () => {
      const result = checkRegionalDiscountAccess(4999, true, "IN", null);
      expect(result.blocked).toBe(false);
    });

    // --- Return value shape ---

    it("returns null fields when not blocked", () => {
      const result = checkRegionalDiscountAccess(4999, true, "US", "IN");
      expect(result).toEqual({
        blocked: false,
        blockedCountry: null,
        purchaseCountry: null,
      });
    });

    it("returns country details when blocked", () => {
      const result = checkRegionalDiscountAccess(4999, true, "IN", "US");
      expect(result).toEqual({
        blocked: true,
        blockedCountry: "US",
        purchaseCountry: "IN",
      });
    });
  });
});
