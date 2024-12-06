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

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db("chillGamerDB");
        const reviewCollection = db.collection("reviews");
        const watchlistCollection = db.collection("watchlist");

        // POST - Add a new game review
        app.post('/reviews', async (req, res) => {
            try {
                const review = {
                    ...req.body,
                    createdAt: new Date(),
                    rating: parseFloat(req.body.rating), 
                    releaseYear: parseInt(req.body.releaseYear), 
                    price: req.body.price ? parseFloat(req.body.price) : 0, 
                };

                
                const requiredFields = ['title', 'image', 'genre', 'platform', 'rating', 'description'];
                for (const field of requiredFields) {
                    if (!review[field]) {
                        return res.status(400).json({ message: `${field} is required` });
                    }
                }

                const result = await reviewCollection.insertOne(review);
                res.status(201).json(result);
            } catch (error) {
                console.error('Error adding review:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get highest rated games (limit to 6)
        app.get('/highest-rated-games', async (req, res) => {
            try {
                const games = await reviewCollection
                    .find()
                    .project({
                        title: 1,
                        image: 1,
                        genre: 1,
                        platform: 1,
                        releaseYear: 1,
                        rating: 1,
                        description: 1,
                        publisher: 1,
                        price: 1
                    })
                    .sort({ 
                        rating: -1, 
                        createdAt: -1 
                    })
                    .limit(6)
                    .toArray();

             
                const formattedGames = games.map(game => ({
                    ...game,
                    rating: parseFloat(game.rating).toFixed(1), 
                    price: game.price ? `$${parseFloat(game.price).toFixed(2)}` : 'N/A'
                }));

                res.json(formattedGames);
            } catch (error) {
                console.error('Error fetching highest rated games:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get all reviews
        app.get('/reviews', async (req, res) => {
            try {
                const reviews = await reviewCollection
                    .find()
                    .sort({ createdAt: -1 }) 
                    .toArray();
                res.json(reviews);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });


       
        
    

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