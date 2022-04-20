# DoggrStore

## HOUSEKEEPING:
Topics for Wednesday
 - Teams coming next week, you may work in teams of 2 or 3
 - Choose amongst yourselves first
 - Feel free to advertise in Zulip, particularly if you
 	- want to use a specific language
 	- want to work on specific portiono
 	- intent is to divide the work (frontend/backend/ops/etc)
- HW Solution is up on Canvas/Github
	- Mention github token email
- Discuss new Obsidian-based notes/blogs possibility

## Promises and Async

We made a basic data storage object a while back.  Now we're going to extend it in our search for learning about Promises and Async/Await.  Whether you knew it at the time or not, what we were making actually has a name, NoSQL, so we can consult it to see exactly what we should be building.

https://redis.com/nosql/key-value-databases/

Lets start with a quick tour of Promises, courtesy of google.  Maybe 20 minutes?

https://www.freecodecamp.org/news/learn-promise-async-await-in-20-minutes/

We're going to build one that serves basic CRUD functionality, async-ify it, then nest it behind an express server that responds to requests.

To begin with, we'll copy our nexpress folder to a doggr_store dir and clean it out a bit to save all of our config effort.  Mainly, we ditch everything but the infrastructure.  We also need to ensure that it's listening on a port different than 9000, so it can coexist with our real backend.  We'll change that to 3000.

Our debug launching from tasks.json and launch.json also need changes to our new dir structure.

Now we're ready to start with a new file in a new language, the fabled Typescript!  We'll make doggrStore.ts in /src

```ts

export default class DoggrStore {
  private data: Object = {};
  dbPath: string = "";  
 
  
  constructor(dbPath) {
    this.data = {};
    this.dbPath = dbPath; 
  }  
```


> [!question]
> What has changed with our migration to Typescript?  Why?

> [!success] Answer 
> 
> We've added types to both fields of DoggrStore, and made data Private.  These allow us to start guarding against the myriad of horrific JS bugs we've encountered so far.

---
## Create
We'll start with the create portion of CRUD, so we'll be able to use it to prime our store for the other functions.

``` ts

async create(key, data) {
	console.log(`Creating ${key} from ${data} for store`);
	this.data[key] = data;

}
```

Notice how incredibly basic this is.  If you check your type hints, you'll see some `any` types.  We want to avoid these.  We know our types though!  Key will always be a String, and data will be an Object (specifically NOT any... https://stackoverflow.com/questions/18961203/any-vs-object ) so we can spruce this puppy up:

```typescript
async create(key: string, data: Object) {
	console.log(`Creating ${key} from ${data} for store`);
	this.data[key] = data;
}
```

Now Typescript will save us from doing dumb things!  Some of them, anyway.

> [!Question]
> Is there any way to break this function from the outside still?  Is there anything wrong with it at all?

---
## Read
We're going to be happy with our `create` for now, and move onward to `read`.

```typescript
async read(key) {
	return this.data[key];
}
```

We have obvious issues, right?  What happens if our datastore doesn't have any data, or indeed any entry at all, that matches the requested key?  Let's run that and find out.

Sure enough, this blows up.  How would we handle this in a different language?  For most, we'd throw an Exception, or otherwise return the data.  We can impl it that way now.

```typescript
  async read(key: string) {
    console.log("store getting ", key);
    let result = this.data[key];
    if (result) {
      console.log("Found result");
      return result;
    } 
  }
```

> [!note]
> - Our type hint inlay changes from `Promise<void>` to `Promise<any>` because our result has an implicit `any` type.
> - Returns from an `async` method are auto wrapped in a Promise




Now lets add our error handling.   In most languages, we throw an exception, right?  Lets try that.

```ts
  async read(key: string) {
    console.log("store getting ", key);
    let result = this.data[key];
    if (result) {
      console.log("Found result");
      return result;
    } else {
      console.log("Found no result");
      // 4 so we need a returned error, right?
      // throwing an error causes an immediate Promise.reject()
      // now lets try it in app.get
      throw new Error("No result found!");
      
      
   }
  }
```

And we'll make a get request in server.ts

```ts
app.get("/", async (req, res) => {
    let result = await db.read("index");

    res.status(200).send("GETIndex");
  });
  
```

> [!question]
> Why does this blow up? Does it match expectations?

> [!success] Answer
> 
 >We've thrown an Error via throw new, but we handle it nowhere.  Eventually it crashes our program!

---
---
Internally, just like returning a value from an `async` method is wrapped in a Promise, Exceptions are caught in `async` methods and converted into the `Reject` version of our Promise.  Luckily, just as we can use try/catch to handle normal JS Exceptions, we can also use Promise's `catch()` method to manage async ones!  Let's update server.ts with this catch

```ts
 app.get("/", async (req, res) => {
    await db.read(req.body.key)
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      })
      .then((result) => {
        res.status(200).json(result);
      });
  });
```

If we test again, we'll find things are being logged as we'd expect rather than killing our server!  What if we'd like to do more than just console logging the error, though?  We can implement our very own derived Error type that contains any metadata we want!

```ts
class KeyDoesNotExistError extends Error {
  constructor(key) {
    super(`Queried key "${key}" didn't exist`);
    this.name = "KeyDoesNotExistError";
  }
}
```

Then modify our `read()` function to use it instead:

```ts
async read(key: string) {
    let result = this.data[key];
    
    if (result) {
      return result;
    } else {        
      throw new KeyDoesNotExistError(key);
   }
  }
```

Remember that just because `async` implicitly converts to Promises, we could've done it manually as well!

```ts
async read(key: string) {
    let result = this.data[key];
    
    if (result) {
      return Promise.resolve(result);
    } else {        
      return Promise.reject(new DataReadError(key));
   }
  }
```

```ad-note
We're manually returning Promise.resolve/reject here instead of relying on `async` to do so for us.  It works the exact same!
```
---
---
## Create Refactor
Now we can use our new Error knowledge to fix `create` as well!  

First, we'll want to make a new error type:

```ts
class KeyAlreadyExistsError extends Error {
  constructor(key) {
    super(`Attempted to create a new key "${key}" when a pre-existing one already exists`);
    this.name = "KeyAlreadyExistsError";
  }
}
```

And then modify `create`:

```ts
async create(key: string, data: Object) {
    if (this.data[key]) {
      throw new KeyAlreadyExistsError(key);
    }

    this.data[key] = data;
  }
```

---

Now we'll add a `POST` route to our server and try her out!

```ts
app.post("/", async (req, res) => {
    await db.create(req.body.key, req.body.data)
      .then(async (result) => {
        let dbSource = await db.read(req.body.key);
        res.status(200).json(dbSource);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  })
```

> [!note]
> We're using a second async call inside of `then()` just to show nested awaiting.  The client obviously knows this already, and normally you wouldn't send anything back for this request.

---

Because we're now using JSON in our request, we'll need to add the json middleware:

```ts
app.use(express.json());
```

We'll also want to set Postman to use `POST` and send the following JSON:

```json
{
    "key": "testKey",
    "data": {
        "dataField1": "DataField1Value",
        "dataField2": "DataField2Value"
    }
}
```

> [!success] 
> VICTORY!

---
---
## Update
Now we can add our third CRUD function, Update!  This corresponds to HTTP Verb `PATCH`, so lets add a new `update` function to doggoStore.  This will be pretty close to `create`, but we'll need to check to ensure the key exists, not that it doesn't.

```ts
async update(key, data) {
    if (!this.data[key]) {
      throw new KeyDoesNotExistError(key);
    }
    this.data[key] = data;
  }
```

We'll once again need to build a route for it, this time using `patch`:

```ts
app.patch("/", async (req, res) => {
    await db.update(req.body.key, req.body.data)
      .then(async (result) => {
        console.log("Patched user successfully", result);
        res.status(200).json(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  })
```

Good time to test in Postman our new routes!  Once we're satisfied, we can move on to the last for doggrStore!

---
---
## Delete
```ts
async delete(key) {
    if (!this.data[key]) {
      throw new KeyDoesNotExistError(key);
    }
    this.data[key] = undefined;
  }
```

And build one more route in our server!

```ts
app.delete("/", async (req, res) => {
    await db.update(req.body.key, req.body.data)
      .then(async (result) => {
        console.log("Deleted data");
        res.status(200).send(`Deleted all data associated with ${req.body.key}`);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send(err);
      });
  });
```

Now we mash all 4 of them lots in Postman until we're convinced we did things correctly....sweet success!  We have successfully built a NoSQL microservice from scratch, and this one we'll use for a while! 

---
---
# Persistence
As we saw in the earlier class's incarnation of DoggrStore, when the server crashes/reboots, everything is lost!  Lets instead use our newfound async-ness to persist everything to disk every time a change occurs.  We'll be writing a file, which we already know is a blocking operation.  This means we'll also need to use the handy async'd-up Node `fs` substitute provided by `fs/promises`

```ts
import fs from 'fs/promise';  
```

Now we need to think about how we want to manage serializing our data to disk.  

> [!question]
> What are some pitfalls to watch out for?
 > - When do we save our updated data store to disk?
 > - What happens if our server crashes before the write has finished?
 > - What happens if more than one person attempts to use our data store at the same time?
 > - If they attempt to interact with the same key?


For now, we're going to ignore all those pitfalls with a brute force approach.

> [!success] Approach
> 1. We'll open our database when the server boots, via an `init` method
> 2. If a database doesn't yet exist, we'll create one and seed it with basic data
> 3. We read from our db file and deserialize the file contents into our data object in RAM
> 4. To ensure we're remaining in-sync with our file, we check before all database ops that we've synchronized before and after
> 5. Each time we change the data in-memory, we'll write that change to disk
 

In essence, our in-memory structure is barely used, as we'll repeatedly farm every change to disk, but this is an okay beginning!

We'll start with init, which will perform steps 1..3:

```ts
 async init() {
    return this.checkLoadDb();
  }
```

We'll now need to call our init() from server.ts, but note that it is async!  We need to `await` it to ensure we've completed initialization, which we cannot do from outside of an async function.  We'll convert our server to use a `main` method which awaits our new `init`:

```ts
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
```

Now, when we start our database, we'll check to see if a db already exists.  If not, we create a default, then load it.  Sadly, fs/promises missed the method that checks to see if a file exists, so we'll pull that one in from `npm` via the `fs.promises.exists` package

```ts
import fsExists from 'fs.promises.exists';
...

private async checkLoadDb() {	
    let exists = await fsExists(this.dbPath);
    if (!exists) {
      await this.createDbFile();
    }

    this.data = await this.loadFromDbFile();
  }
...
  
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
        throw new Error("Couldn't read file from dbFile, though we just created it");
      });

    let dataMap = JSON.parse(rawData);

    return dataMap;
}
```

Now we'll need to refactor our CRUD methods a bit to brute force this `checkLoad` pattern

```ts
...
async create(key: string, data: Object) {
    // Brute force staying in sync with the on-disk representation once we've initialized
    await this.checkLoadDb();

...
async read(key: string): Promise<Object> {    
    await this.checkLoadDb();
...
 async update(key, data) {
    await this.checkLoadDb();
...
async delete(key) {
    await this.checkLoadDb(); 
...
```

Excellent, now we can't fail but to have the most up-to-date version, right?  RIGHT?  Lets move onward to saving them!  We'll use the same gnarly brute-force process to save after every change, but first we need a save method:

```ts
private async saveDb() {
    let outData = JSON.stringify(this.data);
    return fs.writeFile(this.dbPath, outData, "utf8");
  }
```

Nice and easy this time, we just string up our whole data store and dump it into the file.  We'll once again refactor our CUD methods to make use of this.  

> [!question]
> Why are we leaving out Read?



```ts
async create(key: string, data: Object) {
    // Brute force staying in sync with the on-disk representation once we've initialized
    await this.checkLoadDb();

    if (this.data[key]) {
      throw new KeyAlreadyExistsError(key);
    }

    this.data[key] = data;
    return this.saveDb();
  }
...
async read(key: string): Promise<Object> {    
    await this.checkLoadDb();
    let result = this.data[key];
    if (result) {
      return Promise.resolve(result);
    } else {
      return Promise.reject(new KeyDoesNotExistError(key));
    }
  }
...
  async update(key, data) {
    await this.checkLoadDb();
    if (!this.data[key]) {
      throw new KeyDoesNotExistError(key);
    }
    this.data[key] = data;
    return this.saveDb();
  }
...
  async delete(key) {
    await this.checkLoadDb();    
    if (!this.data[key]) {     
      throw new KeyDoesNotExistError(key);
    }    
    delete this.data[key];
    return this.saveDb();
  }
```

Hooray, now everything we do goes to disk the very minute we do it!  Then, every time we want to do something else, we read the data from disk, perform our operation on it, then write a changed data store back to disk. 

> [!note]
> - Is this expensive? Relatively
> - Is this full of race conditions? Yes
> - Are we spending lots of time and CPU reading and writing unchanged data to disk? YES
> - Does it work for now? YES!

Now we should be (finally) ready to refactor our routes to call our updated database methods properly:

```ts
function setupRoutes(app, db) {

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
```

Some Postman testing later, we're done!  We have a working, prime condition, fully-asynchronous database microservice from raw Promises.

