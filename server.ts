
import { createApp } from './app.js';
import mongoose from "mongoose";
import dotenv from "dotenv";
import {dbConnection} from "./config/dataBase.js"
dotenv.config();

dbConnection();

const port = Number(process.env.PORT) || 5000;

const app = createApp();

//GLOBAL MIDDLEWARES FOR ROUTE NOT FOUND
app.all(/.*/, (req, res, next) => {
    res.send("not fount");
    const err = new Error('Route Not Found') as Error & { status: number };
    err.status = 404;
    next(err);
})


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
