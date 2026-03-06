"use client";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform, Share } from "react-native";

function sanitizeName(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "image";
}

function extensionFromUrl(url: string) {
  if (url.startsWith("data:")) {
    const mimeMatch = url.match(/^data:([^;,]+)/i);
    return extensionFromMime(mimeMatch?.[1] ?? "");
  }
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (match?.[1]) return match[1].toLowerCase();
  return "jpg";
}

function extensionFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("avif")) return "avif";
  if (m.includes("heic")) return "heic";
  if (m.includes("jpg") || m.includes("jpeg")) return "jpg";
  return "jpg";
}

function mimeFromExtension(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  return "image/jpeg";
}

function normalizeRemoteUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return encodeURI(url);
  }
}

function extractBase64FromDataUri(value: string) {
  const match = value.match(/^data:([^;,]+)?;base64,(.+)$/i);
  if (!match?.[2]) {
    throw new Error("Image data URI non supportee (base64 requis).");
  }
  return {
    mime: match[1] || "image/jpeg",
    base64: match[2],
  };
}

async function downloadToLocal(url: string, destination: string) {
  try {
    return await FileSystem.downloadAsync(url, destination);
  } catch (error) {
    // Some runtimes expose only the resumable downloader.
    try {
      const task = FileSystem.createDownloadResumable(url, destination);
      const result = await task.downloadAsync();
      if (result?.uri) return result;
    } catch {
      // Ignore and rethrow original error below.
    }
    throw error;
  }
}

export async function saveRemoteImage(url: string, baseName: string) {
  if (!url) throw new Error("Image URL missing.");
  const rawUrl = url.trim();
  const isDataUri = /^data:/i.test(rawUrl);
  const remoteUrl = isDataUri ? rawUrl : normalizeRemoteUrl(rawUrl);

  if (Platform.OS === "web") {
    await Linking.openURL(remoteUrl);
    return;
  }

  const ext = extensionFromUrl(remoteUrl);
  const fileName = `${sanitizeName(baseName)}.${ext}`;
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir) throw new Error("No writable directory.");
  const destination = `${dir}${fileName}`;

  try {
    const info = await FileSystem.getInfoAsync(destination);
    if (info.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }
  } catch {
    // Ignore cleanup errors before download.
  }

  let localUri = destination;
  if (isDataUri) {
    const { base64 } = extractBase64FromDataUri(remoteUrl);
    await FileSystem.writeAsStringAsync(destination, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    const result = await downloadToLocal(remoteUrl, destination);
    localUri = result?.uri ?? destination;
  }

  const canShare = await Sharing.isAvailableAsync().catch(() => false);

  if (canShare) {
    try {
      await Sharing.shareAsync(localUri, {
        dialogTitle: "Enregistrer la photo",
        mimeType: mimeFromExtension(ext),
        UTI: "public.image",
      });
      return;
    } catch {
      // Fallback below.
    }
  }

  try {
    await Linking.openURL(localUri);
    return;
  } catch {
    // Final fallback: open remote URL.
  }

  try {
    await Share.share({
      title: "Photo Comets",
      message: remoteUrl,
      url: remoteUrl,
    });
    return;
  } catch {
    // Final fallback below.
  }

  await Linking.openURL(remoteUrl);
}
