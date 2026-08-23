/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  POSE_WORKER_PROTOCOL_VERSION,
  parsePoseWorkerRequest,
  type PoseWorkerRequest,
  type PoseWorkerResponse,
} from "../../../shared/worker-protocol";
import { OpenCvFrameProcessor } from "../runtime/opencv-frame-processor";

let landmarker: PoseLandmarker | null = null;
let frameProcessor: OpenCvFrameProcessor | null = null;
let deterministicFixture = false;

const fixtureLandmarks = (): Array<{
  x: number;
  y: number;
  z: number;
  visibility: number;
}> => {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  landmarks[0] = { x: 0.5, y: 0.28, z: -0.03, visibility: 1 };
  landmarks[7] = { x: 0.43, y: 0.32, z: -0.02, visibility: 1 };
  landmarks[8] = { x: 0.57, y: 0.32, z: -0.02, visibility: 1 };
  landmarks[11] = { x: 0.35, y: 0.5, z: 0, visibility: 1 };
  landmarks[12] = { x: 0.65, y: 0.5, z: 0, visibility: 1 };
  landmarks[23] = { x: 0.42, y: 0.78, z: 0.01, visibility: 1 };
  landmarks[24] = { x: 0.58, y: 0.78, z: 0.01, visibility: 1 };
  return landmarks;
};

const send = (message: PoseWorkerResponse): void => self.postMessage(message);
const messageFor = (error: unknown): string =>
  error instanceof Error ? error.message : "Pose tracking could not continue.";

const disposePipeline = (): void => {
  landmarker?.close();
  landmarker = null;
  frameProcessor?.dispose();
  frameProcessor = null;
};

self.onmessage = async (event: MessageEvent<unknown>) => {
  let request: PoseWorkerRequest;
  try {
    request = parsePoseWorkerRequest(event.data);
  } catch {
    return;
  }

  if (request.type === "initialize") {
    try {
      deterministicFixture =
        __UPRIGHT_E2E_FIXTURE__ && request.fixture === "deterministic";
      disposePipeline();
      try {
        frameProcessor = await OpenCvFrameProcessor.create();
      } catch (error) {
        throw new Error(
          `OpenCV frame preprocessing could not initialize: ${messageFor(error)}`,
        );
      }
      if (deterministicFixture) {
        send({
          protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          type: "ready",
        });
        return;
      }
      const wasmRoot = new URL("./wasm/", self.location.origin).toString();
      const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: new URL(
            "./models/pose_landmarker_lite.task",
            self.location.origin,
          ).toString(),
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "ready",
      });
    } catch (error) {
      disposePipeline();
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "fatal-error",
        message: messageFor(error),
      });
    }
    return;
  }

  if (request.type === "dispose") {
    disposePipeline();
    send({
      protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      type: "disposed",
    });
    return;
  }

  try {
    if (!frameProcessor) {
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "recoverable-error",
        message: "OpenCV frame preprocessing is not ready.",
      });
      return;
    }
    if (!deterministicFixture && !landmarker) {
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "recoverable-error",
        message: "The pose model is not ready.",
      });
      return;
    }

    const pipelineStarted = performance.now();
    let processedFrame: OffscreenCanvas;
    try {
      processedFrame = frameProcessor.process(request.bitmap);
    } catch (error) {
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "recoverable-error",
        message: `OpenCV could not preprocess this camera frame: ${messageFor(error)}`,
      });
      return;
    }

    if (deterministicFixture) {
      send({
        protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        type: "result",
        landmarks: fixtureLandmarks(),
        timestamp: request.timestamp,
        inferenceMs: performance.now() - pipelineStarted,
      });
      return;
    }
    let result: ReturnType<PoseLandmarker["detectForVideo"]>;
    try {
      result = landmarker!.detectForVideo(processedFrame, request.timestamp);
    } catch (error) {
      throw new Error(
        `MediaPipe could not process the preprocessed camera frame: ${messageFor(error)}`,
      );
    }
    send({
      protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      type: "result",
      landmarks:
        result.landmarks[0]?.map((entry) => ({
          x: entry.x,
          y: entry.y,
          z: entry.z,
          visibility: entry.visibility,
        })) ?? null,
      timestamp: request.timestamp,
      inferenceMs: performance.now() - pipelineStarted,
    });
  } catch (error) {
    send({
      protocolVersion: POSE_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      type: "recoverable-error",
      message: messageFor(error),
    });
  } finally {
    request.bitmap.close();
  }
};

export {};
