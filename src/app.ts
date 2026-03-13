import "reflect-metadata";
import "./container";
import express, { json } from 'express'
import taskRoutes from './routes/tasks.routes';
import authRoutes from './routes/auth.routes';
import {logger} from './middleware/logger';
import {notFound} from './middleware/not-found';
import {errorHandler} from './middleware/error-handler';
import { initDB } from './database/migrations/init-db';
const app = express()
const PORT = 3000
app.use(json());
app.use(logger);

app.use("/tasks", taskRoutes);
app.use("/auth", authRoutes);

app.use(notFound);           // 4. Catch unmatched routes
app.use(errorHandler);       // 5. Catch all errors — MUST be last

initDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})
