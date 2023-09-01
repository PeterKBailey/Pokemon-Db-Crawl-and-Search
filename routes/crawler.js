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
// Web crawler module (install via NPM - npm install crawler)
const Crawler = require("crawler");
// ElasticLunr search module (install via NPM - npm install elasticlunr)
const elasticlunr = require("elasticlunr");
// HE HTML entity module (install via NPM - npm install he)
const he = require("he");

// we're using the lab3 data
// let cursor run and request page documents in batches and add them to index as we go
MongoClient.connect("mongodb://localhost:27017/").then(result => {
    db = result.db('a2');
});

// Express setup
const express = require('express');
let router = express.Router();

// Routes
router.get ("*", (req, res) => {res.status(200).send("Crawl currently disabled.")});
router.get ("/fruits", crawlFruit);
router.get ("/personal", crawlPersonal);

// desired url root, number of pages to visit, number of pages visited, number of pages queued, set of pages queued
function buildCrawler(desiredRoot, crawlId, maxQueueNum){
    let pageCount = 0;
    // the starting page
    let numQueued = 1;
    return new Crawler({
        maxConnections : 5, //use this for parallel, rateLimit for individual
        // rateLimit: 100,

        // This will be called for each crawled page
        callback : async function (error, result, done) {
            if(error){
                console.log(error);
            }else{
                let $ = result.$;
                if(!$){
                    done();
                    return;
                }
                
                // data passed when queueing
                const crawler = result.options.crawler;
                const queuedUrls = result.options.queuedUrls;

                // we will be storing the page being crawled's URI, title, text content
                const uri = result.request.uri.href;
                // const textContent = $("p, div, dd, dt, strong, li").map((index, element) => {
                //     return $(element).text().replace(/[\s]+/gm, " ").trim();
                // }).toArray().join(" ");

                // split text on the html elements (completely remove script and style tags which have inline)
                const processing = processText($("body").html().replace(/(<(script|style)[^]+<\/(script|style)>)|(<\/?(([a-zA-Z0-9\- =])|(".*?"))*>)/g, " ").replace(/\s+/g, " ").trim());

                const htmlTitle = $("title").text();

                console.log(pageCount++ + ") CRAWLING: " + uri);
                console.log("text len " + processing.parsedText.length);
                // console.log(processing.parsedText.substring(927, 1100));
    
                // throw new Error("break")

                // perform upsert
                const query = { uri: uri };
                const update = { $set: { uri: uri, relatedCrawl: crawlId, title: htmlTitle, content: processing.parsedText, wordFreqs: processing.wordFreqs }};
                const queryOptions = { upsert: true };
                db.collection("pages").updateOne(query, update, queryOptions);

                // get all of the outgoing hrefs
                let links = $("a").toArray().map((link) => {
                    let outgoingURI = $(link).attr("href");
                    return getOutgoingURI(uri, outgoingURI);
                }).filter((outgoingURI) => {
                    // remove unwanted links
                    return outgoingURI != false && outgoingURI != uri;
                });

                let pageLinkUpserts = [];
                
                console.log("num outgoing links: " + links.length);
                for(let outgoingURI of links){
                    if(!outgoingURI)
                        continue;

                    // if link is a new link and is within our desired root
                    if((!maxQueueNum || numQueued != maxQueueNum) && !queuedUrls[outgoingURI] && outgoingURI.startsWith(desiredRoot)){
                        // then queue it up
                        numQueued++;
                        queuedUrls[outgoingURI] = true;
                        crawler.queue({
                            uri: outgoingURI,
                            crawler: crawler,
                            queuedUrls: queuedUrls
                        });
                        console.log("queuing up " + outgoingURI + " from " + htmlTitle);
                    }
                    
                    pageLinkUpserts.push({
                        updateOne:{
                            filter: {toPage: outgoingURI, fromPage: uri},
                            update: {$setOnInsert: {
                                toPage: outgoingURI, 
                                fromPage: uri,
                                relatedCrawl: crawlId
                            }},
                            upsert: true
                        }
                    });
                }

                // delete pagelinks from ui, where to not in links
                db.collection("pageLinks").deleteMany({
                    fromPage: uri, 
                    toPage: {
                        $nin: links
                    }
                });

                // upsert all of the edges
                if(pageLinkUpserts.length > 0){
                    // store the pagecount in this scope
                    const tempPageCount = pageCount;

                    db.collection("pageLinks").bulkWrite(pageLinkUpserts, {
                        ordered : false
                    }).then(result => {
                        console.log("Page " + tempPageCount + ") " + uri + " has inserted " + pageLinkUpserts.length + " links.");
                    });
                }

            }
            done();
        }
    });
}

function processText(message){
    let freqs = {};
    let updatedMessage = "";
    for(let word of elasticlunr.tokenizer(message)){
        word = he.decode(word);
        if(elasticlunr.stopWordFilter(word) !== undefined){
            if(!freqs[word])
                freqs[word] = 1;
            else
                freqs[word]++;
            updatedMessage += word + " ";
        }
    }

    return {
        wordFreqs: freqs,
        parsedText: updatedMessage
    };
}


async function crawlFruit(req, res){
    // Fruits crawl
    const crawlName = "FRUITS"
    // large fruits
    const startUrl = "https://people.scs.carleton.ca/~davidmckenney/fruitgraph/N-0.html"
    let crawlResult = await crawlPages(crawlName, startUrl, "");

    res.status(crawlResult[0]).send(crawlResult[1]);
}

async function crawlPersonal(req, res){
    // personal crawl
    const crawlName = "PERSONAL"
    const root = "https://pokemondb.net/pokedex";
    let crawlResult = await crawlPages(crawlName, root + "/national", root, 600);

    res.status(crawlResult[0]).send(crawlResult[1]);
}


async function crawlPages(crawlName, startUrl, urlRoot, maxQueueNum){
    console.log("page crawl requested");

    // look for the related crawl in the db
    const filter = {name: crawlName}
    // we'll be updating it with the current date
    const update = { $set: { name: crawlName, lastPerformed: new Date()} };
    // we'll be inserting it if it didn't exist
    const options = { upsert: true };
    let relatedCrawlUpdate;
    try{
        relatedCrawlUpdate = await db.collection("crawls").findOneAndUpdate(filter, update, options);
        console.log(relatedCrawlUpdate);
    } catch(error) {
        console.log(error);
        return [500, "Error accessing db for related crawl"]; //Internal Server Error
    }

    // crawlId is either the found/updated or the inserted
    const crawlId = relatedCrawlUpdate.lastErrorObject.updatedExisting ? relatedCrawlUpdate.value._id.toString() : relatedCrawlUpdate.lastErrorObject.upserted.toString();
    
    // build the crawler, pass it the base root and crawl id
    const crawler = buildCrawler(urlRoot, crawlId, maxQueueNum);

    let queuedUrls = {};
    queuedUrls[startUrl] = true;
    
    crawler.queue({
        uri: startUrl,
        crawler: crawler,
        queuedUrls: queuedUrls
    });

    // once queue is empty (i.e. crawl has ended)
    crawler.on('drain', async function(){
        console.log("Queue Drained");
    });    

    return [200, "Crawl Started"];
}

function getOutgoingURI(startingURI, outgoingURI){
    // console.log("starting at " + outgoingURI);
    // if it didn't have an href return false (useful for selection)
    if(!outgoingURI || outgoingURI.length == 0)
        return false;

    // what can a link be?
        // fully qualified (protocol + domain (+ path))
        // relative to protocol (// + domain (+ path))
        // relative to domain (/ + path)
        // relative to page (./ + path) or (path)
        // script
        // mailto
        // anchor
        // query

    // if it has an anchor or query get rid of them
    let extensionIndex = outgoingURI.search(/(#.+)|(\?.+)/);
    if(extensionIndex != -1){
        outgoingURI = outgoingURI.substring(0, extensionIndex);
    }

    // if its a full protocol link then keep it if it is http(s)
    let protocolSeparatorIndex = outgoingURI.indexOf("://");
    if(protocolSeparatorIndex != -1){
        return !(outgoingURI.startsWith("http")) ? false : outgoingURI;
    }
    // otherwise if it is a relative to protocol then extend it to use our protocol           
    else if(outgoingURI.startsWith('//')){
        outgoingURI = startingURI.substring(0, startingURI.indexOf("//")) + outgoingURI;
    }
    // otherwise if it is relative to domain then extend it to use the domain
    else if(outgoingURI[0] === '/'){
        outgoingURI = startingURI.match(/(http(s)?:\/\/)([^\/]+)/gi)[0] + outgoingURI;
    }
    // otherwise if it is a script get rid of it
    else if(outgoingURI.startsWith("javascript") || outgoingURI.startsWith("mailto")){
        return false;
    }
    // otherwise it must be a local path
    else {
        let pathStart = startingURI.lastIndexOf("/");
        if(pathStart === -1)
            pathStart = startingURI.length;
        outgoingURI = startingURI.substring(0,  pathStart + 1) + (outgoingURI.startsWith("./") ? outgoingURI.substring(2) : outgoingURI);
    }
    // console.log("updated to : " + outgoingURI);

    // remove trailing slash
    if(outgoingURI[outgoingURI.length-1] === "/")
        outgoingURI = outgoingURI.substring(0, outgoingURI.length-1);
    return outgoingURI;
}


// EXPORT
module.exports = router;