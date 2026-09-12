import { createWorker, type Worker } from "tesseract.js";
import GateAccessService from "../services/GateAccessService";

const PLATE_PATTERNS = [
    /\b[A-Z]{2,4}[-\s]?[0-9OILS]{3,5}\b/g,
    /\b[0-9OILS]{3,5}[-\s]?[A-Z]{2,4}\b/g,
    /\b[A-Z0-9]{4,10}\b/g,
];

/** Region-of-interest crops (percent of frame) where plates usually appear */
const OCR_REGIONS = [
    { left: 0.1, top: 0.5, width: 0.8, height: 0.35 },
    { left: 0.15, top: 0.55, width: 0.7, height: 0.25 },
    { left: 0.05, top: 0.35, width: 0.9, height: 0.45 },
];

let sharedWorker: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
    if (sharedWorker) return sharedWorker;
    if (workerInitPromise) return workerInitPromise;

    workerInitPromise = (async () => {
        const worker = await createWorker("eng", 1, {
            logger: () => undefined,
        });
        await worker.setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789- ",
            tessedit_pageseg_mode: "7" as any,
        });
        sharedWorker = worker;
        return worker;
    })();

    return workerInitPromise;
}

export function normalizePlate(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPlateInput(value: string): string {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return "";
    const match = clean.match(/^([A-Z]+)(\d*)$/);
    if (match) {
        const letters = match[1];
        const digits = match[2];
        if (digits) {
            return `${letters} ${digits.slice(0, 4)}`;
        }
        return letters.slice(0, 4);
    }
    if (clean.length > 3) {
        return `${clean.slice(0, 3)} ${clean.slice(3, 7)}`;
    }
    return clean;
}

export function formatPlateDisplay(value: string): string {
    const normalized = normalizePlate(value);
    if (normalized.length >= 6) {
        const match = normalized.match(/^([A-Z]+)(\d+)$/);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }
    }
    return normalized || value.toUpperCase();
}

/** Fix common OCR mistakes based on typical PH plate format (letters then digits) */
export function correctPlateOcr(raw: string): string[] {
    const normalized = normalizePlate(raw);
    if (normalized.length < 4) return [];

    const variants = new Set<string>([normalized]);

    const letterToDigit: Record<string, string> = { O: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };
    const digitToLetter: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z" };

    for (let split = 2; split <= 4; split++) {
        if (split >= normalized.length) continue;

        const letterPart = normalized.slice(0, split);
        const digitPart = normalized.slice(split);

        let fixedLetters = "";
        for (const ch of letterPart) {
            fixedLetters += digitToLetter[ch] ?? ch;
        }

        let fixedDigits = "";
        for (const ch of digitPart) {
            fixedDigits += letterToDigit[ch] ?? ch;
        }

        const candidate = fixedLetters + fixedDigits;
        if (/^[A-Z]{2,4}\d{3,5}$/.test(candidate)) {
            variants.add(candidate);
        }
    }

    return Array.from(variants);
}

function scorePlateCandidate(normalized: string): number {
    if (normalized.length < 4 || normalized.length > 10) return 0;

    const lettersDigits = normalized.match(/^([A-Z]{2,4})(\d{3,5})$/);
    if (lettersDigits) return 100 + lettersDigits[1].length + lettersDigits[2].length;

    const digitsLetters = normalized.match(/^(\d{3,5})([A-Z]{2,4})$/);
    if (digitsLetters) return 80 + digitsLetters[1].length + digitsLetters[2].length;

    const alphaNum = normalized.match(/[A-Z]/g)?.length ?? 0;
    const digits = normalized.match(/\d/g)?.length ?? 0;
    if (alphaNum >= 2 && digits >= 3) return 50 + alphaNum + digits;

    return normalized.length;
}

export function extractPlateCandidates(text: string): string[] {
    const upper = text.toUpperCase().replace(/[^A-Z0-9-\s]/g, " ");
    const scored = new Map<string, number>();

    const addCandidate = (raw: string) => {
        for (const variant of correctPlateOcr(raw)) {
            const score = scorePlateCandidate(variant);
            if (score > 0) {
                scored.set(variant, Math.max(scored.get(variant) ?? 0, score));
            }
        }
    };

    for (const pattern of PLATE_PATTERNS) {
        const matches = upper.match(pattern) ?? [];
        for (const match of matches) addCandidate(match);
    }

    const collapsed = upper.replace(/\s+/g, "");
    if (collapsed.length >= 5) addCandidate(collapsed);

    return Array.from(scored.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([plate]) => plate);
}

function preprocessCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const contrast = Math.min(255, Math.max(0, (gray - 128) * 2.2 + 128));
        const binary = contrast > 125 ? 255 : 0;
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);
}

function canvasFromImage(
    img: HTMLImageElement | HTMLCanvasElement,
    region?: { left: number; top: number; width: number; height: number },
    skipPreprocess = false
): HTMLCanvasElement | null {
    const sourceWidth = "naturalWidth" in img ? img.naturalWidth : img.width;
    const sourceHeight = "naturalHeight" in img ? img.naturalHeight : img.height;

    if (!sourceWidth || !sourceHeight) return null;

    const canvas = document.createElement("canvas");
    const maxWidth = 800;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (region) {
        sx = Math.round(sourceWidth * region.left);
        sy = Math.round(sourceHeight * region.top);
        sw = Math.round(sourceWidth * region.width);
        sh = Math.round(sourceHeight * region.height);
    }

    const scale = Math.min(1, maxWidth / sw);
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    if (!skipPreprocess) {
        try {
            preprocessCanvas(ctx, canvas.width, canvas.height);
        } catch {
            // Cross-origin frame: OCR still runs on the raw image.
        }
    }

    return canvas;
}

async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<string[]> {
    const worker = await getWorker();
    const results: string[] = [];

    for (const psm of ["7", "6", "11"] as const) {
        await worker.setParameters({ tessedit_pageseg_mode: psm as any });
        const { data } = await worker.recognize(canvas);
        results.push(...extractPlateCandidates(data.text));
    }

    return results;
}

export async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
        });
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function fetchCameraSnapshot(location: "entrance" | "exit"): Promise<HTMLImageElement | null> {
    try {
        const res = await GateAccessService.fetchCameraSnapshot(location);
        return await loadImageFromBlob(res.data as Blob);
    } catch {
        return null;
    }
}

export async function recognizePlateFromImage(img: HTMLImageElement): Promise<string | null> {
    const candidates = await recognizePlateCandidatesFromImage(img);
    return candidates[0] ?? null;
}

export async function recognizePlateCandidatesFromImage(img: HTMLImageElement): Promise<string[]> {
    const allCandidates: string[] = [];

    const attempts: Array<{ region?: { left: number; top: number; width: number; height: number }; raw?: boolean }> = [
        { region: OCR_REGIONS[1] },
        { region: OCR_REGIONS[0] },
        { region: OCR_REGIONS[1], raw: true },
        { region: OCR_REGIONS[0], raw: true },
        { region: OCR_REGIONS[2] },
        { raw: true },
        {},
    ];

    for (const attempt of attempts) {
        const cropCanvas = canvasFromImage(img, attempt.region, attempt.raw);
        if (cropCanvas) {
            const candidates = await recognizeCanvas(cropCanvas);
            allCandidates.push(...candidates);

            const hasStrongCandidate = candidates.some(c => scorePlateCandidate(c) >= 80);
            if (hasStrongCandidate) {
                break;
            }
        }
    }

    const ranked = new Map<string, number>();
    for (const plate of allCandidates) {
        ranked.set(plate, (ranked.get(plate) ?? 0) + scorePlateCandidate(plate));
    }

    return Array.from(ranked.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([plate]) => plate);
}

export async function recognizePlateCandidatesFromSnapshot(location: "entrance" | "exit"): Promise<string[]> {
    const img = await fetchCameraSnapshot(location);
    if (!img) return [];
    return recognizePlateCandidatesFromImage(img);
}

export async function recognizePlateFromSnapshot(location: "entrance" | "exit"): Promise<string | null> {
    const candidates = await recognizePlateCandidatesFromSnapshot(location);
    return candidates[0] ?? null;
}

export async function captureFrameBlob(img: HTMLImageElement): Promise<Blob | null> {
    const canvas = canvasFromImage(img);
    if (!canvas) return null;

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
}

export async function snapshotToBlob(location: "entrance" | "exit"): Promise<Blob | null> {
    try {
        const res = await GateAccessService.fetchCameraSnapshot(location);
        return res.data as Blob;
    } catch {
        return null;
    }
}

export async function terminatePlateOcrWorker(): Promise<void> {
    if (sharedWorker) {
        await sharedWorker.terminate();
        sharedWorker = null;
        workerInitPromise = null;
    }
}
