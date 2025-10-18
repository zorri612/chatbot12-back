import { getDB } from "../config/db.js";
import bcrypt from "bcrypt";

const collection = () => getDB().collection("users");

export const createUser = async (name, email, password) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = { name, email, passwordHash };
  const result = await collection().insertOne(newUser);
  return result.insertedId;
};

export const findUserByEmail = async (email) => {
  return await collection().findOne({ email });
};

export const findUserById = async (id) => {
  const { ObjectId } = await import("mongodb");
  return await collection().findOne({ _id: new ObjectId(id) });
};
