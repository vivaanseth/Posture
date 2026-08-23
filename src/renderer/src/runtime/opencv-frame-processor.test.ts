import { describe, expect, it } from "vitest";
import { fitFrameSize, OPENCV_FRAME_LIMIT } from "./opencv-frame-processor";

describe("fitFrameSize", () => {
  it("keeps frames that already fit within the processing limit", () => {
    expect(fitFrameSize(320, 240)).toEqual({ width: 320, height: 240 });
    expect(fitFrameSize(512, 384)).toEqual(OPENCV_FRAME_LIMIT);
  });

  it("shrinks large frames without changing their aspect ratio", () => {
    expect(fitFrameSize(1920, 1080)).toEqual({ width: 512, height: 288 });
    expect(fitFrameSize(1280, 960)).toEqual({ width: 512, height: 384 });
    expect(fitFrameSize(720, 1280)).toEqual({ width: 216, height: 384 });
  });

  it("rejects empty or invalid frame dimensions", () => {
    expect(() => fitFrameSize(0, 480)).toThrow(/positive numbers/i);
    expect(() => fitFrameSize(Number.NaN, 480)).toThrow(/positive numbers/i);
    expect(() => fitFrameSize(640, Number.POSITIVE_INFINITY)).toThrow(
      /positive numbers/i,
    );
  });
});
