import fs from "fs/promises";
import path from "path";

export class LocalStorage {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async saveInput(jobId: string, fileName: string, data: Buffer): Promise<string> {
    const safeName = path.basename(fileName);
    const filePath = path.join(this.rootDir, "input", `${jobId}-${safeName}`);
    await this.writeFile(filePath, data);
    return filePath;
  }

  async saveOutput(jobId: string, data: Buffer): Promise<string> {
    const filePath = path.join(this.rootDir, "output", `${jobId}.pdf`);
    await this.writeFile(filePath, data);
    return filePath;
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  private async writeFile(filePath: string, data: Buffer): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }
}

