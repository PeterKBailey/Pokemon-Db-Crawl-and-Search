/*
Crawl Structure
{
    _id: String, //Mongo provided id
    name: String, //Crawl's unique name
    lastPerformed: Date //Date of the last time crawl was performed
}

Page Structure
{
    _id: String, //Mongo provided id
    uri: String, //URI of the page,
    pageRank: Number, //pageRank in the graph
    relatedCrawl: String, //Mongo id of the crawl reading this page
    title: String, //HTML page title
    content: String, //Plain text content of the page
    wordFreq: <String, Number> //Number of occurences per word
}

pageLink Structure
{
    _id: String, //Mongo provided id
    toPage: String, //URI of the page linked to
    fromPage: String, //URI Id of the page linked from
    relatedCrawl: String, //Mongo id of the crawl reading this page (for convenience)
}
*/

// MongoDb module (install via NPM - npm install mongodb)
const { MongoClient } = require("mongodb");

// helper
const {calculatePageRank} = require("../helpers/pageRankCalculator");

// we're using the lab3 data
// let cursor run and request page documents in batches and add them to index as we go
MongoClient.connect("mongodb://localhost:27017/").then(result => {
    db = result.db('a2');
});

// Express setup
const express = require('express');
let router = express.Router();

// Routes
router.get ("*", (req, res) => {res.status(200).send("Rank currently disabled.")});
router.get ("/fruits", [filterFruit, performPageRank]);
router.get ("/personal", [filterPersonal, performPageRank]);

async function filterFruit(req, res, next){
    let relatedCrawl = await db.collection("crawls").findOne({name:"FRUITS"});
    req.filter = {relatedCrawl: relatedCrawl._id.toString()};
    next();
}

async function filterPersonal(req, res, next){
    let relatedCrawl = await db.collection("crawls").findOne({name:"PERSONAL"});
    req.filter = {relatedCrawl: relatedCrawl._id.toString()};
    next();
}

async function performPageRank(req, res){
    console.log("performing rank now")
    try{
        if(await calculatePageRank(db, req.filter)){
            res.status(200).send("Page rank calculated!");
            return;
        }
        res.status(500).send("Page rank calculation issue!");
        return;
    } catch(error) {
        console.log(error);
        res.status(500).send("Page rank calculation issue!");
    }
}
// EXPORT
module.exports = router;