const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionSuccessStatus: 200,
};

// middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

//verify jwt middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6salq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const jobsCollection = client.db("soloSphere").collection("jobs");
    const bidsCollection = client.db("soloSphere").collection("bids");

    // jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token on logout

    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    //await client.connect();
    // Send a ping to confirm a successful connection

    // Get all jobs data from db
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // Get a single job data from db using job id
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // save a bid data in the database
    app.post("/bid", async (req, res) => {
      const bidData = req.body;

      // check if its a duplicate request
      const query = {
        email: bidData.email,
        jobId: bidData.jobId,
      };

      const alreadyApplied = await bidsCollection.findOne(query);
      if (alreadyApplied) {
        return res
          .status(400)
          .send("You have already applied placed a bid on this job");
      }

      const result = await bidsCollection.insertOne(bidData);
      res.send(result);
    });

    // save a job data in the database
    app.post("/job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });

    // get all job posted by any specific user
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;

      if (tokenEmail !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a job data from db
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // update a job in db

    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const jobData = req.body;
      const query = { _id: new ObjectId(id) };

      const options = { upsert: true };

      const updateDoc = {
        $set: {
          ...jobData,
        },
      };

      const result = await jobsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // get all bids from a user by email from db

    app.get("/my-bids/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // get all bid requests from db for job owner

    app.get("/bid-requests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "buyer.email": email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    // Update Bid Status
    app.patch("/bid/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;

      const query = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: status,
      };

      const result = await bidsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // get all jobs data for pagination
    app.get("/all-jobs", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      const sort = req.query.sort;
      const search = req.query.search;

      let query = {
        job_title: { $regex: search, $options: "i" },
      };
      if (filter) query.category = filter;
      let options = {};
      if (sort) options = { sort: { deadline: sort === "asc" ? 1 : -1 } };

      console.log(size, page);

      const result = await jobsCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get all jobs data count for db
    app.get("/jobs-count", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;

      let query = {
        job_title: { $regex: search, $options: "i" },
      };
      if (filter) query.category = filter;

      const count = await jobsCollection.countDocuments(query);
      res.send({ count });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello from the Server");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
