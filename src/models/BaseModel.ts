import db from "../config/database";

export class BaseModel {
    protected pool = db;
}