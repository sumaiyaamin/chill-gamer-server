const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.osfm1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server
        await client.connect();

        // Database and Collections
        const db = client.db("chillGamerDB");
        const reviewCollection = db.collection("reviews");
        const watchlistCollection = db.collection("watchlist");

        // POST - Add a new game review
        app.post('/reviews', async (req, res) => {
            try {
                const review = req.body;
                review.createdAt = new Date(); 
                const result = await reviewCollection.insertOne(review);
                res.json(result);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get highest rated games (limit to 6)
        app.get('/highest-rated-games', async (req, res) => {
            try {
                const games = await reviewCollection
                    .find()
                    .sort({ rating: -1 }) // descending order
                    .limit(6)
                    .toArray();
                res.json(games);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get all reviews
        app.get('/reviews', async (req, res) => {
            try {
                const reviews = await reviewCollection.find().toArray();
                res.json(reviews);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });


       

       

        

       

       

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Commented out to keep connection alive
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Chill Gamer server is running')
});

app.listen(port, () => {
    console.log(`Chill Gamer server is running on port : ${port}`)
});