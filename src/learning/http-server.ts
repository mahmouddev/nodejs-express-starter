import http from "http";
import { Task } from "./typescript-basics";


let tasks: Task[] = [];
let nextID = 1;

const server = http.createServer((req, res) => {
    
    const {method, url} = req;
    console.log(method, url);
    res.setHeader("Content-Type", "application/json");

    let body = '';
    req.on("data", (chunk) => {
        body += chunk;
    })

    req.on("end", () => {
        // Route: GET /
        if (method === "GET" && url === "/") {
            res.statusCode = 200;
            res.end(JSON.stringify({ message: "Welcome to Task API" }));
        }

        // Route: GET /tasks
        else if (method === "GET" && url === "/tasks") {
            // return all tasks
            res.statusCode = 200;
            res.end(JSON.stringify(tasks));
        }

        // Route: POST /tasks
        else if (method === "POST" && url === "/tasks") {
            try {
                const parsed = JSON.parse(body);
                const task: Task = {
                    id: nextID++,
                    title: parsed.title,
                    description: parsed.description,
                    status: parsed.status || "active",
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                tasks.push(task);
                res.statusCode = 201;
                res.end(JSON.stringify(task));
            } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        }

        // Route: GET /tasks/:id
        else if (method === "GET" && url?.startsWith("/tasks/")) {
            const id = Number(url.split("/")[2]);
            const task = tasks.find(t => t.id === id);
            if (!task) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Task not found" }));
                return;
            }
            res.statusCode = 200;
            res.end(JSON.stringify(task));
        }

        // Route: DELETE /tasks/:id
        else if (method === "DELETE" && url?.startsWith("/tasks/")) {
            const id = Number(url.split("/")[2]);
            const index = tasks.findIndex(t => t.id === id);
            if (index === -1) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Task not found" }));
                return;
            }
            const [deleted] = tasks.splice(index, 1);
            res.statusCode = 200;
            res.end(JSON.stringify(deleted));
        }

        // 404 — Not Found
        else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Not Found" }));
        }  


    })

})

server.listen(3000, () => {
    console.log("Server started on port 3000");
})