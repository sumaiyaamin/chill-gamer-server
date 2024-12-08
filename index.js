const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI with proper template literals
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
        const userCollection = db.collection("users");

        // Create indexes
        await reviewCollection.createIndex({ rating: -1, createdAt: -1 });
        await watchlistCollection.createIndex({ userEmail: 1, reviewId: 1 }, { unique: true });
        await userCollection.createIndex({ email: 1 }, { unique: true });

        // User APIs
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email };
                const existingUser = await userCollection.findOne(query);
                
                if (existingUser) {
                    return res.status(200).json({ message: 'User already exists' });
                }

                const result = await userCollection.insertOne({
                    ...user,
                    createdAt: new Date(),
                    reviews: [],
                    watchlist: []
                });
                
                res.status(201).json(result);
            } catch (error) {
                console.error('Error saving user:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // Review APIs
        app.post('/reviews', async (req, res) => {
            try {
                const review = {
                    ...req.body,
                    createdAt: new Date(),
                    rating: parseFloat(req.body.rating),
                    releaseYear: parseInt(req.body.releaseYear),
                    price: req.body.price ? parseFloat(req.body.price) : 0,
                };

                const requiredFields = [
                    'title',
                    'image',
                    'genre',
                    'platform',
                    'rating',
                    'description',
                    'reviewerName',
                    'userEmail'
                ];

                for (const field of requiredFields) {
                    if (!review[field]) {
                        return res.status(400).json({ message: `${field} is required `});
                    }
                }

                const result = await reviewCollection.insertOne(review);

                if (review.userEmail) {
                    await userCollection.updateOne(
                        { email: review.userEmail },
                        { $push: { reviews: result.insertedId } }
                    );
                }

                res.status(201).json(result);
            } catch (error) {
                console.error('Error adding review:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get single review
        app.get('/reviews/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const review = await reviewCollection.findOne({ _id: new ObjectId(id) });

                if (!review) {
                    return res.status(404).json({ message: 'Review not found' });
                }

                // Format the review data
                const formattedReview = {
                    ...review,
                    reviewerName: review.reviewerName || review.userName || 'Anonymous',
                    userEmail: review.userEmail || review.reviewerEmail || 'No email provided',
                    createdAt: review.createdAt || review.publishedDate || new Date(),
                    rating: parseFloat(review.rating).toFixed(1)
                };

                res.json(formattedReview);
            } catch (error) {
                console.error('Error fetching review:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // PUT - Update review
        app.put('/reviews/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedReview = req.body;
                const filter = { _id: new ObjectId(id) };

                // Verify ownership
                const existingReview = await reviewCollection.findOne(filter);
                if (!existingReview) {
                    return res.status(404).json({ message: 'Review not found' });
                }
                if (existingReview.userEmail !== updatedReview.userEmail) {
                    return res.status(403).json({ message: 'Not authorized to update this review' });
                }

                const updateDoc = {
                    $set: {
                        title: updatedReview.title,
                        image: updatedReview.image,
                        genre: updatedReview.genre,
                        platform: updatedReview.platform,
                        rating: parseFloat(updatedReview.rating),
                        releaseYear: parseInt(updatedReview.releaseYear),
                        publisher: updatedReview.publisher,
                        price: updatedReview.price ? parseFloat(updatedReview.price) : 0,
                        description: updatedReview.description,
                        review: updatedReview.review,
                        updatedAt: new Date()
                    }
                };

                const result = await reviewCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Review not found' });
                }

                res.json({ message: 'Review updated successfully', result });
            } catch (error) {
                console.error('Error updating review:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // DELETE - Delete review
app.delete('/reviews/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userEmail = req.query.userEmail;

        if (!userEmail) {
            return res.status(400).json({ message: 'User email is required' });
        }

        // Verify ownership
        const review = await reviewCollection.findOne({ _id: new ObjectId(id) });
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        if (review.userEmail !== userEmail) {
            return res.status(403).json({ message: 'Not authorized to delete this review' });
        }

        const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Review not found' });
        }

        // Remove review ID from user's reviews array
        await userCollection.updateOne(
            { email: userEmail },
            { $pull: { reviews: new ObjectId(id) } }
        );

        // Remove from watchlist if exists
        await watchlistCollection.deleteMany({ reviewId: id });

        res.json({ 
            success: true,
            message: 'Review deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: error.message });
    }
});

        // GET - Get highest rated games
        app.get('/highest-rated-games', async (req, res) => {
            try {
                const games = await reviewCollection
                    .find()
                    .sort({ rating: -1, createdAt: -1 })
                    .limit(6)
                    .toArray();

                const formattedGames = games.map(game => ({
                    ...game,
                    rating: parseFloat(game.rating).toFixed(1),
                    price: game.price ? parseFloat(game.price).toFixed(2) : 'N/A'
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

                const formattedReviews = reviews.map(review => ({
                    ...review,
                    rating: parseFloat(review.rating).toFixed(1)
                }));

                res.json(formattedReviews);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get user's reviews
        app.get('/users/:email/reviews', async (req, res) => {
            try {
                const email = req.params.email;
                const reviews = await reviewCollection
                    .find({ userEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                const formattedReviews = reviews.map(review => ({
                    ...review,
                    rating: parseFloat(review.rating).toFixed(1)
                }));

                res.json(formattedReviews);
            } catch (error) {
                console.error('Error fetching user reviews:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // Watchlist APIs
        app.post('/watchlist/add', async (req, res) => {
            try {
                const watchlistItem = {
                    ...req.body,
                    addedAt: new Date()
                };

                // Check if already in watchlist
                const existingItem = await watchlistCollection.findOne({
                    reviewId: watchlistItem.reviewId,
                    userEmail: watchlistItem.userEmail
                });

                if (existingItem) {
                    return res.status(400).json({ message: 'Already in watchlist' });
                }

                const result = await watchlistCollection.insertOne(watchlistItem);

                // Update user's watchlist array
                await userCollection.updateOne(
                    { email: watchlistItem.userEmail },
                    { $push: { watchlist: watchlistItem.reviewId } }
                );

                res.status(201).json(result);
            } catch (error) {
                console.error('Error adding to watchlist:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Check if review is in watchlist
        app.get('/watchlist/check/:reviewId', async (req, res) => {
            try {
                const reviewId = req.params.reviewId;
                const userEmail = req.query.userEmail;

                if (!userEmail) {
                    return res.status(400).json({ message: 'User email is required' });
                }

                const watchlistItem = await watchlistCollection.findOne({
                    reviewId: reviewId,
                    userEmail: userEmail
                });

                res.json({ isInWatchlist: !!watchlistItem });
            } catch (error) {
                console.error('Error checking watchlist:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // GET - Get user's watchlist
        app.get('/users/:email/watchlist', async (req, res) => {
            try {
                const email = req.params.email;
                const watchlistItems = await watchlistCollection
                    .find({ userEmail: email })
                    .sort({ addedAt: -1 })
                    .toArray();

                res.json(watchlistItems);
            } catch (error) {
                console.error('Error fetching watchlist:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // DELETE - Remove from watchlist
        app.delete('/watchlist/:reviewId', async (req, res) => {
            try {
                const reviewId = req.params.reviewId;
                const userEmail = req.query.userEmail;

                if (!userEmail) {
                    return res.status(400).json({ message: 'User email is required' });
                }

                const result = await watchlistCollection.deleteOne({
                    reviewId: reviewId,
                    userEmail: userEmail
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Item not found in watchlist' });
                }

                // Remove from user's watchlist array
                await userCollection.updateOne(
                    { email: userEmail },
                    { $pull: { watchlist: reviewId } }
                );

                res.json({ message: 'Removed from watchlist successfully' });
            } catch (error) {
                console.error('Error removing from watchlist:', error);
                res.status(500).json({ message: error.message });
            }
        });

        // Server health check
        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB!");
    } finally {
        // Keep connection alive
        // await client.close();
    }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
    res.send('Chill Gamer server is running');
});

// Start server
app.listen(port, () => {
    console.log(`Chill Gamer server is running on port: ${port}`);
});