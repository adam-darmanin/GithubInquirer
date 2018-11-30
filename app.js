/**
 * Module dependencies.
 */
const github = require('octonode');
const gh = require('parse-github-url');
const fs = require('fs');
const CSV = require("comma-separated-values");

var client = github.client('XXXX'); // add your API key here
client.get('/user', {}, (err, status, body, headers) => {
  if (err) {
    console.log(err, status, body, headers);
  }
});

var ghsearch = client.search();

fs.writeFile('prs.csv', 'Repo, PR, Adjustments,\n', (err) => {
  if (err) {
    throw err;
  }
});


iterateThroughIssuesWithQuery(1);

/**
 * Paginate all queries.
 */
function iterateThroughIssuesWithQuery(page) {
  ghsearch.issues({
    page: page,
    per_page: 100,
    q: 'is:pr head:CodeFix- label:AUTOFIX-CC-APPROVED',
    //q: "is:pr head:CodeFix- ",
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

      iterateThroughIssuesWithQuery(page + 1);
    }
  });

}

/**
 * Introspect PR, if more than 1 commit IC has altered this auto PR
 * @param prURL
 */
function processPRfromIssue(prURL) {
  var prUrlObj = gh(prURL);
  var ghpr = client.pr(prUrlObj.repository, prUrlObj.filepath);

  ghpr.info((err, data, headers) => {
    if (data && data.commits > 1) {
      var meta = [[prUrlObj.repo, prURL, data.commits - 1]];
      var str = new CSV(meta, {header: false}).encode() + ",\n";
      fs.appendFile('prs.csv', str,
          (err) => {
            if (err) {
              throw err;
            }
          });
    }
  });
}