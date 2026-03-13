import * as fs from "fs";
import {promises as fsPromises} from "fs";
import * as path from "path";
import { EventEmitter } from 'events';
import type { Task } from "../typescript-basics";
import {  Readable , Transform, Writable  } from "stream";

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// 1. Write a function that reads a file and logs its contents (callback version)
function readFileContent(){
    fs.readFile("./src/demo.txt", "utf8", (err, data) => {
        if (err) {
            console.error("Error reading file:", err.message);
            return;
        }
        console.log(data);
    });
}

//readFileContent();

// 2. Write the same function using async/await with fs.promises
async function readFileContentAsync(){
    

    try{
    const fileContent = await fsPromises.readFile("./src/demo.txt", "utf8");

    console.log(fileContent);
    } catch (error) {
        console.error("Error reading file:", getErrorMessage(error));
    }
   
}
//readFileContentAsync();

// 3. Write a function that writes data to a file (async/await)
async function writeFileContent(){
    
    try{
    await fsPromises.writeFile("./src/demo.txt", "\nWelcome to TypeScript");
    }catch (error) {
        console.error("Error writing file:", getErrorMessage(error));
    }

}
//writeFileContent();

// 4. Write a function that checks if a file exists, creates it if not, appends a line to it
async function checkFileExists(){
    
    const filePath = "./src/demo.txt";
    try{
    await fsPromises.access(filePath);
    
        console.log(`File ${filePath} exists`);
      
    } catch (error) {
        console.error("Error checking file:", getErrorMessage(error));
    }   
}
//checkFileExists();

// 5. Write a function that reads a directory and lists all .ts files
async function listTsFiles(){
    try{
    const files = await fsPromises.readdir("./src");
    console.log(files);
    const tsFiles = files.filter(file => file.endsWith(".ts"));
    console.log(tsFiles);
    } catch (error) {
        console.error("Error reading directory:", getErrorMessage(error));
    }
}
//listTsFiles();


// Write a function that demonstrates these path methods and logs results:
// - path.join()
// - path.resolve()
// - path.basename()
// - path.extname()
// - path.dirname()
// - path.parse()

// Example: given "/Users/smart/project/src/index.ts", log each method's output

function pathMethodsDemo(){

    const filePath = "/Users/smart/project/src/index.ts";
    const joinedPath = path.join("src", "controllers", "task.ts")
    console.log(joinedPath)
    
    const pathResolver =  path.resolve("src", "controllers", "task.ts")
    console.log(pathResolver)

    const pathBaseName = path.basename(filePath)
    console.log(pathBaseName)
    
    const pathExtName = path.extname(filePath)
    console.log(pathExtName)

    const pathDirName = path.dirname(filePath)
    console.log(pathDirName)

    const pathParse = path.parse(filePath)
    console.log(pathParse)
    
}
//pathMethodsDemo();


class TaskManager extends EventEmitter {
    
    private tasks: Task[] = [];
    constructor() {
        super();
    }
    
    addTask(task: Task) {
        this.tasks.push(task);
        this.emit("taskAdded", task);
        
    }

    removeTask(id : number) {
        const task = this.tasks.find(task => task.id === id)
        if (!task) {
            return;
        }

        this.tasks = this.tasks.filter(task => task.id !== id);
        
        this.emit("taskRemoved", task);
    }

    completeTask(id: number) {
        let task:Task | undefined = this.tasks.find(task => task.id === id);
        if (!task) {
            return;
        }
        task.status = "completed";
        task.updatedAt = new Date();

        this.emit("taskCompleted", task);
    }
}

// Then: create instance, register .on() listeners, call the methods
let task = new TaskManager();
task.on("taskAdded", (task: Task) => {
    console.log(`Task added: ${task.title}`);
});

task.on("taskRemoved", (task: Task) => {
    console.log(`Task removed: ${task.title}`);
});

task.on("taskCompleted", (task: Task) => {
    console.log(`Task completed: ${task.title}`);
});

task.addTask({
    id : 1,
    title : "Task 1",
    description : "Task 1 description",
    status : "active",
    createdAt : new Date(),
    updatedAt : new Date()
})

task.completeTask(1);

task.removeTask(1);


// 1. Create a custom Readable stream that pushes numbers 1 to 10
const readableStream = new Readable({
    objectMode: true,
    read() {
        for(let i=1 ; i <= 10 ; i++){
            this.push(i);
        }
        this.push(null);
    }
})

// 2. Create a custom Transform stream that doubles each number
const transformStream = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
        this.push(chunk * 2);
        callback();
    }
})

// 3. Create a custom Writable stream that logs each chunk
const writerStrem = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
        console.log(chunk);
        callback();
    }
})

// 4. Pipe them together: readable -> transform -> writable
readableStream.pipe(transformStream).pipe(writerStrem);
