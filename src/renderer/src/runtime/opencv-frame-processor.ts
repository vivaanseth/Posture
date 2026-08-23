import { loadOpenCV, type OpenCV } from "@opencvjs/worker";

export const OPENCV_FRAME_LIMIT = Object.freeze({
  width: 512,
  height: 384,
});

export interface FrameSize {
  width: number;
  height: number;
}

export function fitFrameSize(
  width: number,
  height: number,
  limit: FrameSize = OPENCV_FRAME_LIMIT,
): FrameSize {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(limit.width) ||
    !Number.isFinite(limit.height) ||
    width <= 0 ||
    height <= 0 ||
    limit.width <= 0 ||
    limit.height <= 0
  )
    throw new RangeError("Camera frame dimensions must be positive numbers.");

  const scale = Math.min(1, limit.width / width, limit.height / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type OpenCvApi = typeof OpenCV;

export class OpenCvFrameProcessor {
  private readonly inputCanvas = new OffscreenCanvas(1, 1);
  private readonly outputCanvas = new OffscreenCanvas(1, 1);
  private readonly inputContext: OffscreenCanvasRenderingContext2D;
  private readonly outputContext: OffscreenCanvasRenderingContext2D;
  private inputMat: OpenCV.Mat | null = null;
  private outputMat: OpenCV.Mat | null = null;
  private outputImageData: ImageData | null = null;
  private sourceSize: FrameSize = { width: 0, height: 0 };
  private targetSize: FrameSize = { width: 0, height: 0 };
  private disposed = false;

  private constructor(private readonly cv: OpenCvApi) {
    const inputContext = this.inputCanvas.getContext("2d", { alpha: false });
    const outputContext = this.outputCanvas.getContext("2d", {
      alpha: false,
    });
    if (!inputContext || !outputContext)
      throw new Error("OpenCV could not create a frame-processing canvas.");
    this.inputContext = inputContext;
    this.outputContext = outputContext;
  }

  static async create(): Promise<OpenCvFrameProcessor> {
    const cv = await loadOpenCV();
    if (!cv?.Mat || typeof cv.resize !== "function")
      throw new Error("The OpenCV runtime did not expose its image API.");
    return new OpenCvFrameProcessor(cv);
  }

  process(bitmap: ImageBitmap): OffscreenCanvas {
    if (this.disposed)
      throw new Error("OpenCV frame preprocessing has already stopped.");
    if (
      !Number.isFinite(bitmap.width) ||
      !Number.isFinite(bitmap.height) ||
      bitmap.width <= 0 ||
      bitmap.height <= 0
    )
      throw new Error("The camera returned an empty frame.");

    const target = fitFrameSize(bitmap.width, bitmap.height);
    this.ensureBuffers(bitmap.width, bitmap.height, target);
    this.inputContext.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    const sourcePixels = this.inputContext.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    );
    const inputMat = this.inputMat;
    const outputImageData = this.outputImageData;
    if (!inputMat || !outputImageData)
      throw new Error("OpenCV frame buffers are unavailable.");

    inputMat.data.set(sourcePixels.data);
    const resized =
      bitmap.width !== target.width || bitmap.height !== target.height;
    if (resized) {
      const outputMat = this.outputMat;
      if (!outputMat) throw new Error("OpenCV resize output is unavailable.");
      this.cv.resize(
        inputMat,
        outputMat,
        new this.cv.Size(target.width, target.height),
        0,
        0,
        this.cv.INTER_AREA,
      );
    }

    const processed = resized ? this.outputMat : inputMat;
    if (
      !processed ||
      processed.empty() ||
      processed.cols !== target.width ||
      processed.rows !== target.height ||
      processed.data.length !== outputImageData.data.length
    )
      throw new Error("OpenCV produced an unusable camera frame.");

    outputImageData.data.set(processed.data);
    this.outputContext.putImageData(outputImageData, 0, 0);
    return this.outputCanvas;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseMats();
    this.outputImageData = null;
  }

  private ensureBuffers(
    sourceWidth: number,
    sourceHeight: number,
    target: FrameSize,
  ): void {
    if (
      this.sourceSize.width === sourceWidth &&
      this.sourceSize.height === sourceHeight &&
      this.targetSize.width === target.width &&
      this.targetSize.height === target.height &&
      this.inputMat &&
      this.outputImageData
    )
      return;

    this.releaseMats();
    this.inputCanvas.width = sourceWidth;
    this.inputCanvas.height = sourceHeight;
    this.outputCanvas.width = target.width;
    this.outputCanvas.height = target.height;
    this.inputMat = new this.cv.Mat(sourceHeight, sourceWidth, this.cv.CV_8UC4);
    this.outputMat =
      sourceWidth === target.width && sourceHeight === target.height
        ? null
        : new this.cv.Mat(target.height, target.width, this.cv.CV_8UC4);
    this.outputImageData = new ImageData(target.width, target.height);
    this.sourceSize = { width: sourceWidth, height: sourceHeight };
    this.targetSize = target;
  }

  private releaseMats(): void {
    this.inputMat?.delete();
    this.outputMat?.delete();
    this.inputMat = null;
    this.outputMat = null;
    this.sourceSize = { width: 0, height: 0 };
    this.targetSize = { width: 0, height: 0 };
  }
}
