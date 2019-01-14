/**
 * Module dependencies.
 */
const github = require('octonode');
const gh = require('parse-github-url');
const fs = require('fs');
const CSV = require("comma-separated-values");

var client = github.client('TOKEN HERE');
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

findManualAutofix(1);

//closePR();

function closePR() {
  fs.readFile('timeout-prs.csv', 'utf8', (err, data) => {
    if (err) {
      throw err;
    }
    var parsed = new CSV(data, {header: true}).parse();

    for (var i = 0; i < parsed.length; i++) {
      var repo = parsed[i].repo;
      var pr = parsed[i].pr;
      var ghpr = client.pr(repo, pr).conditional('ETAG');

      console.log(ghpr)

      var prIssue = client.issue(repo, pr);
      prIssue.createComment({
        body: 'Closing because of CodeCleanup timeout'
      }, (err, data, headers) => {
        if (err) {
          throw err;
        }
      });

      ghpr.close((err, data, headers) => {
        if (err) {
          throw err;
        }
      }); //pull request
    }

  });

}

/**
 * Paginate all queries.
 */
function findManualAutofix(page) {
  ghsearch.issues({
    page: page,
    per_page: 100,
    q: 'is:pr head:CodeFix- label:AUTOFIX-CC-APPROVED updated:2018-12-17..2018-12-23',
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

      findManualAutofix(page + 1);
    }
  });

}

/**
 * Introspect PR, if more than 1 commit IC has altered this auto PR
 * @param prURL
 */
function processPRfromIssue(prURL) {
  var prUrlObj = gh(prURL);
  var ghpr = client.pr(prUrlObj.repository, prUrlObj.filepath).conditional(
      'ETAG');

  ghpr.info((err, prData, headers) => {
    if (prData && prData.commits > 1) {
      ghpr.commits((err, commitData, headers) => {
        var authors = "";

        for (var i = 0; i < commitData.length; ++i) {
          if (commitData[i].author ==undefined ||
              commitData[i].author.login == undefined ||
              commitData[i].author.login.localeCompare("codefix-service-user") == 0){
            continue;
          }
          authors += commitData[i].author.login;
          if (i < commitData.length - 1) {
            authors += " ";
          }
        }

        var insight = prData.head.ref.split("-")[1];
        var meta = [[prUrlObj.repo, prURL, insight, authors,
          prData.commits - 1]];
        var str = new CSV(meta, {header: false}).encode() + ",\n";

        fs.appendFile('prs.csv', str,
            (err) => {
              if (err) {
                throw err;
              }
            });
      });
    }
  });
}