import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Nudge } from "./Nudge";

describe("Nudge", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("plays the local reminder cue when sound is enabled", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    play.mockClear();
    window.history.replaceState(null, "", "/?sound=1#nudge");

    render(<Nudge />);

    expect(play).toHaveBeenCalledOnce();
  });

  it("does not play the cue when sound is disabled", () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    play.mockClear();
    window.history.replaceState(null, "", "/?sound=0#nudge");

    render(<Nudge />);

    expect(play).not.toHaveBeenCalled();
  });
});
