const baseUrl = location.href;
const wordlistUrl = "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt";
const paramWordlistUrl = "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/burp-parameter-names.txt";
const crawledUrls = new Set();
const discoveredPaths = new Set();
const paramMiningResults = new Map();
let paramList = [];
const THREAD_LIMIT = 40;

// Load wordlist
async function loadWordlist(url) {
    try {
        console.log(`📥 Fetching wordlist from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load wordlist: ${response.status}`);
        
        const text = await response.text();
        return text.split('\n').map(line => line.trim()).filter(line => line !== '');
    } catch (error) {
        console.error(`❌ Error loading wordlist: ${error.message}`);
        return [];
    }
}

// Get the host from a URL
function getHost(url) {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
}

// Crawl function
async function crawl(url, depth = 2) {
    if (depth === 0 || crawledUrls.has(url)) return;

    crawledUrls.add(url);
    console.log(`🔍 Crawling: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const links = Array.from(doc.querySelectorAll("a"))
            .map(a => a.href)
            .filter(href => href.startsWith("http") && getHost(href) === getHost(baseUrl));

        for (const link of links) {
            await crawl(link, depth - 1);
            await checkPath(link, true);
        }
    } catch (error) {
        console.error(`❌ Error crawling ${url}: ${error.message}`);
    }
}

// Check path
async function checkPath(path, isCrawler) {
	if (isCrawler == true){
		 url = `${path}`.replace(/([^:]\/)\/+/g, "$1");
	} else {
		 url = `${baseUrl}/${path}`.replace(/([^:]\/)\/+/g, "$1");
	}
    
    try {
        const response = await fetch(url);
        const responseText = await response.text();

        const errorPatterns = ["invalid request", "not found", "forbidden", "404", "error", "unauthorized"];
        const isError = errorPatterns.some(pattern => responseText.toLowerCase().includes(pattern));

        if (response.ok && !isError) {
            console.log(`✅ Found: ${path} [${response.status}]`);
			path = path.replace(baseUrl, ""); // strip baseUrl if from crawler
            discoveredPaths.add(path);
        }
    } catch (error) {
        console.error(`❌ Error checking path: ${error.message}`);
    }
}

// Discover paths function
async function discoverPaths(wordlist) {
    console.log(`\n🚀 Starting path discovery...`);
    let index = 0;

    while (index < wordlist.length) {
        const batch = wordlist.slice(index, index + THREAD_LIMIT).map(path => checkPath(path, false));
        await Promise.all(batch);
        index += THREAD_LIMIT;
    }

    console.log(`\n✅ Discovered Paths:\n`, [...discoveredPaths]);
}

// Filter by extensions
async function filterByExtension(extension) {
    const filtered = [...discoveredPaths].filter(path => path.endsWith(extension));
    console.log(`\n✅ Paths with extension '${extension}':\n`, filtered);
}

// Compare responses to identify valid params with randomization
async function compareResponses(baselineText, url, param) {
    try {
        // Generate different test cases
        const testCases = [
            Math.random().toString(36).substring(2, 15), // Random string
            Math.floor(Math.random() * 1000), // Random integer
			1, // Low integer
            null // Null value
        ];

        for (const testCase of testCases) {
            const value = testCase === null ? '' : testCase;

            // GET check
            await checkResponse(url, param, value, baselineText, 'GET');

            // POST check
            await checkResponse(url, param, value, baselineText, 'POST');
        }
    } catch (error) {
        console.error(`❌ Error comparing response: ${error.message}`);
    }
}

async function checkResponse(purl, param, value, baselineText, method) {
    try {
		let url = purl;
        let response;
        let responseText;

        if (method === 'GET') {
            const singleGetUrl = `${url}${url.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(value)}`;
            response = await fetch(singleGetUrl);
            responseText = await response.text();

            if (response.ok && baselineText !== responseText) {
                console.log(`🚀 Discovered param: ${singleGetUrl} [${method}]`);

                if (responseText.includes(value)) {
                    console.log(`💥 Parameter ${param} is reflected in the response [${method}]`);
                } 
                if (!paramMiningResults.has(url)) paramMiningResults.set(url, []);
                if (!paramMiningResults.get(url).includes(`${param} (${method})`)) paramMiningResults.get(url).push(`${param} (${method})`);

            }
        } else if (method === 'POST') {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `${param}=${encodeURIComponent(value)}`
            });
            responseText = await response.text();

            if (response.ok && baselineText !== responseText) {
                console.log(`🚀 Discovered param: ${url} [${method}] with body '${param}=${value}'`);

                if (responseText.includes(value)) {
                    console.log(`💥 Parameter ${param} is reflected in the response [${method}]`);
                } 
                if (!paramMiningResults.has(url)) paramMiningResults.set(url, []);
				if (!paramMiningResults.get(url).includes(`${param} (${method})`)) paramMiningResults.get(url).push(`${param} (${method})`);

            }
        }
    } catch (error) {
        console.error(`❌ Error during ${method} check: ${error.message}`);
    }
}



// Mine parameters using multiple threads
async function mineParams(url) {
    console.log(`\n🔎 Mining params on: ${url}`);
    const baselineResponse = await fetch(url);
    const baselineText = await baselineResponse.text();

    let index = 0;
    while (index < paramList.length) {
        const batch = paramList.slice(index, index + THREAD_LIMIT).map(param =>
            compareResponses(baselineText, url, param)
        );
        await Promise.all(batch); // Run batch concurrently
        index += THREAD_LIMIT;
    }

    console.log(`\n✅ Param Mining Results:`);
    for (const [path, params] of paramMiningResults.entries()) {
        console.log(`🔹 ${path} -> ${params.join(", ")}`);
    }
}

// Sub-menu for mining params
async function mineParamsMenu() {	
    console.clear();
    console.log(`\n🔎 Mine Parameters`);
    console.log(`1. Input specific path`);
    console.log(`2. Use location.href`);
    console.log(`3. Use discovered paths ${discoveredPaths.size > 0 ? "" : "(Disabled)"}`);
    console.log(`4. Back`);

    const choice = prompt("\nChoose an option (1-4):");

    switch (choice) {
        case '1':
            const inputPath = prompt("Enter the specific path:");
            if (inputPath) await mineParams(inputPath);
            break;
        case '2':
            await mineParams(baseUrl);
            break;
        case '3':
            if (discoveredPaths.size > 0) {
                for (const path of discoveredPaths) {
                    //await mineParams(`${baseUrl}${path}`);
					await mineParams(`${path}`);
                }
            } else {
                console.log("❌ No discovered paths available.");
            }
            break;
        case '4':
            return;
        default:
            console.log("❌ Invalid choice. Try again.");
            await mineParamsMenu();
            break;
    }
}

// Main menu
async function mainMenu() {
    console.clear();
    console.log(`\n📌 Web Scanner Tool`);
    console.log(`1. Discover Paths`);
    console.log(`2. Filter by Extension ${discoveredPaths.size > 0 ? "" : "(Disabled)"}`);
    console.log(`3. Crawl`);
    console.log(`4. Mine Params ${discoveredPaths.size > 0 ? "" : "(Disabled)"}`);
    console.log(`5. Show Discovered Paths ${discoveredPaths.size > 0 ? "" : "(Disabled)"}`);
	console.log(`6. Show Discovered Params ${paramMiningResults.size > 0 ? "" : "(Disabled)"}`);
    console.log(`7. Exit`);

    const choice = prompt("\nChoose an option (1-7):");

    switch (choice) {
        case '1':
            let customWordlist = prompt("Enter custom wordlist URL (leave empty for default):");
            if (!customWordlist) customWordlist = wordlistUrl;		
            const wordlist = await loadWordlist(customWordlist);
            await discoverPaths(wordlist);
			alert("Done");
            break;
        case '2':
            if (discoveredPaths.size > 0) {
                const ext = prompt("Enter file extension (e.g., .php, .js):");
                await filterByExtension(ext);
            } else {
                console.log("❌ No discovered paths available. Please discover paths first.");
            }
			alert("Done");
            break;
        case '3':
            const depth = parseInt(prompt("Enter scan depth (e.g., 2):"));
            if (!isNaN(depth)) await crawl(baseUrl, depth);
            else console.log("❌ Invalid depth.");
			alert("Done");
            break;
        case '4':
            if (discoveredPaths.size > 0) {
				let customWordlist = prompt("Enter custom paramlist URL (leave empty for default):");
				if (!customWordlist) customWordlist = wordlistUrl;		
                paramList = await loadWordlist(customWordlist);
                await mineParamsMenu();
            } else {
                console.log("❌ No discovered paths available. Please discover paths first.");
            }
			alert("Done");
            break;
        case '5':
            if (discoveredPaths.size > 0) {
                console.log("\n✅ Discovered Paths:");
                console.log([...discoveredPaths].join("\n"));
            } else {
                console.log("❌ No discovered paths available.");
            }
			alert("Done");
            break;
        case '6':
            if (paramMiningResults.size > 0) {
                console.log("\n✅ Discovered Params:");
                console.log([...paramMiningResults].join("\n"));
            } else {
                console.log("❌ No discovered paths available.");
            }
			alert("Done");
            break;			
        case '7':
            console.log("\n👋 Exiting...");
            return;
        default:
            console.log("❌ Invalid choice. Try again.");
            break;
    }

    // Loop back to menu
    mainMenu();
}

mainMenu();
