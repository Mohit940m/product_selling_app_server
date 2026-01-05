import dotenv from 'dotenv';
dotenv.config(); // Load environment variables

import express from 'express';
import connectDB from './config/db.js';
import cors from 'cors';
import userRoutes from './routes/user.routes/userRoute.js';
import swaggerRoutes from './config/swagger.js';

const port = process.env.PORT;

connectDB();

const app = express();

app.use(express.json());
app.use('/api/v1/user', userRoutes);
app.use("/api-docs", swaggerRoutes);

app.use(cors(
    {
        origin: '*',
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE",],
    }
));

app.listen(port, () =>{
    console.log(`Server is running on http://localhost:${port}`);
})