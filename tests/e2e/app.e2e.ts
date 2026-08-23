import { _electron as electron, expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const launch = async (
  userData: string,
  environment: Record<string, string> = {},
) => {
  const linuxTestArgs =
    process.platform === "linux"
      ? ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
      : [];
  return electron.launch({
    args: [
      ...linuxTestArgs,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--user-data-dir=${userData}`,
      ".",
    ],
    env: { ...process.env, NODE_ENV: "test", ...environment },
  });
};

const openCameraStep = async (window: Page): Promise<void> => {
  await window.getByRole("button", { name: "Continue" }).click();
  await expect(
    window.getByRole("heading", {
      name: /Camera stays local\.\s*Your posture stays yours\./,
    }),
  ).toBeVisible();
};

test("launches the secure onboarding flow", async () => {
  test.setTimeout(90_000);
  const userData = await mkdtemp(join(tmpdir(), "posture-e2e-"));
  const app = await launch(userData);

  try {
    const window = await app.firstWindow();
    await expect(
      window.getByRole("heading", {
        name: /Notice the drift\.\s*Not every movement\./,
      }),
    ).toBeVisible();
    await expect(
      window.getByText(/does not react to every small movement/i),
    ).toBeVisible();
    await window.getByRole("button", { name: "Continue" }).click();
    await expect(
      window.getByRole("heading", {
        name: /Camera stays local\.\s*Your posture stays yours\./,
      }),
    ).toBeVisible();
    await expect(
      window.getByText(/no account, no cloud upload, and no saved video/i),
    ).toBeVisible();
    await expect(window.locator("video")).toBeVisible();
    await expect(window.locator("select option")).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(
      window.getByRole("button", { name: "Continue" }),
    ).toBeEnabled();
    await window.getByRole("button", { name: "Continue" }).click();
    await expect(
      window.getByRole("heading", {
        name: /Sit the way\s*you want to return to\./,
      }),
    ).toBeVisible();
    try {
      await expect
        .poll(
          async () =>
            Number(
              await window
                .getByRole("progressbar")
                .getAttribute("aria-valuenow"),
            ),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
    } catch (error) {
      console.error(
        "Renderer state at inference timeout:",
        await window.locator("body").innerText(),
      );
      throw error;
    }
    await expect(
      window.getByRole("heading", { name: "Calibration complete" }),
    ).toBeVisible({ timeout: 20_000 });
    const nudgeWindowPromise = app.waitForEvent("window");
    await window.getByRole("button", { name: "Test reminder" }).click();
    const nudge = await nudgeWindowPromise;
    await expect(nudge.getByText("Take a moment to reset")).toBeVisible();
    const dismissReminder = nudge.getByRole("button", {
      name: "Dismiss reminder",
    });
    await expect(dismissReminder).toBeVisible();
    await dismissReminder.dispatchEvent("click");
    await expect.poll(() => nudge.isClosed()).toBe(true);
    await window.getByRole("button", { name: /start tracking/i }).click();
    await expect(
      window.getByRole("heading", { name: "Good posture" }),
    ).toBeVisible();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await window.getByRole("button", { name: "Pause" }).click();
      await expect(
        window.getByRole("heading", { name: "Tracking paused" }),
      ).toBeVisible();
      await window.getByRole("button", { name: "Start" }).click();
      await expect(
        window.getByRole("heading", { name: "Good posture" }),
      ).toBeVisible({ timeout: 30_000 });
    }
    await window.getByRole("button", { name: "History" }).click();
    await expect(
      window.getByRole("heading", {
        name: /Your posture,\s*over time\./,
      }),
    ).toBeVisible();
    await window.getByRole("button", { name: "Camera" }).click();
    await expect(
      window.getByRole("heading", { name: /Check your\s*framing\./ }),
    ).toBeVisible();
    await window.getByRole("button", { name: "Settings" }).click();
    await expect(
      window.getByRole("heading", { name: /Make Upright\s*fit your day\./ }),
    ).toBeVisible();
    await window.getByRole("button", { name: "Reset all local data" }).click();
    await expect(
      window.getByRole("dialog", { name: /reset all local data/i }),
    ).toBeVisible();
    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(window.locator("body")).not.toContainText("undefined");
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("loads the real bundled MediaPipe runtime with a fake camera", async () => {
  test.setTimeout(60_000);
  const userData = await mkdtemp(join(tmpdir(), "upright-e2e-mediapipe-"));
  const app = await launch(userData, { UPRIGHT_TEST_MEDIAPIPE: "true" });

  try {
    const window = await app.firstWindow();
    await openCameraStep(window);
    await expect(
      window.getByText("Camera and local posture model are ready."),
    ).toBeVisible({ timeout: 30_000 });
    await window.getByRole("button", { name: "Continue" }).click();
    await expect
      .poll(
        async () =>
          Number(
            await window.getByRole("progressbar").getAttribute("aria-valuenow"),
          ),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("shows permission recovery when camera access is denied", async () => {
  const userData = await mkdtemp(join(tmpdir(), "posture-e2e-denied-"));
  const app = await launch(userData, { UPRIGHT_TEST_CAMERA_STATUS: "denied" });

  try {
    const window = await app.firstWindow();
    await openCameraStep(window);
    await expect(window.getByRole("alert")).toContainText(
      /camera access is off/i,
    );
    await expect(
      window.getByRole("button", { name: "Try camera again" }),
    ).toBeVisible();
    await expect(window.locator("video")).toHaveCount(0);
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("recovers from a stale saved camera identifier", async () => {
  const userData = await mkdtemp(join(tmpdir(), "posture-e2e-stale-"));
  await writeFile(
    join(userData, "settings.json"),
    JSON.stringify({
      schemaVersion: 1,
      selectedCameraId: "camera-that-no-longer-exists",
      sensitivity: "balanced",
      reminderDelaySeconds: 30,
      cooldownMinutes: 10,
      soundEnabled: false,
      launchAtLogin: false,
      autoStartTracking: false,
      reduceOnBattery: true,
      theme: "system",
      onboardingComplete: false,
      diagnosticsEnabled: false,
    }),
  );
  const app = await launch(userData);

  try {
    const window = await app.firstWindow();
    await openCameraStep(window);
    await expect(window.locator("video")).toBeVisible();
    await expect(window.locator("select option")).toHaveCount(2, {
      timeout: 15_000,
    });
    await expect(window.locator("select")).not.toHaveValue(
      "camera-that-no-longer-exists",
    );
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});

test("preserves legacy profile settings while presenting Upright branding", async () => {
  const userData = await mkdtemp(join(tmpdir(), "posture-e2e-upgrade-"));
  await writeFile(
    join(userData, "settings.json"),
    JSON.stringify({
      schemaVersion: 1,
      selectedCameraId: null,
      sensitivity: "high",
      reminderDelaySeconds: 60,
      cooldownMinutes: 20,
      soundEnabled: true,
      launchAtLogin: false,
      autoStartTracking: false,
      reduceOnBattery: true,
      theme: "dark",
      onboardingComplete: true,
      diagnosticsEnabled: false,
    }),
  );
  const app = await launch(userData);

  try {
    const window = await app.firstWindow();
    await expect(
      window.getByRole("heading", { name: "Tracking paused" }),
    ).toBeVisible();
    await expect(window.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(window).toHaveTitle("Upright");
    await expect(
      window.getByText("This camera needs calibration"),
    ).toBeVisible();
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});
