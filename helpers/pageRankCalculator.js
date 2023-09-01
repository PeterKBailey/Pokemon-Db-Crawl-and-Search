
// Matrix lib
const { Matrix } = require("ml-matrix");

// takes a mongo db reference
async function calculatePageRank(db, pageFilter){
    let result = await createAdjacencyMatrix(db, pageFilter);
    // if aM[x][y] == 1 then there is an edge from x to y (i.e. page x has a link to page y) 
    let adjacencyMatrix = result[0];
    // probability of going to y from x
    let transitionMatrix = createTransitionMatrix(adjacencyMatrix, 0.1);
    // {uri: index}
    let uriMap = result[1];
    // probability of being at any page, uriMap needed
    let steadyStateProbabilities = calculateProbabilities(transitionMatrix);
    
    // create the updates based on the pagerank probabilities
    let pageRankUpdates = [];
    for(let uri in uriMap){
        pageRankUpdates.push({
            updateOne:{
                filter: { uri: uri },
                update: { $set: { pageRank: steadyStateProbabilities[uriMap[uri]] } }
            }
        });
    }

    await db.collection("pages").bulkWrite(pageRankUpdates, {
        ordered : false
    }).then(result => {
        console.log("page ranks updated!");
        console.log(pageFilter);
    });
    return true;
}


async function createAdjacencyMatrix(db, pageFilter){
    // map: uri to value in [0, n-1]
    // each uri gets assigned an index value used throughout the computation
    let uriMap = {};

    let count = 0;

    await db.collection("pages").find(pageFilter, {uri:1}).forEach(page => {
        // assign then increment
        uriMap[page.uri] = count++;
    });

    const numPages = count;
    console.log("This many pages: " + numPages);

    // matrix of nxn 0s
    let adjacencyMatrix = new Array(numPages);
    for(let i = 0; i < numPages; ++i){
        adjacencyMatrix[i] = new Array(numPages).fill(0);
    }

    // 1s for outgoing links
    await db.collection("pageLinks").find(pageFilter).forEach(foundLink => {
        let fromPageIndex = uriMap[foundLink.fromPage];
        let toPageIndex = uriMap[foundLink.toPage];
        adjacencyMatrix[fromPageIndex][toPageIndex] = 1;
    });

    return [adjacencyMatrix, uriMap];
}

function createTransitionMatrix(adjacencyMatrix, alpha=0.1){
    const numNodes = adjacencyMatrix.length;

    // probability of ending up at a node =
        // probability of following a link to that node if not teleporting
        // plus the probability of teleporting to that node
    for(let fromIndex in adjacencyMatrix){
        let numOutgoing = numOnes(adjacencyMatrix[fromIndex]);
        for(let toIndex in adjacencyMatrix[fromIndex]){
            adjacencyMatrix[fromIndex][toIndex] = 
                (adjacencyMatrix[fromIndex][toIndex] / numOutgoing) 
                * (1-alpha) 
                + (alpha/numNodes);
        }
    }
    return adjacencyMatrix;
}

function numOnes(arr){
    let count = 0;
    for(let val of arr){
        if(val == 1){
            count++
        }
    }
    return count;
}


function calculateProbabilities(transitionMatrix){
    let P = new Matrix(transitionMatrix);
    let x = new Array(transitionMatrix.length).fill(0);
    x[0] = 1;
    x = new Matrix([x]);
    let oldX;
    // power iteration
    while(true){
        oldX = x;
        x = oldX.mmul(P);
        // if the distance between the two vectors is < 0.0001
        if(euclideanDistance(oldX.to1DArray(), x.to1DArray()) < 0.0001)
            return x.to1DArray();
    }
}


// sqrt of the sum of the square of the differences
function euclideanDistance(x, y){
    let sumSquareDifferences = 0;

    for(let i = 0; i < x.length; ++i){
        sumSquareDifferences += (x[i] - y[i])**2;
    }
    return Math.sqrt(sumSquareDifferences);
}

module.exports.calculatePageRank = calculatePageRank;