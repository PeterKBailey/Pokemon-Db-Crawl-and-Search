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
const { MongoClient, ObjectId } = require("mongodb");
// Express Router
const express = require('express');

let router = express.Router();
let db;

MongoClient.connect("mongodb://localhost:27017/").then(async (result) => {
    db = result.db('a2');
});

// Params
router.param("pageId",      loadPage);

// Routes 
router.get ("/",            (req, res) => res.redirect("./popular"));
router.get ("/popular",     getPopular);
router.get ("/:pageId",     getPage);

// **** Everything Below is the implementations *****

async function getPopular(req, res){
    try{
        let topTen = await db.collection("pageLinks").aggregate([
            { $group: { _id: "$toPage", count: { $sum: 1 } } },
            { $sort: {"count": -1} },
            { $limit: 50 }
        ]).toArray();

        topTen = topTen.map(pageLink => {
            return {uri: pageLink._id, count: pageLink.count};
        });
        res.format(
            {
                "application/json" : function(){
                    res.status(200).send(topTen); //OK
                },
    
                "text/html" : function(){
                    res.status(200).render("popular.pug", {popularPages: topTen}); //OK
                }
            }
        );
    } catch (error) {
        console.log(error);
        res.status(500).send(); //Internal Server Error
    }
    res.status(501).send()
}

async function loadPage(req, res, next){
    try{
        let pageId = req.params.pageId;
        let foundPage = ObjectId.isValid(pageId) ? await db.collection("pages").findOne({_id: ObjectId(pageId)}, { projection: { content: 0 } }) : null;
        if(foundPage){
            req.page = foundPage;
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

async function getPage(req, res){
    let pagesToCurrentPage = await db.collection("pageLinks").aggregate([
        { $match : { toPage: req.page.uri }}, 
        { $lookup: {
            from: "pages",
            localField: "fromPage",
            foreignField: "uri",
            as: "pages"
        }}
    ]).toArray();

    pagesToCurrentPage = pagesToCurrentPage.map(pageLinkAndPage => {
        return pageLinkAndPage.pages[0];
    });

    let pagesFromCurrentPage = await db.collection("pageLinks").aggregate([
        { $match : { fromPage: req.page.uri }}, 
        { $lookup: {
            from: "pages",
            localField: "toPage",
            foreignField: "uri",
            as: "pages"
        }}
    ]).toArray();

    pagesFromCurrentPage = pagesFromCurrentPage.map(pageLinkAndPage => {
        if(pageLinkAndPage.pages[0]) 
            return pageLinkAndPage.pages[0]

        return {
            uri: pageLinkAndPage.toPage
        };
    })

    res.format(
        {
            "application/json" : function(){
                req.page.incomingPages = pagesToCurrentPage;
                req.page.outgoingPages = pagesFromCurrentPage;
                res.status(200).send(req.page); //OK
            },

            "text/html" : function(){
                res.status(200).render("extractedPage.pug", {page: req.page, pagesToCurrentPage: pagesToCurrentPage, pagesFromCurrentPage: pagesFromCurrentPage}); //OK
            }
        }
    );
}


// EXPORT
module.exports = router;