import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cors from 'cors';
import userRoutes from './routes/user.routes/userRoute.js';

dotenv.config();

const port = process.env.PORT || 4000;

connectDB();

const app = express();

app.use(express.json());
app.use('/api/v1/user', userRoutes);

app.use(cors(
    {
        origin: '*',
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE",],
    }
));

app.listen(port, () =>{
    console.log(`Server is running on http://localhost:${port}`);
})