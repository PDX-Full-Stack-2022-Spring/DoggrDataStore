import fs, { FileHandle } from "fs/promises";
// fs/promises doesn't have an Exists method for whatever reason
import fsExists from 'fs.promises.exists';
// Show redis description 
// https://redis.com/nosql/key-value-databases/

class KeyDoesNotExistError extends Error {
  constructor(key) {
    super(`Queried key "${key}" didn't exist`);
    this.name = "KeyDoesNotExistError";
  }
}

class KeyAlreadyExistsError extends Error {
  constructor(key) {
    super(`Attempted to create a new key "${key}" when a pre-existing one already exists`);
    this.name = "KeyAlreadyExistsError";
  }
}

export default class DoggrStore {
  private data = {};
  dbPath: string = "";

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init() {
    return this.checkLoadDb();
  }

  async create(key: string, data: Object) {
    // Brute force staying in sync with the on-disk representation once we've initialized
    await this.checkLoadDb();

    if (this.data[key]) {
      throw new KeyAlreadyExistsError(key);
    }

    this.data[key] = data;
    return this.saveDb();
  }

  async read(key: string): Promise<Object> {    
    await this.checkLoadDb();
    let result = this.data[key];
    if (result) {
      return Promise.resolve(result);
    } else {
      return Promise.reject(new KeyDoesNotExistError(key));
    }
  }

  async update(key, data) {
    await this.checkLoadDb();
    if (!this.data[key]) {
      throw new KeyDoesNotExistError(key);
    }
    this.data[key] = data;
    return this.saveDb();
  }

  async delete(key) {
    await this.checkLoadDb();    
    if (!this.data[key]) {     
      throw new KeyDoesNotExistError(key);
    }    
    delete this.data[key];
    return this.saveDb();
  }

  private async createDbFile() {
    let dataMap = { testKey: { dataField1: "DataFieldValue1", dataField2: "DataFieldValue2" } }
    let jsonMap = JSON.stringify(dataMap);

    return fs.writeFile(this.dbPath, jsonMap, "utf8")
      .catch(err => {
        throw new Error("Couldn't write a file, something horribly wrong has happened");
      });

  }

  private async loadFromDbFile() {
    // Don't need to check existence here because we're called from checkLoadDb()   
    let rawData = await fs.readFile(this.dbPath, "utf8")
      .catch((err) => {
        throw new Error("Couldn't read file from dbFile");
      });

    let dataMap = JSON.parse(rawData);
    return dataMap;
  }

  private async checkLoadDb() {
    let exists = await fsExists(this.dbPath);
    if (!exists) {
      await this.createDbFile();
    }
    // We MUST await here, otherwise we may attempt to use this.data
    // before the load has completed
    this.data = await this.loadFromDbFile();
  }

  private async saveDb() {
    let outData = JSON.stringify(this.data);
    return fs.writeFile(this.dbPath, outData, "utf8");
  }
}
