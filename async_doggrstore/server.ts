import cors from "cors";
import path from "path";
import { isAsyncFunction } from "util/types";
import express from "express";
import DoggrStore from "./src/doggrStore";
import { homedir } from "os";

export function setupRoutes(app, db) {

  app.use(cors());
  app.use(express.json());

  app.get("/", async (req, res) => {
    return db.read(req.body.key)
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      })
      .then((result) => {
        res.status(200).json(result);
      });
  });

  app.post("/", async (req, res) => {
    return db.create(req.body.key, req.body.data)
      .then(async (result) => {
        let dbSource = await db.read(req.body.key);
        res.status(200).json(dbSource);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  });

  app.patch("/", async (req, res) => {
    return db.update(req.body.key, req.body.data)
      .then((result) => {
        console.log("Patched db successfully", result);
        res.status(200).json(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  });

  app.delete("/", async (req, res) => {
    return db.delete(req.body.key)
      .then((result) => {
        console.log("Deleted data");
        res.status(200).send(`Deleted all data associated with ${req.body.key}`);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  });
}

async function main() {
  const db = new DoggrStore(homedir() + "/doggr.db");
  await db.init();

  const app = express();
  setupRoutes(app, db);
  // now we need to await our listen!
  const server = await app.listen(3000, () => {
    console.log("Server is running");
  });
}

main();