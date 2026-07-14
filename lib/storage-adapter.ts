import { publicAssetPath } from "@/lib/assets";
import type { TestAsset } from "@/types/test";

export interface SaveFileInput {
  testId: string;
  file: File;
  relativePath: string;
  asset?: Partial<TestAsset>;
}

export interface StoredFile {
  id: string;
  relativePath: string;
  publicUrl: string;
  size?: number;
  mimeType?: string;
}

export interface StorageAdapter {
  saveFile(input: SaveFileInput): Promise<StoredFile>;
  deleteFile(fileId: string): Promise<void>;
  getPublicUrl(fileId: string): Promise<string>;
  fileExists(fileId: string): Promise<boolean>;
}

export class LocalContentStorageAdapter implements StorageAdapter {
  async saveFile(): Promise<StoredFile> {
    throw new Error("Local content upload is not implemented. Place files under content/<test-id>/ and run npm run sync-content.");
  }

  async deleteFile(): Promise<void> {
    throw new Error("Local content deletion is not implemented in the browser.");
  }

  async getPublicUrl(fileId: string) {
    const [testId, ...parts] = fileId.split("/");
    return publicAssetPath(testId, parts.join("/")) || "";
  }

  async fileExists(fileId: string) {
    const url = await this.getPublicUrl(fileId);
    if (!url || typeof fetch === "undefined") return false;
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  }
}
