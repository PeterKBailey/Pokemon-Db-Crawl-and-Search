const express = require('express');
const path = require('path');

const app = express();

app.set("views", [path.join(__dirname, 'views')])
app.set("view engine", "pug");

// Automatically parse JSON data
app.use(express.json());

// Server for static files, will this be needed?
// app.use(express.static('public'));



let crawlRouter = require("./routes/crawls.js");
app.use("/crawls", crawlRouter);

let pagesRouter = require("./routes/pages.js");
app.use("/pages", pagesRouter);

// let crawlerRouter = require("./routes/crawler.js");
// app.use("/crawler", crawlerRouter);

// let rankRouter = require("./routes/rank.js");
// app.use("/rank", rankRouter);

app.listen(3002);
console.log("listening at port 3002");