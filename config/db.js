import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;
let db;

export const connectDB = async () => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db("langmatch");
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export const getDB = () => db;
