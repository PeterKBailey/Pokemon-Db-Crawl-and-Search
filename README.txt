COMP4601 Assignment 1 - Peter Bailey 101157705

Summary of Completion

    Items completed:
        [-] README
        [-] Video Recording
        [-] Web Crawler
            --> My crawler crawled the fruits graph (https://people.scs.carleton.ca/~davidmckenney/fruitgraph/N-0.html)
                and my personal site (https://pokemondb.net/pokedex)
            --> All 1000 fruit pages and their links are stored in the database
                600 personal pages and their links are stored in the database
            --> Selection policy is simply a Breadth First Search
                There is an additional wrinkle of only exploring urls which start with a 
                specified root are explored.
            --> Pagerank calculations have been performed and stored in the database too

        [-] RESTful Web Server
            --> My server provides the following endpoints with both HTML and JSON representations
                GET /pages/popular
                GET /pages/:pageId
                GET /crawls/fruits(?q=String&boost=String&limit=Number)
                GET /crawls/personal(?q=String&boost=String&limit=Number)

        [-] Search Endpoints
            --> GET /crawls/fruits and GET /crawls/personal
                both endpoints support:
                    1. q for the query string
                    2. boost to indicate if Page Rank should be taken into account
                    3. limit to specify how many pages should be returned (between 1 and 50)

        [-] Browser Based Interface
            --> HTML pages are provided for each of the 4 paths mentionned above
            --> The search page provides:
                1. Text box for the query string
                2. Check box for Page Rank boost option
                3. Number box for results limiter

        [-] Search Results
            --> Search results
                The search results displays a list of relevant pages with the following data:
                    1. Its original title
                    2. The computed search score
                    3. Its page Rank
                    4. A link to the extracted data about this page
                    5. A link to the original page which was crawled
            --> Extracted page data
                Individual pages can be accessed at /pages/:pageId and they include the following data:
                    1. Its original title
                    2. Its Page Rank
                    3. The list of extracted words and their frequencies
                    4. The list of crawled pages which link to this page (Incoming Links)
                    5. The list of pages this page links to (Outgoing Links)

    To the best of my knowledge I have completed every requirement.

Rest Server URL endpoints

    GET http://134.117.134.3:3002/pages/popular
    GET http://134.117.134.3:3002/pages/:pageId
    GET http://134.117.134.3:3002/crawls/fruits(?q=String&boost=String&limit=Number)
    GET http://134.117.134.3:3002/crawls/personal(?q=String&boost=String&limit=Number)

    PLEASE NOTE:
        The server which is used to access the db was also used as an endpoint 
        to run my crawler and pagerank processes.
            These were accessible at /crawl/personal and /crawl/fruit
            And /rank/personal and /rank/fruit
        They are disabled as they only need to be run once to extract the data.

Link to Recording:

https://clipchamp.com/watch/uguUUHGG9uo
