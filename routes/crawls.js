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
// ElasticLunr modules (install via NPM - npm install elasticlunr)
const elasticlunr = require("elasticlunr");
// Express Router
const express = require('express');

let router = express.Router();
let db;

function lunrIndexFunc(){
    this.addField('title');
    this.addField('content');
    this.setRef('_id');
}

let crawlIndecies = {};


MongoClient.connect("mongodb://localhost:27017/").then(async (result) => {
    db = result.db('a2');

    // make a new index for each crawl
    await db.collection("crawls").find().forEach(foundCrawl => {
        crawlIndecies[foundCrawl._id.toString()] = elasticlunr(lunrIndexFunc);
    });
    // add page documents to the relevant index
    db.collection("pages").find().forEach(foundPage => {
        crawlIndecies[foundPage.relatedCrawl].addDoc(foundPage);
    })
    .then(cursorResult => {
        console.log("Indexing done!");
    });

});

// Routes and params
router.get ("/",            (req, res) => {res.status(200).send("Go to <a href = \"fruits\">fruits</a> or <a href = \"personal\">personal</a>")});
router.get ("/:crawlName",  [getIndex, searchIndex]);


async function getIndex(req, res, next){
    try{
        let crawlName = req.params.crawlName;
        let foundCrawl = await db.collection("crawls").findOne({name: crawlName.toUpperCase()});
        if(foundCrawl){
            req.index = crawlIndecies[foundCrawl._id.toString()];
            next();
        } else {
            res.status(404).send(); //Not Found
            return;
        }
    } catch(error) {
        console.log(error)
        res.status(500).send(); //Internal Server Error
    }
}

function searchIndex(req, res){
    let index = req.index;
    const query = req.query ? req.query.q : null;
    const boost = req.query ? req.query.boost == "true" : false;
    let limit = parseInt(req.query.limit); 
    if(!limit){
        limit = 10;
    } else if(limit > 50){
        limit = 50;
    } else if(limit < 1){
        limit = 1;
    }

    let searchResults = [];
    if(query){
        searchResults = index.search(query, {}).map(result => {
            let pageDoc = index.documentStore.getDoc(result.ref);
            pageDoc.searchScore = boost ? result.score*pageDoc.pageRank : result.score;
            return pageDoc;
        }).sort((a, b) => {
            return b.searchScore - a.searchScore;
        }).slice(0, limit);
    }
    res.format(
        {
            "application/json" : function(){
                res.status(200).send(searchResults); //OK
            },

            "text/html" : function(){
                res.status(200).render("search.pug", {pageTitle: req.params.crawlName, relevantPages: searchResults}); //OK
            }
        }
    );
}

// EXPORT
module.exports = router;