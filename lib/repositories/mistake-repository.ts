import { storage } from "@/lib/storage";
import type { MistakeItem } from "@/types/practice";

export interface MistakeRepository {
  getMistakes(): Promise<MistakeItem[]>;
  saveMistake(mistake: MistakeItem): Promise<void>;
  removeMistake(id: string): Promise<void>;
  clearMistakes(): Promise<void>;
}

export class LocalStorageMistakeRepository implements MistakeRepository {
  async getMistakes() {
    return storage.getMistakes();
  }

  async saveMistake(mistake: MistakeItem) {
    storage.setMistakes([mistake, ...storage.getMistakes().filter((item) => item.id !== mistake.id)]);
  }

  async removeMistake(id: string) {
    storage.setMistakes(storage.getMistakes().filter((item) => item.id !== id));
  }

  async clearMistakes() {
    storage.clearMistakes();
  }
}
