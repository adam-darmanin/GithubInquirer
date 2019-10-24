/**
 * Module dependencies.
 */
const github = require('octonode');
const GH_BW_PAUSE_PERIOD = 2000; // Pause period not to abuse GH's bandwith.
const gh = require('parse-github-url');
const fs = require('fs');
const CSV = require("comma-separated-values");
const TECH = {
    JS: 'javascript',
    JAVA: 'java',
    CS: 'c#',
    CPP: 'cpp'
}

console.log('Starting UT PR Review poller');

// This search is done using UnitTetService Account GH token.
var client = github.client('fdcbd0435b4c31526ab727311f1609396c2fe2a1');
client.get('/user', {}, (err, status, body, headers) => {
    if (err) {
        console.log(err, status, body, headers);
    }
});

var ghsearch = client.search();

fs.writeFile('prs.csv', 'Repo, PR, insight, Assignee, Adjustments,\n',
    (err) => {
        if (err) {
            throw err;
        }
    });

findOpenPrForTestReview(1);


function createUTReviewComment() {
    prIssue.createComment({
        body: 'Closing because of CodeCleanup timeout'
    }, (err, data, headers) => {
        if (err) {
            throw err;
        }
    });
}

/**
 * Paginate all queries.
 * <b>NB</b>: Takes a pause not to abuse the GH server bandwidth. If GH detects abuse
 * it will blacklist the connection for a time-period.
 *
 * @param prURL Starting from 1. Will paginate with the GH server.
 */
function findOpenPrForTestReview(page) {
    ghsearch.issues({
        page: page,
        per_page: 100,
        q: 'is:pr updated:2019-10-22..2019-10-23 user:trilogy-group',
        sort: 'created'
    }, (err, data, headers) => {
        if (err) {
            throw err;
        }
        if (data.items.length > 0) {
            for (var i = 0; i < data.items.length; i++) {
                var issue = data.items[i];
                processPRfromIssue(issue.html_url);
            }

            setTimeout(() => {
                findOpenPrForTestReview(page + 1);
            }, GH_BW_PAUSE_PERIOD);
        }
    });
}


/**
 * Sets the reviewer and creates the JIRA ticket for them.
 *
 * @param tech - see TECH
 */
function callUTReview(tech) {
    // TODO: Set reviewer
    // TODO: Create JIRA
}

/**
 * Introspect PR, if more than 1 commit IC has altered this auto PR
 * @param prURL
 */
function processPRfromIssue(prURL) {
    let prUrlObj = gh(prURL);
    let ghpr = client.pr(prUrlObj.repository, prUrlObj.filepath).conditional(
        'ETAG');

    ghpr.files((error, files, headers) => {
        if (error || !files){
            console.warn("Missing files or error: %s", error.message);
            return;
        }

        let eligible = false;
        const regex = /.*test.*\.(java|cs)/i;

        for (let i = 0; i < files.length && !eligible; ++i) {
            const file = files[i];

            let matches = file.filename.match(regex);

            if (matches && matches.length > 1) {
                console.log('PR: %s has test files: %s', prURL, matches[0]);
                switch (matches[1]) {
                    case 'cs':
                        eligible = true;
                        callUTReview(TECH.CS);
                        break;

                    case 'java':
                        eligible = true;
                        callUTReview(TECH.JAVA);
                        break;

                    case 'c':
                    case 'cpp':
                        eligible = true;
                        callUTReview(TECH.CPP);
                        break;
                }
            }
        }
    });
}